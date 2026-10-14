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
vi.mock("../../../src/modules/event/auth/actor.js", () => ({ authenticate: [authenticate], requireRole: () => roleCheck }));
const { statusHistoryRouter } = await import("../../../src/modules/event/api/statusHistory.js");

const ID = "00000000-0000-0000-0000-000000000001";
const routes = [`/api/v1/events/${ID}/status`, `/api/v1/events/${ID}/status-history`];

function build() {
  const sql = vi.fn();
  const app = express();
  app.use((req, res, next) => {
    res.setHeader("x-correlation-id", "limiter-regression");
    Object.defineProperty(req, "ip", { value: req.header("x-test-ip") ?? "192.0.2.1" });
    next();
  });
  app.use(statusHistoryRouter(sql as unknown as Sql));
  return { app, sql };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-12T00:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("status and history rate limiting before authentication (F2)", () => {
  it("shares a 120/minute budget across both routes, then refuses before auth and SQL", async () => {
    const { app, sql } = build();

    for (let i = 0; i < 120; i += 1) {
      await request(app).get(routes[i % 2]!).set("Authorization", `Bearer token-${i}`);
    }
    expect(authenticate).toHaveBeenCalledTimes(120);

    for (const path of routes) {
      const response = await request(app).get(path).set("Authorization", "Bearer another-token");
      expect(response.status).toBe(429);
      expect(response.body.error).toMatchObject({ code: "RATE_LIMITED", correlationId: "limiter-regression" });
      expect(response.headers["retry-after"]).toBeDefined();
    }
    expect(authenticate).toHaveBeenCalledTimes(120);
    expect(sql).not.toHaveBeenCalled();
  });

  it("keeps separate budgets for separate client addresses", async () => {
    const { app } = build();
    for (let i = 0; i < 120; i += 1) await request(app).get(routes[0]!).set("x-test-ip", "192.0.2.10");

    const blocked = await request(app).get(routes[0]!).set("x-test-ip", "192.0.2.10");
    const other = await request(app).get(routes[0]!).set("x-test-ip", "192.0.2.11");

    expect(blocked.status).toBe(429);
    expect(other.status).toBe(401);
  });

  it("starts a new budget after the minute", async () => {
    const { app } = build();
    for (let i = 0; i < 121; i += 1) await request(app).get(routes[0]!);
    vi.setSystemTime(new Date("2026-10-12T00:01:01Z"));

    expect((await request(app).get(routes[0]!)).status).toBe(401);
  });
});
