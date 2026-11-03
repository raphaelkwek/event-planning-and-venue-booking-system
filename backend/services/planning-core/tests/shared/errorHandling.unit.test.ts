import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";

/**
 * C1 and H1: a rejected query must not end the process, and an error must never
 * reach the caller as a stack trace. Every test here that sends a request would,
 * without the fix, either raise `unhandledRejection` (which vitest reports as a
 * failure of the run) or get a `text/html` page with a stack.
 */

vi.mock("../../src/shared/db.js", () => {
  const sql = Object.assign(
    vi.fn(() => Promise.reject(new Error('password authentication failed for user "postgres"'))),
    { end: vi.fn() },
  );
  return { sql };
});

vi.mock("../../src/shared/auth/verifyJwt.js", () => ({
  verifyJwt: (req: { auth?: { supabaseUserId?: string } }, _res: unknown, next: () => void) => {
    req.auth = { supabaseUserId: "test-subject" };
    next();
  },
}));

vi.mock("../../src/modules/venue/auth/identity.js", async () => {
  const actual = await vi.importActual<typeof import("../../src/modules/venue/auth/identity.js")>(
    "../../src/modules/venue/auth/identity.js",
  );
  return { ...actual, resolveCurrentUser: vi.fn(async () => ({ id: "u1", email: "a@b.test", role: "VENUE_STAFF" })) };
});

const { app } = await import("../../src/app.js");
const { errorHandler } = await import("../../src/shared/errorHandler.js");
const { patchExpressLayer } = await import("../../src/shared/asyncErrors.js");
const { installProcessGuards } = await import("../../src/shared/processGuards.js");
const { logger } = await import("../../src/shared/logger.js");

const bearer = { Authorization: "Bearer t", "X-Correlation-Id": "corr-123" };
let unhandled: ReturnType<typeof vi.fn>;
let errorLog: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  unhandled = vi.fn();
  process.on("unhandledRejection", unhandled);
  errorLog = vi.spyOn(logger, "error").mockImplementation(() => undefined);
});
afterEach(() => {
  process.off("unhandledRejection", unhandled);
  errorLog.mockRestore();
});

const settle = () => new Promise((resolve) => setImmediate(resolve));

function expectInternalError(res: request.Response) {
  expect(res.status).toBe(500);
  expect(res.type).toBe("application/json");
  expect(res.body).toEqual({
    error: {
      code: "INTERNAL_ERROR",
      message: "Something went wrong on our side. Try again, and quote the correlation id if it keeps happening.",
      correlationId: "corr-123",
    },
  });
  // No internals: not the driver's text, not a stack.
  expect(res.text).not.toMatch(/password|postgres|at .*\.ts|node_modules/);
}

describe("C1: a rejected promise in an async handler becomes a 500 envelope", () => {
  it("C1-T1 identity: GET /api/v1/users/me with the database rejecting", async () => {
    expectInternalError(await request(app).get("/api/v1/users/me").set(bearer));
    await settle();
    expect(unhandled).not.toHaveBeenCalled();
  });

  it("C1-T2 venue: GET /api/v1/venues with the repo rejecting", async () => {
    expectInternalError(await request(app).get("/api/v1/venues").set(bearer));
    await settle();
    expect(unhandled).not.toHaveBeenCalled();
  });

  it("C1-T3 event: a failing caller lookup is a 503 refusal in the envelope, and nothing is left unhandled", async () => {
    const res = await request(app).get("/api/v1/events").set(bearer);
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("IDENTITY_UNAVAILABLE");
    await settle();
    expect(unhandled).not.toHaveBeenCalled();
  });

  it("C1-T4 logs the failure as an error with the correlation id, not as a refusal", async () => {
    await request(app).get("/api/v1/users/me").set(bearer);
    expect(errorLog).toHaveBeenCalledWith(
      "request failed",
      expect.objectContaining({ correlationId: "corr-123", outcome: "error", code: "INTERNAL_ERROR", error: expect.stringContaining("password") }),
    );
    expect(errorLog).toHaveBeenCalledWith("request failed", expect.objectContaining({ outcome: "error", durationMs: expect.any(Number) }));
  });

  it("C1-T5 the process survives, and the next request is served", async () => {
    await request(app).get("/api/v1/users/me").set(bearer);
    expect((await request(app).get("/healthz")).status).toBe(200);
  });
});

describe("C1: patchExpressLayer", () => {
  function fakeLayer(handle: (...args: unknown[]) => unknown) {
    class Layer {
      handle = handle;
      handle_request(...args: unknown[]): void {
        void args;
      }
    }
    patchExpressLayer(Layer as never);
    patchExpressLayer(Layer as never); // applying it twice must not wrap twice
    return new Layer();
  }

  it("passes a rejection to next, once", async () => {
    const failure = new Error("boom");
    const next = vi.fn();
    fakeLayer(async () => Promise.reject(failure)).handle_request({}, {}, next);
    await settle();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(failure);
  });

  it("passes a synchronous throw to next", () => {
    const failure = new Error("sync");
    const next = vi.fn();
    fakeLayer(() => {
      throw failure;
    }).handle_request({}, {}, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(failure);
  });

  it("leaves a handler that returns nothing, or a value, alone", () => {
    const next = vi.fn();
    fakeLayer(() => undefined).handle_request({}, {}, next);
    fakeLayer(() => 42).handle_request({}, {}, next);
    expect(next).not.toHaveBeenCalled();
  });

  it("skips an error-handling layer on a normal request", () => {
    const next = vi.fn();
    // Express tells an error-handling layer by its four declared arguments.
    const errorLayer = Object.defineProperty(() => undefined, "length", { value: 4 });
    fakeLayer(errorLayer).handle_request({}, {}, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });
});

describe("H1: the final handler", () => {
  const appWith = (mount: (a: express.Express) => void) => {
    const a = express();
    a.use(express.json({ limit: "1kb" }));
    mount(a);
    a.use(errorHandler);
    return a;
  };

  it("H1-T1 a malformed JSON body is 400 VALIDATION_FAILED in the envelope, with no stack", async () => {
    const res = await request(app).post("/api/v1/auth/login").set("Content-Type", "application/json").send("{not json");
    expect(res.status).toBe(400);
    expect(res.type).toBe("application/json");
    expect(res.body.error).toMatchObject({ code: "VALIDATION_FAILED", message: "The request body is not valid JSON." });
    expect(res.text).not.toMatch(/SyntaxError|at .*\.js|node_modules/);
  });

  it("H1-T2 an oversized body is 413 in the envelope", async () => {
    const a = appWith((x) => x.post("/echo", (_req, res) => res.json({ ok: true })));
    const res = await request(a).post("/echo").set("Content-Type", "application/json").send(JSON.stringify({ pad: "x".repeat(4000) }));
    expect(res.status).toBe(413);
    expect(res.body.error).toMatchObject({ code: "VALIDATION_FAILED", message: "The request body is too large." });
  });

  it("H1-T3 a route that calls next(error), as venue, equipment and change routes do, gets the envelope not an HTML stack", async () => {
    const a = appWith((x) =>
      x.get("/boom", (_req, _res, next) => {
        next(new Error("secret internals"));
      }),
    );
    const res = await request(a).get("/boom");
    expect(res.status).toBe(500);
    expect(res.type).toBe("application/json");
    expect(res.body.error.code).toBe("INTERNAL_ERROR");
    expect(res.text).not.toContain("secret internals");
  });

  it("H1-T4 another client error that body-parser exposes keeps its 4xx", async () => {
    const a = appWith((x) =>
      x.get("/teapot", (_req, _res, next) => next(Object.assign(new Error("x"), { status: 418, expose: true }))),
    );
    const res = await request(a).get("/teapot");
    expect(res.status).toBe(418);
    expect(res.body.error.code).toBe("VALIDATION_FAILED");
  });

  it("H1-T5 a non-Error rejection is still a 500 envelope", async () => {
    const a = appWith((x) => x.get("/str", (_req, _res, next) => next("just text")));
    const res = await request(a).get("/str");
    expect(res.status).toBe(500);
    expect(res.body.error.correlationId).toBeNull();
  });

  it("hands the error on when the response has started", () => {
    const next = vi.fn();
    const failure = new Error("late");
    errorHandler(failure, {} as never, { headersSent: true } as never, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(failure);
  });

  it("H1-T6 /readyz answers a generic 503 and logs the detail", async () => {
    const res = await request(app).get("/readyz");
    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ status: "not_ready", checks: { database: "unreachable" } });
    expect(Object.keys(res.body).sort()).toEqual(["checks", "status"]);
    expect(res.text).not.toMatch(/password|postgres/);
    expect(errorLog).toHaveBeenCalledWith("readiness check failed", expect.objectContaining({ error: expect.stringContaining("password") }));
  });
});

describe("C1: process guards", () => {
  it("logs an unhandled rejection and carries on, and logs an uncaught exception and then exits 1", async () => {
    const handlers: Record<string, (value: unknown) => void> = {};
    const exit = vi.fn();
    installProcessGuards({ on: ((event: string, handler: (value: unknown) => void) => (handlers[event] = handler)) as never }, exit);
    handlers.unhandledRejection!(new Error("lost"));
    handlers.unhandledRejection!("plain text");
    await settle();
    expect(exit).not.toHaveBeenCalled();
    handlers.uncaughtException!(new Error("thrown"));
    // The exit waits for stderr to flush, which can outlast a fixed delay on a loaded runner.
    await vi.waitFor(() => expect(exit).toHaveBeenCalledTimes(1), { timeout: 2000 });
    expect(errorLog).toHaveBeenCalledWith("unhandled promise rejection", expect.objectContaining({ error: "lost" }));
    expect(errorLog).toHaveBeenCalledWith("unhandled promise rejection", expect.objectContaining({ error: "plain text" }));
    expect(errorLog).toHaveBeenCalledWith("uncaught exception", expect.objectContaining({ error: "thrown" }));
    expect(exit).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(1);
  });
});
