import { describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import { expectedClaims } from "../../src/shared/auth/jwtClaims.js";
import { subjectRateLimiter, identityRateLimiter } from "../../src/modules/identity/api/limiter.js";

describe("L13: the claims a bearer token must carry", () => {
  it("defaults to Supabase's audience and an issuer derived from SUPABASE_URL", () => {
    expect(expectedClaims({ SUPABASE_URL: "https://abc.supabase.co" })).toEqual({
      issuer: "https://abc.supabase.co/auth/v1",
      audience: "authenticated",
    });
  });

  it("ignores trailing slashes and spaces in SUPABASE_URL", () => {
    expect(expectedClaims({ SUPABASE_URL: " https://abc.supabase.co// " }).issuer).toBe("https://abc.supabase.co/auth/v1");
  });

  it("checks no issuer when there is neither JWT_ISSUER nor SUPABASE_URL", () => {
    expect(expectedClaims({})).toEqual({ audience: "authenticated" });
  });

  it("lets JWT_ISSUER and JWT_AUDIENCE override, for a stand-in auth server", () => {
    expect(expectedClaims({ SUPABASE_URL: "https://x.supabase.co", JWT_ISSUER: "http://fake-auth/auth/v1", JWT_AUDIENCE: "fake" })).toEqual({
      issuer: "http://fake-auth/auth/v1",
      audience: "fake",
    });
  });

  it("an empty JWT_ISSUER or JWT_AUDIENCE stops checking that claim", () => {
    expect(expectedClaims({ SUPABASE_URL: "https://x.supabase.co", JWT_ISSUER: "", JWT_AUDIENCE: "" })).toEqual({});
  });
});

describe("L10: the identity budget is per verified subject, not per address", () => {
  function appWith(subjectOf: (req: express.Request) => string | undefined) {
    const app = express();
    app.get(
      "/me",
      (req, _res, next) => {
        const subject = subjectOf(req);
        if (subject) (req as unknown as { auth: { supabaseUserId: string } }).auth = { supabaseUserId: subject };
        next();
      },
      subjectRateLimiter({ limit: 2 }),
      (_req, res) => {
        res.json({ ok: true });
      },
    );
    return app;
  }
  const bySubject = (req: express.Request) => req.header("x-test-subject");

  it("one user's requests do not spend another's budget, from the same address", async () => {
    const app = appWith(bySubject);
    for (let i = 0; i < 2; i += 1) expect((await request(app).get("/me").set("x-test-subject", "alice")).status).toBe(200);
    const refused = await request(app).get("/me").set("x-test-subject", "alice");
    expect(refused.status).toBe(429);
    expect(refused.body.error.code).toBe("RATE_LIMITED");
    expect((await request(app).get("/me").set("x-test-subject", "bob")).status).toBe(200);
  });

  it("falls back to the address when no subject was verified", async () => {
    const app = appWith(() => undefined);
    await request(app).get("/me");
    await request(app).get("/me");
    expect((await request(app).get("/me")).status).toBe(429);
  });

  it("the pre-verification address limiter can be set well above a single user's budget", async () => {
    const app = express();
    app.get("/me", identityRateLimiter({ limit: 1200 }), (_req, res) => {
      res.json({ ok: true });
    });
    for (let i = 0; i < 150; i += 1) expect((await request(app).get("/me")).status).toBe(200);
  });
});
