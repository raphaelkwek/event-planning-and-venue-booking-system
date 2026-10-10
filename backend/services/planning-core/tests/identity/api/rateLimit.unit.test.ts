import { describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import type { Sql } from "postgres";

/**
 * Identity's rate limits (CodeQL js/missing-rate-limiting). The limiter runs
 * before anything else on the route, so these requests never reach Supabase or
 * the database: the first ones are refused for their empty body (400), and once
 * the budget is spent the limiter refuses with RATE_LIMITED (429) instead.
 */

vi.mock("../../../src/modules/identity/auth/supabaseAuthClient.js", () => ({
  signInWithPassword: vi.fn(),
  revokeSession: vi.fn(),
}));

const { authRouter } = await import("../../../src/modules/identity/api/auth.js");
const { identityRateLimiter, loginRateLimiter } = await import("../../../src/modules/identity/api/limiter.js");

const noDatabase = {} as Sql;

function appWith(router: express.Router) {
  const app = express();
  app.use(express.json());
  app.use(router);
  return app;
}

describe("loginRateLimiter", () => {
  it("lets requests through up to the limit, then refuses with RATE_LIMITED and the §5 envelope", async () => {
    const app = appWith(authRouter(noDatabase, loginRateLimiter({ limit: 2 })));
    const login = () => request(app).post("/api/v1/auth/login").set("x-correlation-id", "c-1").send({});

    expect((await login()).status).toBe(400);
    expect((await login()).status).toBe(400);
    const refused = await login();

    expect(refused.status).toBe(429);
    expect(refused.body).toEqual({
      error: {
        code: "RATE_LIMITED",
        message: "Too many sign-in attempts. Wait a minute and try again.",
        correlationId: "c-1",
      },
    });
    expect(refused.headers["retry-after"]).toBeDefined();
  });

  it("allows 30 sign-in attempts a minute by default, enough for the functional test runner", async () => {
    const app = appWith(authRouter(noDatabase, loginRateLimiter()));
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 31; attempt += 1) {
      statuses.push((await request(app).post("/api/v1/auth/login").send({})).status);
    }

    expect(statuses.slice(0, 30).every((status) => status === 400)).toBe(true);
    expect(statuses[30]).toBe(429);
  });

  it("also guards sign-out", async () => {
    const app = appWith(authRouter(noDatabase, loginRateLimiter({ limit: 0 })));

    const refused = await request(app).post("/api/v1/auth/logout").send({});

    expect(refused.status).toBe(429);
    expect(refused.body.error.code).toBe("RATE_LIMITED");
  });
});

describe("identityRateLimiter", () => {
  it("refuses with RATE_LIMITED once its budget is spent, and gives no correlation id when none was sent", async () => {
    const router = express.Router();
    router.get("/probe", identityRateLimiter({ limit: 1 }), (_req, res) => {
      res.json({ ok: true });
    });
    const app = appWith(router);

    expect((await request(app).get("/probe")).status).toBe(200);
    const refused = await request(app).get("/probe");

    expect(refused.status).toBe(429);
    expect(refused.body).toEqual({
      error: { code: "RATE_LIMITED", message: "Too many requests. Wait a minute and try again.", correlationId: null },
    });
  });
});
