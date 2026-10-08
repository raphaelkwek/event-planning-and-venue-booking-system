import express from "express";
import type { Request, Response } from "express";
import type { Sql } from "postgres";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { authenticate, roleCheck } = vi.hoisted(() => ({
  authenticate: vi.fn((_req: Request, res: Response) => res.status(401).json({ error: { code: "UNAUTHENTICATED" } })),
  roleCheck: vi.fn(),
}));
vi.mock("../../../src/shared/logger.js", () => ({ logger: { info: vi.fn() } }));
vi.mock("../../../src/modules/equipment/auth/actor.js", () => ({ authenticate, requireRole: () => roleCheck }));
const { equipmentRouter } = await import("../../../src/modules/equipment/index.js");
// Every equipment endpoint, P1's and P2's, through the module router that shares one limiter.
const routes = [
  ["get", "/api/v1/equipment/types"],
  ["get", "/api/v1/equipment/types/00000000-0000-0000-0000-000000000001"],
  ["post", "/api/v1/equipment/types"],
  ["put", "/api/v1/equipment/types/00000000-0000-0000-0000-000000000001"],
  ["post", "/api/v1/equipment/types/00000000-0000-0000-0000-000000000001/unavailability"],
  ["get", "/api/v1/equipment/types/00000000-0000-0000-0000-000000000001/availability"],
] as const;

function build() {
  const sql = vi.fn();
  const app = express();
  app.use((req, res, next) => {
    res.setHeader("x-correlation-id", "limiter-regression");
    // Assign fixture IPs without changing production's proxy trust policy.
    Object.defineProperty(req, "ip", { value: req.header("x-test-ip") ?? "192.0.2.1" });
    next();
  });
  app.use(equipmentRouter(sql as unknown as Sql));
  return { app, sql };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-08T00:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("equipment route rate limiting before authentication", () => {
  it("shares the real 120/minute budget across every endpoint and token, then refuses before auth/SQL", async () => {
    const { app, sql } = build();
    for (let i = 0; i < 120; i++) {
      const [method, path] = routes[i % routes.length]!;
      const response = await request(app)[method](path).set("Authorization", `Bearer changing-${i}`);
      expect(response.status).toBe(401);
    }
    expect(authenticate).toHaveBeenCalledTimes(120);
    for (const [method, path] of routes) {
      const response = await request(app)[method](path).set("Authorization", "Bearer another-token");
      expect(response.status).toBe(429);
      expect(response.body).toEqual({ error: {
        code: "RATE_LIMITED",
        message: "Too many equipment requests. Try again after the Retry-After period.",
        correlationId: "limiter-regression",
      } });
      expect(response.headers["retry-after"]).toBe("60");
      expect(response.headers["ratelimit"]).toContain("limit=120, remaining=0");
      expect(response.headers["x-ratelimit-limit"]).toBeUndefined();
    }
    expect(authenticate).toHaveBeenCalledTimes(120);
    expect(roleCheck).not.toHaveBeenCalled();
    expect(sql).not.toHaveBeenCalled();
  });

  it("allows requests again after the minute expires", async () => {
    const { app } = build();
    for (let i = 0; i < 120; i++) await request(app).get(routes[0][1]);
    expect((await request(app).get(routes[0][1])).status).toBe(429);
    vi.setSystemTime(new Date("2026-10-08T00:01:01Z"));
    const response = await request(app).get(routes[0][1]);
    expect(response.status).toBe(401);
    expect(response.headers["ratelimit"]).toContain("remaining=119");
    expect(authenticate).toHaveBeenCalledTimes(121);
  });

  it("keeps distinct client IP budgets independent", async () => {
    const { app } = build();
    for (let i = 0; i < 120; i++) await request(app).get(routes[0][1]);
    expect((await request(app).get(routes[0][1])).status).toBe(429);
    const response = await request(app).get(routes[0][1]).set("x-test-ip", "192.0.2.2");
    expect(response.status).toBe(401);
    expect(response.headers["ratelimit"]).toContain("remaining=119");
    expect(authenticate).toHaveBeenCalledTimes(121);
  });
});
