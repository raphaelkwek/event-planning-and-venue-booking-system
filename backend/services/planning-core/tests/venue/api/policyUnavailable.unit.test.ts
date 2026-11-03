import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Sql } from "postgres";

/**
 * EN-07-T3: with the policy decision point unreachable, Venue Staff's POST and GET
 * /api/v1/venues are refused with 503 POLICY_UNAVAILABLE, and nothing reaches the
 * database: the venue router is given one that throws if it is touched at all.
 */

vi.mock("../../../src/shared/auth/verifyJwt.js", () => ({
  verifyJwt: (req: { auth?: { supabaseUserId?: string } }, _res: unknown, next: () => void) => {
    req.auth = { supabaseUserId: "t3-subject" };
    next();
  },
}));
vi.mock("../../../src/modules/venue/auth/identity.js", async (actual) => ({
  ...(await actual<object>()),
  resolveCurrentUser: async () => ({ id: "7e070003-0000-4000-8000-000000000001", email: "venue-staff@connectsphere.test", role: "VENUE_STAFF" }),
}));

const { venuesRouter } = await import("../../../src/modules/venue/api/venues.js");
const pdpModule = await import("../../../src/shared/authz/pdp.js");
const { POLICY_UNAVAILABLE_MESSAGE } = await import("../../../src/shared/authz/gate.js");

const touched: string[] = [];
const untouchable = new Proxy(() => undefined, {
  apply: () => {
    touched.push("query");
    throw new Error("the database was touched");
  },
  get: (_target, key) => {
    touched.push(String(key));
    throw new Error("the database was touched");
  },
}) as unknown as Sql;
const noLimit = (_req: unknown, _res: unknown, next: () => void) => next();

const venue = {
  name: "EN-07-T3 Hall",
  building: "School of Computing",
  maxCapacity: 100,
  layouts: [{ name: "Theatre", capacity: 100 }],
  facilities: ["Projector"],
  accessibilityFeatures: ["Step-free access"],
  operatingHours: {},
};

afterEach(() => {
  vi.restoreAllMocks();
  touched.length = 0;
});

describe("an unreachable policy decision point (EN-07-T3)", () => {
  it("EN-07-T3 refuses Venue Staff's POST and GET /api/v1/venues with 503 POLICY_UNAVAILABLE and stores nothing", async () => {
    vi.spyOn(pdpModule.pdp, "reach").mockRejectedValue(new pdpModule.PolicyUnavailableError("connect ECONNREFUSED 127.0.0.1:1"));
    const app = express();
    app.use(express.json());
    app.use(venuesRouter(untouchable, noLimit));

    const created = await request(app).post("/api/v1/venues").set({ Authorization: "Bearer t" }).send(venue);
    const listed = await request(app).get("/api/v1/venues").set({ Authorization: "Bearer t" });

    for (const response of [created, listed]) {
      expect(response.status).toBe(503);
      expect(response.body.error).toMatchObject({ code: "POLICY_UNAVAILABLE", message: POLICY_UNAVAILABLE_MESSAGE });
    }
    expect(POLICY_UNAVAILABLE_MESSAGE).toMatch(/could not be checked.*Nothing was changed/);
    expect(touched).toEqual([]);
  });
});
