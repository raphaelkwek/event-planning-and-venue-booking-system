import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { testDb } from "../../support/testDb.js";
import { actorsWithPrefix, cleanLineFixtures, createBulkType, createEvent, insertLineDirect } from "../../support/lineFixtures.js";
import { cleanVenueFixtures } from "../../support/venueFixtures.js";
import { EVENT_END, EVENT_START } from "../../support/eventDates.js";

// S3 AC8 against real Postgres (CI's throwaway database): who reads an event's outstanding flags.
// JWT verification and the identity lookups are replaced, as in the S1 and S2 card tests.
vi.mock("../../../src/shared/auth/verifyJwt.js", () => ({
  verifyJwt: (req: { auth?: { supabaseUserId?: string } }, _res: unknown, next: () => void) => {
    req.auth = { supabaseUserId: "s3-flags-subject" };
    next();
  },
}));
vi.mock("../../../src/modules/change/auth/identity.js", async () => {
  const actual = await vi.importActual<typeof import("../../../src/modules/change/auth/identity.js")>(
    "../../../src/modules/change/auth/identity.js",
  );
  return { ...actual, resolveCurrentUser: vi.fn() };
});

const { resolveCurrentUser } = await import("../../../src/modules/change/auth/identity.js");
const { app } = await import("../../../src/app.js");
const { flagBookings } = await import("../../../src/modules/venue/index.js");
const { flagReservations } = await import("../../../src/modules/equipment/index.js");
const { reserveLine } = await import("../../../src/modules/equipment/repo/reservations.js");

const sql = testDb();
const A = actorsWithPrefix("0c300000");
const OTHER_ORG = "0c300000-0000-4000-8000-000000000007";
const bearer = { Authorization: "Bearer s3-flags-token" };

type Role = "EVENT_COORDINATOR" | "EVENT_ORGANISER" | "VENUE_STAFF";
function signedInAs(userId: string, role: Role) {
  vi.mocked(resolveCurrentUser).mockResolvedValue({ id: userId, email: "s3@connectsphere.test", role });
}

const read = (eventId: string) => request(app).get(`/api/v1/events/${eventId}/arrangement-flags`).set(bearer);

async function clean() {
  await cleanVenueFixtures(sql, A.vs);
  await cleanLineFixtures(sql, [A.org, OTHER_ORG], [A.ts]);
}

/** An event with one confirmed booking and one reservation, both flagged, unless `flagged` is false. */
async function fixture(flagged = true) {
  const event = await createEvent(sql, { ownerId: A.org, coordinatorId: A.c1, name: "S3 flags event" });
  const suffix = randomUUID().slice(0, 6);
  const [venue] = await sql<{ id: string; name: string }[]>`
    insert into venue.venues (name, building, max_capacity, layouts, operating_hours, created_by, updated_by)
    values (${`S3 Flags Venue ${suffix}`}, 'S3 Test Building', 100, ${sql.json([{ name: "Theatre", capacity: 100 }])}, ${sql.json({})}, ${A.vs}, ${A.vs})
    returning id, name
  `;
  const [slot] = await sql<{ id: string }[]>`
    insert into venue.venue_slots (venue_id, event_id, reference, starts_at, ends_at, status, created_by, updated_by)
    values (${venue!.id}, ${event.id}, ${`BKR-S3F${suffix}`}, ${EVENT_START}, ${EVENT_END}, 'CONFIRMED', ${A.vs}, ${A.vs})
    returning id
  `;
  const chairs = await createBulkType(sql, A.ts, `S3 Flags Chairs ${suffix}`, 20);
  const lineId = await insertLineDirect(sql, { event, equipmentTypeId: chairs.id, requestedBy: A.c1, status: "CONFIRMED", quantity: 4 });
  const reserved = await sql.begin((tx) =>
    reserveLine(tx, lineId, { quantity: null, partial: false }, { userId: A.ts, role: "TECH_SUPPORT_STAFF" }),
  );
  if (!reserved.ok) throw new Error(`fixture reserve failed: ${reserved.code}`);
  const reservationId = reserved.reservation.id;
  if (flagged) {
    const changeRequestId = randomUUID();
    await sql.begin(async (tx) => {
      await flagBookings(tx, event.id, changeRequestId, [
        { bookingId: slot!.id, flag: "REQUIRES_RECONFIRMATION", reason: "The booking is no longer for the event's period.", details: {} },
      ]);
      await flagReservations(tx, event.id, changeRequestId, [
        { reservationId, flag: "FLAGGED_FOR_REVIEW", reason: "The reservation is no longer for the event's period.", details: {} },
      ]);
    });
  }
  return { event, bookingId: slot!.id, bookingReference: `BKR-S3F${suffix}`, venueName: venue!.name, reservationId, typeName: chairs.name };
}

beforeAll(clean);
beforeEach(clean);
afterAll(async () => {
  try {
    await clean();
  } finally {
    await sql.end();
  }
});

describe("GET /api/v1/events/:id/arrangement-flags (S3 AC8)", () => {
  async function expectBothFlags(response: request.Response, f: Awaited<ReturnType<typeof fixture>>) {
    expect(response.status).toBe(200);
    expect(response.body.flags).toEqual([
      {
        arrangement: "BOOKING",
        id: f.bookingId,
        reference: f.bookingReference,
        name: f.venueName,
        flag: "REQUIRES_RECONFIRMATION",
        reason: "The booking is no longer for the event's period.",
        flaggedAt: expect.any(String),
      },
      {
        arrangement: "EQUIPMENT",
        id: f.reservationId,
        reference: f.reservationId,
        name: f.typeName,
        flag: "FLAGGED_FOR_REVIEW",
        reason: "The reservation is no longer for the event's period.",
        flaggedAt: expect.any(String),
      },
    ]);
  }

  it("shows the owning organiser every outstanding flag, bookings first", async () => {
    const f = await fixture();
    signedInAs(A.org, "EVENT_ORGANISER");
    await expectBothFlags(await read(f.event.id), f);
  });

  it("shows the assigned coordinator", async () => {
    const f = await fixture();
    signedInAs(A.c1, "EVENT_COORDINATOR");
    await expectBothFlags(await read(f.event.id), f);
  });

  it("shows an Event Coordinator who is not assigned", async () => {
    const f = await fixture();
    signedInAs(A.c2, "EVENT_COORDINATOR");
    await expectBothFlags(await read(f.event.id), f);
  });

  it("answers 404 EVENT_NOT_FOUND to an organiser who does not own the event, as for an unknown event", async () => {
    const f = await fixture();
    signedInAs(OTHER_ORG, "EVENT_ORGANISER");
    const other = await read(f.event.id);
    const unknown = await read(randomUUID());
    const malformed = await read("not-a-uuid");
    expect(other.status).toBe(404);
    expect(other.body.error.code).toBe("EVENT_NOT_FOUND");
    expect(unknown.status).toBe(404);
    expect(unknown.body).toEqual(other.body);
    expect(malformed.status).toBe(404);
    expect(malformed.body).toEqual(other.body);
  });

  it("answers 404 to Venue Staff, whose access scope covers no event", async () => {
    const f = await fixture();
    signedInAs(A.vs, "VENUE_STAFF");
    expect((await read(f.event.id)).status).toBe(404);
  });

  it("answers an empty list when nothing is flagged", async () => {
    const f = await fixture(false);
    signedInAs(A.org, "EVENT_ORGANISER");
    const response = await read(f.event.id);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ flags: [] });
  });
});
