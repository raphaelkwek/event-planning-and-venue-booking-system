import { describe, expect, it } from "vitest";
import request from "supertest";

process.env.NODE_ENV = "test";
const { app } = await import("../src/index.js");

describe("health endpoints", () => {
  it("GET /healthz returns 200 ok", async () => {
    const res = await request(app).get("/healthz");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("GET /readyz returns 200 when the database is reachable", async () => {
    const res = await request(app).get("/readyz");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ready");
  });
});
