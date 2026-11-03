import { describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { errorHandler } from "../src/errorHandler.js";
import { patchExpressLayer } from "../src/asyncErrors.js";
import { installProcessGuards } from "../src/processGuards.js";
import { logger } from "../src/logger.js";

/** C1 and H1: the service's own copy of the layer patch, final handler and process guards (see planning-core's errorHandling.unit.test.ts). */

const settle = () => new Promise((resolve) => setImmediate(resolve));

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

describe("patchExpressLayer", () => {
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
    const errorLayer = Object.defineProperty(() => undefined, "length", { value: 4 });
    fakeLayer(errorLayer).handle_request({}, {}, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });
});

describe("errorHandler", () => {
  const appWith = (mount: (a: express.Express) => void) => {
    const a = express();
    a.use(express.json({ limit: "1kb" }));
    mount(a);
    a.use(errorHandler);
    return a;
  };

  it("answers a malformed JSON body with 400 VALIDATION_FAILED", async () => {
    const a = appWith((x) => x.post("/echo", (_req, res) => res.json({})));
    const res = await request(a).post("/echo").set("Content-Type", "application/json").send("{oops");
    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({ code: "VALIDATION_FAILED", message: "The request body is not valid JSON." });
  });

  it("answers an oversized body with 413", async () => {
    const a = appWith((x) => x.post("/echo", (_req, res) => res.json({})));
    const res = await request(a).post("/echo").set("Content-Type", "application/json").send(JSON.stringify({ pad: "x".repeat(4000) }));
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe("VALIDATION_FAILED");
  });

  it("keeps the 4xx of an exposed client error", async () => {
    const a = appWith((x) => x.get("/t", (_req, _res, next) => next(Object.assign(new Error("x"), { statusCode: 418, expose: true }))));
    const res = await request(a).get("/t");
    expect(res.status).toBe(418);
  });

  it("answers anything else with a generic 500, the correlation id from the response header, and logs the detail", async () => {
    const log = vi.spyOn(logger, "error").mockImplementation(() => undefined);
    const a = appWith((x) =>
      x.get("/boom", (_req, res, next) => {
        res.setHeader("x-correlation-id", "c-7");
        next(new Error("secret internals"));
      }),
    );
    const res = await request(a).get("/boom");
    expect(res.status).toBe(500);
    expect(res.body.error).toMatchObject({ code: "INTERNAL_ERROR", correlationId: "c-7" });
    expect(res.text).not.toContain("secret internals");
    expect(log).toHaveBeenCalledWith("request failed", expect.objectContaining({ correlationId: "c-7", error: "secret internals" }));
    log.mockRestore();
  });

  it("takes the correlation id from the request when the response has none, and copes with a non-Error", async () => {
    const log = vi.spyOn(logger, "error").mockImplementation(() => undefined);
    const a = appWith((x) => x.get("/str", (_req, _res, next) => next("just text")));
    const res = await request(a).get("/str").set("X-Correlation-Id", "c-8");
    expect(res.body.error.correlationId).toBe("c-8");
    expect((await request(a).get("/str")).body.error.correlationId).toBeNull();
    log.mockRestore();
  });

  it("hands the error on when the response has started", () => {
    const next = vi.fn();
    const failure = new Error("late");
    errorHandler(failure, {} as never, { headersSent: true } as never, next);
    expect(next).toHaveBeenCalledWith(failure);
  });
});

describe("installProcessGuards", () => {
  it("logs an unhandled rejection and carries on, and logs an uncaught exception and then exits 1", async () => {
    const log = vi.spyOn(logger, "error").mockImplementation(() => undefined);
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
    expect(log).toHaveBeenCalledWith("unhandled promise rejection", expect.objectContaining({ error: "lost" }));
    expect(log).toHaveBeenCalledWith("unhandled promise rejection", expect.objectContaining({ error: "plain text" }));
    expect(log).toHaveBeenCalledWith("uncaught exception", expect.objectContaining({ error: "thrown" }));
    expect(exit).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(1);
    log.mockRestore();
  });

  it("registers on the real process by default", () => {
    const before = process.listenerCount("unhandledRejection");
    installProcessGuards();
    expect(process.listenerCount("unhandledRejection")).toBe(before + 1);
    expect(process.listenerCount("uncaughtException")).toBeGreaterThan(0);
  });
});
