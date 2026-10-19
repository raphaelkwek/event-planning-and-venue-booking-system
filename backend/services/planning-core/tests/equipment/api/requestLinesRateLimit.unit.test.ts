import express from "express";
import type { Request, Response } from "express";
import type { Sql } from "postgres";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

// O1/O2: every request line route is rate limited before authentication, by the equipment module's
// shared limiter (CodeQL js/missing-rate-limiting), and the limiter is injectable so tests can pass a no-op.
const { authenticate, roleCheck } = vi.hoisted(() => ({
  authenticate: vi.fn((_req: Request, res: Response) => res.status(401).json({ error: { code: "UNAUTHENTICATED" } })),
  roleCheck: vi.fn(),
}));
vi.mock("../../../src/shared/logger.js", () => ({ logger: { info: vi.fn() } }));
vi.mock("../../../src/modules/equipment/auth/actor.js", () => ({ authenticate, requireRole: () => roleCheck }));
const { equipmentRouter } = await import("../../../src/modules/equipment/index.js");
const { requestLinesRouter } = await import("../../../src/modules/equipment/api/requestLines.js");

const ID = "00000000-0000-0000-0000-000000000001";
const routes = [
  ["get", "/api/v1/equipment/request-lines"],
  ["post", "/api/v1/equipment/request-lines"],
  ["get", `/api/v1/equipment/request-lines/${ID}`],
  ["put", `/api/v1/equipment/request-lines/${ID}`],
  ["post", `/api/v1/equipment/request-lines/${ID}/removal`],
  ["post", `/api/v1/equipment/request-lines/${ID}/status`],
] as const;

beforeEach(() => vi.clearAllMocks());

describe("request line routes and the rate limit", () => {
  it("refuses every route with RATE_LIMITED once the shared budget is spent, before authentication or SQL", async () => {
    const sql = vi.fn();
    const app = express();
    app.use(equipmentRouter(sql as unknown as Sql));
    for (let i = 0; i < 120; i++) {
      const [method, path] = routes[i % routes.length]!;
      expect((await request(app)[method](path)).status).toBe(401);
    }
    expect(authenticate).toHaveBeenCalledTimes(120);

    for (const [method, path] of routes) {
      const response = await request(app)[method](path);
      expect(response.status).toBe(429);
      expect(response.body.error.code).toBe("RATE_LIMITED");
    }
    expect(authenticate).toHaveBeenCalledTimes(120);
    expect(roleCheck).not.toHaveBeenCalled();
    expect(sql).not.toHaveBeenCalled();
  });

  it("takes the limiter as a parameter, so a test can pass a no-op", async () => {
    const limiter = vi.fn((_req: Request, _res: Response, next: () => void) => next());
    const app = express();
    app.use(requestLinesRouter(vi.fn() as unknown as Sql, limiter));
    for (const [method, path] of routes) {
      expect((await request(app)[method](path)).status).toBe(401);
    }
    expect(limiter).toHaveBeenCalledTimes(routes.length);
  });
});
