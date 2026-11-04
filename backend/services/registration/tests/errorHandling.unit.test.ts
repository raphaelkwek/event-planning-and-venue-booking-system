import { describe, expect, it, vi } from "vitest";
import request from "supertest";

/** C1 and H1 for the registration service: the same final handler as the others, and no database text from /readyz. */

vi.mock("../src/db.js", () => ({
  sql: Object.assign(vi.fn(() => Promise.reject(new Error("password authentication failed"))), { end: vi.fn() }),
}));

const { app } = await import("../src/app.js");
const { errorHandler } = await import("../src/errorHandler.js");
const express = (await import("express")).default;

describe("registration error handling", () => {
  it("a malformed JSON body is a 400 VALIDATION_FAILED envelope", async () => {
    const res = await request(app).post("/anything").set("Content-Type", "application/json").send("{oops");
    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({ code: "VALIDATION_FAILED" });
  });

  it("an async handler that rejects is a 500 INTERNAL_ERROR envelope", async () => {
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);
    const a = express();
    a.get("/boom", async () => {
      throw new Error("db down");
    });
    a.use(errorHandler);
    const res = await request(a).get("/boom").set("X-Correlation-Id", "c-1");
    process.off("unhandledRejection", unhandled);
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("INTERNAL_ERROR");
    expect(res.text).not.toContain("db down");
    expect(unhandled).not.toHaveBeenCalled();
  });

  it("the attendee routes answer in the envelope, behind helmet, the correlation id and no-store", async () => {
    const res = await request(app).get("/api/v1/registrations");
    expect(res.status).toBe(401);
    expect(res.body.error).toMatchObject({ code: "UNAUTHENTICATED", correlationId: res.headers["x-correlation-id"] });
    expect(res.headers["x-correlation-id"]).toBeTruthy();
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });

  it("/readyz does not return the database error", async () => {
    const res = await request(app).get("/readyz");
    expect(res.status).toBe(503);
    expect(res.text).not.toContain("password");
  });
  it("an unknown route is a 404 NOT_FOUND envelope, not Express's HTML page", async () => {
    const res = await request(app).get("/api/v1/does-not-exist").set("X-Correlation-Id", "c-404");
    expect(res.status).toBe(404);
    expect(res.headers["content-type"]).toMatch(/application\/json/);
    expect(res.body.error).toMatchObject({ code: "NOT_FOUND", correlationId: res.headers["x-correlation-id"] });
    expect(res.text).not.toContain("Cannot GET");
    expect(res.text).not.toContain("<html");
  });

  it("an unknown route of any method, outside /api too, answers the same envelope", async () => {
    for (const [method, path] of [["post", "/registration/api/v1/events/x/registrations"], ["delete", "/nothing"], ["get", "/"]] as const) {
      const res = await request(app)[method](path);
      expect(res.status, `${method} ${path}`).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    }
  });

  it("a known path with an unsupported method is also the envelope", async () => {
    const res = await request(app).put("/api/v1/registrations");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});
