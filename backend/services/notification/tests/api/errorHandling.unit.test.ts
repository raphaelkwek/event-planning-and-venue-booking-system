import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

/**
 * C1, H1, M11 for the notification service: a rejected query is a 500 envelope
 * and not an unhandled rejection that ends the process, a malformed body is a
 * 400 envelope, and the routes are rate-limited before they ask identity who the caller is.
 */

/** A query that fails only when it is awaited, as postgres.js's do: a fragment built and never awaited must not reject. */
const failingQuery = () => ({
  then: (_resolve: unknown, reject: (error: Error) => void) => reject(new Error('relation "notification.notifications" does not exist')),
});

vi.mock("../../src/db.js", () => ({ sql: Object.assign(vi.fn(() => failingQuery()), { end: vi.fn() }) }));

vi.mock("../../src/api/identity.js", async () => {
  const actual = await vi.importActual<typeof import("../../src/api/identity.js")>("../../src/api/identity.js");
  return { ...actual, resolveCaller: vi.fn() };
});

const { app } = await import("../../src/app.js");
const { resolveCaller } = await import("../../src/api/identity.js");
const { notificationsRouter } = await import("../../src/api/notifications.js");
const { logger } = await import("../../src/logger.js");
const express = (await import("express")).default;

const bearer = { Authorization: "Bearer t", "X-Correlation-Id": "corr-9" };
let unhandled: ReturnType<typeof vi.fn>;
let errorLog: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  unhandled = vi.fn();
  process.on("unhandledRejection", unhandled);
  errorLog = vi.spyOn(logger, "error").mockImplementation(() => undefined);
  vi.mocked(resolveCaller).mockResolvedValue({ id: "00000000-0000-0000-0000-000000000001", email: "a@b.test", role: "EVENT_ORGANISER" });
});
afterEach(() => {
  process.off("unhandledRejection", unhandled);
  errorLog.mockRestore();
  vi.mocked(resolveCaller).mockReset();
});

describe("C1: a failed query in a notification route", () => {
  it.each([
    ["GET", "/api/v1/notifications"],
    ["POST", "/api/v1/notifications/read-all"],
    ["POST", "/api/v1/notifications/00000000-0000-0000-0000-0000000000aa/read"],
  ])("%s %s answers a 500 envelope and leaves nothing unhandled", async (method, path) => {
    const res = await request(app)[method === "GET" ? "get" : "post"](path).set(bearer);
    expect(res.status).toBe(500);
    expect(res.type).toBe("application/json");
    expect(res.body.error).toMatchObject({ code: "INTERNAL_ERROR", correlationId: "corr-9" });
    expect(res.text).not.toMatch(/does not exist|notification\.notifications/);
    await new Promise((resolve) => setImmediate(resolve));
    expect(unhandled).not.toHaveBeenCalled();
    expect(errorLog).toHaveBeenCalledWith("request failed", expect.objectContaining({ outcome: "error", correlationId: "corr-9" }));
  });
});

describe("H1: bodies and readiness", () => {
  it("a malformed JSON body is a 400 VALIDATION_FAILED envelope", async () => {
    const res = await request(app).post("/api/v1/notifications/read-all").set("Content-Type", "application/json").send("{oops");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_FAILED");
    expect(res.text).not.toMatch(/SyntaxError|node_modules/);
  });

  it("/readyz does not return the database error", async () => {
    const res = await request(app).get("/readyz");
    expect(res.status).toBe(503);
    expect(res.text).not.toContain("does not exist");
    expect(res.body.error).toBeUndefined();
  });

  it("answers with the hardening headers and no X-Powered-By", async () => {
    const res = await request(app).get("/healthz");
    expect(res.headers["x-powered-by"]).toBeUndefined();
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });
});

describe("M11: the limiter runs before authentication", () => {
  it("refuses with RATE_LIMITED once the budget is spent, without asking identity", async () => {
    const limited = express().use(notificationsRouter({} as never, (_req, res) => {
      res.status(429).json({ error: { code: "RATE_LIMITED" } });
    }));
    const res = await request(limited).get("/api/v1/notifications").set(bearer);
    expect(res.status).toBe(429);
    expect(resolveCaller).not.toHaveBeenCalled();
  });

  it("the default limiter answers 429 in the envelope after 120 requests from one address", async () => {
    const limited = express().use(notificationsRouter({} as never));
    let last = await request(limited).get("/api/v1/notifications");
    for (let i = 0; i < 120; i += 1) last = await request(limited).get("/api/v1/notifications");
    expect(last.status).toBe(429);
    expect(last.body.error.code).toBe("RATE_LIMITED");
  });
});
