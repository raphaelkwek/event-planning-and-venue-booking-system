import express from "express";
import { rateLimit } from "express-rate-limit";
import { afterEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { InMemoryProvider, OpenFeature } from "@openfeature/server-sdk";
import { FLAG_DOMAIN } from "../../../src/shared/flags/index.js";

// EN-15-T6, the parts that need no database: the route refuses an unauthenticated caller with the
// real token check, answers a signed-in user, and is rate-limited before it authenticates.
vi.mock("../../../src/modules/change/auth/identity.js", async () => {
  const actual = await vi.importActual<typeof import("../../../src/modules/change/auth/identity.js")>(
    "../../../src/modules/change/auth/identity.js",
  );
  return { ...actual, resolveCurrentUser: vi.fn() };
});
vi.mock("../../../src/shared/auth/verifyJwt.js", async () => {
  const actual = await vi.importActual<typeof import("../../../src/shared/auth/verifyJwt.js")>("../../../src/shared/auth/verifyJwt.js");
  return {
    ...actual,
    // Only a header-less request reaches the real check, which refuses it before touching the network.
    verifyJwt: (req: { header(name: string): string | undefined; auth?: unknown }, res: unknown, next: () => void) => {
      if (!req.header("authorization")) return (actual.verifyJwt as (...args: unknown[]) => unknown)(req, res, next);
      req.auth = { supabaseUserId: "subject" };
      next();
    },
  };
});

const { resolveCurrentUser } = await import("../../../src/modules/change/auth/identity.js");
const { featureFlagsRouter } = await import("../../../src/modules/change/api/featureFlags.js");

const passThrough = (_req: unknown, _res: unknown, next: () => void) => next();
const bearer = { Authorization: "Bearer t" };

afterEach(async () => {
  await OpenFeature.clearProviders();
  vi.mocked(resolveCurrentUser).mockReset();
});

describe("GET /api/v1/feature-flags (EN-15-T6)", () => {
  it("refuses a request with no token (EN-15-T6)", async () => {
    const response = await request(express().use(featureFlagsRouter(passThrough))).get("/api/v1/feature-flags");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("answers a signed-in user with the evaluated flags, and evaluates for that user (EN-15-T6)", async () => {
    vi.mocked(resolveCurrentUser).mockResolvedValue({ id: "u1", email: "u@connectsphere.test", role: "VENUE_STAFF" });
    const seen: unknown[] = [];
    await OpenFeature.setProviderAndWait(
      FLAG_DOMAIN,
      new InMemoryProvider({
        "change-approval": {
          disabled: false,
          variants: { on: true, off: false },
          defaultVariant: "off",
          contextEvaluator: (context) => {
            seen.push(context);
            return "off";
          },
        },
      }),
    );

    const response = await request(express().use(featureFlagsRouter(passThrough))).get("/api/v1/feature-flags").set(bearer);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ flags: { "change-approval": false } });
    expect(seen[0]).toMatchObject({ targetingKey: "u1", role: "VENUE_STAFF" });
  });

  it("answers with the defaults when no flag source is configured (EN-15-T6)", async () => {
    vi.mocked(resolveCurrentUser).mockResolvedValue({ id: "u1", email: "u@connectsphere.test", role: "ATTENDEE" });

    const response = await request(express().use(featureFlagsRouter(passThrough))).get("/api/v1/feature-flags").set(bearer);

    expect(response.body).toEqual({ flags: { "change-approval": true } });
  });

  it("passes an identity failure on to the error handler (EN-15-T6)", async () => {
    vi.mocked(resolveCurrentUser).mockRejectedValue(new Error("lookup failed"));
    const app = express().use(featureFlagsRouter(passThrough));
    // Express recognises an error handler by its four parameters.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    app.use((_error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => void res.status(500).json({ handled: true }));

    const response = await request(app).get("/api/v1/feature-flags").set(bearer);

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ handled: true });
  });

  it("rate-limits before it authenticates (EN-15-T6)", async () => {
    const tight = rateLimit({
      windowMs: 60_000,
      limit: 1,
      handler: (_req, res) => void res.status(429).json({ error: { code: "RATE_LIMITED" } }),
    });
    const app = express().use(featureFlagsRouter(tight));

    expect((await request(app).get("/api/v1/feature-flags")).status).toBe(401);
    const second = await request(app).get("/api/v1/feature-flags");

    expect(second.status).toBe(429);
    expect(second.body.error.code).toBe("RATE_LIMITED");
  });
});
