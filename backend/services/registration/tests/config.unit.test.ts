import { describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import { positiveIntFromEnv } from "../src/config.js";
import { registrationRateLimiter } from "../src/api/limiter.js";

/**
 * EN-18: the two settings the load tests and the autoscaling sizing turn on,
 * the database pool and the rate limit. Both default to what the service
 * always did, and a value that is not a positive whole number stops start-up.
 */

describe("positiveIntFromEnv (EN-18)", () => {
  it("uses the fallback when the setting is absent or blank", () => {
    expect(positiveIntFromEnv({}, "REGISTRATION_DB_POOL_MAX", 5)).toBe(5);
    expect(positiveIntFromEnv({ REGISTRATION_DB_POOL_MAX: "  " }, "REGISTRATION_DB_POOL_MAX", 5)).toBe(5);
  });

  it("reads a positive whole number, ignoring surrounding spaces", () => {
    expect(positiveIntFromEnv({ REGISTRATION_DB_POOL_MAX: " 12 " }, "REGISTRATION_DB_POOL_MAX", 5)).toBe(12);
    expect(positiveIntFromEnv({ REGISTRATION_DB_POOL_MAX: "1" }, "REGISTRATION_DB_POOL_MAX", 5)).toBe(1);
  });

  it.each(["0", "-3", "2.5", "many", "1e3x"])("refuses %s, naming the setting", (bad) => {
    expect(() => positiveIntFromEnv({ REGISTRATION_RATE_LIMIT_PER_MINUTE: bad }, "REGISTRATION_RATE_LIMIT_PER_MINUTE", 120)).toThrow(
      /REGISTRATION_RATE_LIMIT_PER_MINUTE must be a positive whole number/,
    );
  });
});

describe("registrationRateLimiter (EN-18)", () => {
  const appWith = (limiter: express.RequestHandler) => {
    const app = express();
    app.use(limiter);
    app.get("/ping", (_req, res) => res.json({ ok: true }));
    return app;
  };

  it("allows the number of requests a minute it is given, then refuses with RATE_LIMITED", async () => {
    const app = appWith(registrationRateLimiter(3));
    for (let i = 0; i < 3; i++) await request(app).get("/ping").expect(200);
    const refused = await request(app).get("/ping").expect(429);
    expect(refused.body.error.code).toBe("RATE_LIMITED");
  });

  it("keeps 120 a minute when it is given no number", async () => {
    const app = appWith(registrationRateLimiter());
    const first = await request(app).get("/ping").expect(200);
    expect(first.headers["ratelimit"] ?? first.headers["ratelimit-policy"]).toContain("120");
  });
});
