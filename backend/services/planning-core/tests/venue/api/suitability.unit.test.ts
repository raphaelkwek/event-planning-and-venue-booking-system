import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import type { Sql } from "postgres";

/**
 * K1 — the suitability route with its collaborators stood in for (the venue
 * lookup, the event module, identity), so it needs no database. The database
 * run is suitability.test.ts.
 */

vi.mock("../../../src/shared/auth/verifyJwt.js", () => ({
  verifyJwt: (req: { auth?: { supabaseUserId?: string } }, _res: unknown, next: () => void) => {
    req.auth = { supabaseUserId: "test-subject" };
    next();
  },
}));
vi.mock("../../../src/modules/venue/auth/identity.js", async () => {
  const actual = await vi.importActual<typeof import("../../../src/modules/venue/auth/identity.js")>(
    "../../../src/modules/venue/auth/identity.js",
  );
  return { ...actual, resolveCurrentUser: vi.fn() };
});
vi.mock("../../../src/modules/venue/repo/venues.js", () => ({ findVenue: vi.fn() }));
vi.mock("../../../src/modules/event/index.js", () => ({ findEventForPlanning: vi.fn() }));

const { resolveCurrentUser } = await import("../../../src/modules/venue/auth/identity.js");
const { findVenue } = await import("../../../src/modules/venue/repo/venues.js");
const { findEventForPlanning } = await import("../../../src/modules/event/index.js");
const { suitabilityRouter } = await import("../../../src/modules/venue/api/suitability.js");

const VENUE_ID = "11111111-1111-4111-8111-111111111111";
const EVENT_ID = "22222222-2222-4222-8222-222222222222";
const COORDINATOR = "33333333-3333-4333-8333-333333333333";
const noLimit = (_req: unknown, _res: unknown, next: () => void) => next();
const sql = {} as Sql;
const bearer = { Authorization: "Bearer test-token" };

const venue = {
  id: VENUE_ID,
  name: "K1 Test Hall",
  layouts: [{ name: "Theatre", capacity: 120 }],
  facilities: ["Projector"],
  accessibilityFeatures: ["Hearing loop"],
  operatingHours: { monday: { opensAt: "08:00", closesAt: "22:00" } },
};
const event = {
  id: EVENT_ID,
  reference: "EVT-000001",
  expectedAttendance: 150,
  venueRequirements: { layout: "Theatre", facilities: ["Projector"] },
  accessibilityNeeds: "Hearing loop",
  proposedStartAt: "2026-12-07T02:00:00.000Z",
  proposedEndAt: "2026-12-07T04:00:00.000Z",
};

function app() {
  const server = express();
  server.use(suitabilityRouter(sql, noLimit));
  return server;
}
const check = (venueId = VENUE_ID, query: Record<string, string> = { eventId: EVENT_ID }) =>
  request(app()).get(`/api/v1/venues/${venueId}/suitability`).query(query).set(bearer);

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(resolveCurrentUser).mockResolvedValue({ id: COORDINATOR, email: "c@connectsphere.test", role: "EVENT_COORDINATOR" } as never);
  vi.mocked(findVenue).mockResolvedValue(venue as never);
  vi.mocked(findEventForPlanning).mockResolvedValue(event as never);
});

describe("GET /api/v1/venues/:id/suitability", () => {
  it("returns the status and every failing condition with the values compared (K1 AC1 to AC3)", async () => {
    const res = await check();

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      venueId: VENUE_ID,
      venueName: "K1 Test Hall",
      eventId: EVENT_ID,
      eventReference: "EVT-000001",
      status: "NOT_SUITABLE",
      warnings: [],
    });
    expect(res.body.reasons).toEqual([
      {
        condition: "LAYOUT_CAPACITY",
        outcome: "FAILED",
        required: 150,
        available: 120,
        message: "Expected attendance 150 against layout capacity 120 (Theatre).",
      },
    ]);
  });

  it("reads the event under the coordinator's own scope", async () => {
    await check();

    expect(findEventForPlanning).toHaveBeenCalledWith(sql, EVENT_ID, { scopeType: "ALL" }, COORDINATOR);
  });

  it("returns Suitable with no reasons when nothing fails (K1 AC6)", async () => {
    vi.mocked(findEventForPlanning).mockResolvedValue({ ...event, expectedAttendance: 120 } as never);

    const res = await check();

    expect(res.body).toMatchObject({ status: "SUITABLE", reasons: [], warnings: [] });
  });

  it.each(["EVENT_ORGANISER", "VENUE_STAFF", "TECH_SUPPORT_STAFF", "ATTENDEE"])("refuses %s (K1-T12)", async (role) => {
    vi.mocked(resolveCurrentUser).mockResolvedValue({ id: COORDINATOR, email: "u@connectsphere.test", role } as never);

    const res = await check();

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("ROLE_NOT_AUTHORISED");
    expect(findEventForPlanning).not.toHaveBeenCalled();
  });

  it("refuses a request without an event id, naming the field", async () => {
    const res = await check(VENUE_ID, {});

    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({ code: "VALIDATION_FAILED", fields: [{ field: "eventId" }] });
  });

  it("refuses an event id that is not a UUID", async () => {
    expect((await check(VENUE_ID, { eventId: "not-a-uuid" })).status).toBe(400);
  });

  it("answers 404 for a venue that does not exist, and for an id that is not a UUID", async () => {
    vi.mocked(findVenue).mockResolvedValue(null);
    const missing = await check();
    const malformed = await check("not-a-uuid");

    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe("VENUE_NOT_FOUND");
    expect(malformed.status).toBe(404);
    expect(findVenue).toHaveBeenCalledTimes(1);
  });

  it("answers 404 for an event that does not exist or is outside the caller's scope", async () => {
    vi.mocked(findEventForPlanning).mockResolvedValue(null);

    const res = await check();

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("EVENT_NOT_FOUND");
  });
});
