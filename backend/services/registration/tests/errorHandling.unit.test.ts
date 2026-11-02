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

  it("/readyz does not return the database error", async () => {
    const res = await request(app).get("/readyz");
    expect(res.status).toBe(503);
    expect(res.text).not.toContain("password");
  });
});
