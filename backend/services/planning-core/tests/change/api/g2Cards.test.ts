import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { testDb } from "../../support/testDb.js";
import { actorsWithPrefix, cleanLineFixtures } from "../../support/lineFixtures.js";
import { cleanVenueFixtures } from "../../support/venueFixtures.js";
import { confirmedBooking, newVenue, reservedChairs } from "../../support/s3Fixtures.js";
import { seedEvent } from "../../support/seedEvent.js";
import { EVENT_END, EVENT_START } from "../../support/eventDates.js";
import { formatPeriod } from "../../../src/modules/change/domain/formatPeriod.js";

// The G2 cards (tests/G2): real Express app and migrated Postgres, with JWT verification and the
// identity lookups replaced, as the S3 cards (tests/change/api/s3Cards.test.ts) do. FX-G2 is FX-S3:
// its change request is made through S1's real route, its venues, bookings and reservation are the
// direct inserts of tests/support/s3Fixtures.ts, and G2-T7's decided request is approved through
// S2's real route. Every card previews through GET /api/v1/change-requests/{id}/impact.
vi.mock("../../../src/shared/auth/verifyJwt.js", () => ({
  verifyJwt: (req: { auth?: { supabaseUserId?: string } }, _res: unknown, next: () => void) => {
    req.auth = { supabaseUserId: "g2-card-subject" };
    next();
  },
}));
vi.mock("../../../src/modules/change/auth/identity.js", async () => {
  const actual = await vi.importActual<typeof import("../../../src/modules/change/auth/identity.js")>(
    "../../../src/modules/change/auth/identity.js",
  );
  return { ...actual, resolveCurrentUser: vi.fn() };
});
vi.mock("../../../src/modules/event/auth/identity.js", async () => {
  const actual = await vi.importActual<typeof import("../../../src/modules/event/auth/identity.js")>(
    "../../../src/modules/event/auth/identity.js",
  );
  return { ...actual, resolveCurrentUser: vi.fn() };
});

const { resolveCurrentUser: resolveChangeUser } = await import("../../../src/modules/change/auth/identity.js");
const { resolveCurrentUser: resolveEventUser } = await import("../../../src/modules/event/auth/identity.js");
const { app } = await import("../../../src/app.js");

const sql = testDb();
/** O = org, C = c1, C2 = c2, VS = vs, T = ts (tests/G2/README.md). O2 owns nothing here. */
const A = actorsWithPrefix("0c620000");
const O2 = "0c620000-0000-4000-8000-000000000007";
const bearer = { Authorization: "Bearer g2-card-token" };

type Role = "EVENT_COORDINATOR" | "TECH_SUPPORT_STAFF" | "EVENT_ORGANISER" | "VENUE_STAFF" | "ATTENDEE";
function signedInAs(userId: string, role: Role) {
  const user = { id: userId, email: "g2@connectsphere.test", role };
  vi.mocked(resolveChangeUser).mockResolvedValue(user);
  vi.mocked(resolveEventUser).mockResolvedValue(user);
}
const asO = () => signedInAs(A.org, "EVENT_ORGANISER");
const asO2 = () => signedInAs(O2, "EVENT_ORGANISER");
const asC = () => signedInAs(A.c1, "EVENT_COORDINATOR");
const asC2 = () => signedInAs(A.c2, "EVENT_COORDINATOR");
const asVS = () => signedInAs(A.vs, "VENUE_STAFF");

/** "D hh:mm" of the cards: UTC on day D, sixty days ahead (tests/support/eventDates.ts). */
const D = EVENT_START.slice(0, 10);
const at = (hhmm: string) => `${D}T${hhmm}:00.000Z`;
/** The periods S3's reasons quote, in the wording the implementation uses (Singapore time). */
const WAS = formatPeriod(at("14:00"), at("18:00"));
const NOW_FROM_15 = formatPeriod(at("15:00"), at("18:00"));
const bookingMovedReason = `The booking is for ${WAS}, but the event is now ${NOW_FROM_15}.`;
const reservationMovedReason = `The reservation is for ${WAS}, but the event is now ${NOW_FROM_15}.`;

const DATE_MOVED = { proposedStartAt: at("15:00") };
const ATTENDANCE_150 = { expectedAttendance: 150 };
const LECTERN = { venueRequirements: { notes: "Stage with a lectern" } };

async function clean() {
  const events = sql`select id from event.events where owner_id in (${A.org}, ${O2})`;
  const requests = sql`select id from change.change_requests where event_id in (${events})`;
  await sql`delete from change.outbox where message_key in (select id::text from (${events}) e)`;
  await sql`delete from change.change_request_fields where request_id in (${requests})`;
  await sql`delete from change.change_requests where event_id in (${events})`;
  await cleanVenueFixtures(sql, A.vs);
  await cleanLineFixtures(sql, [A.org, O2], [A.ts]);
}

interface Fx {
  event: { id: string; reference: string; name: string };
  v1: { id: string; name: string };
  v2: { id: string; name: string };
  b1: { id: string; reference: string };
  b2: { id: string; reference: string };
  r1: { id: string; typeName: string };
  cr: string;
}

/**
 * FX-G2 = FX-S3: event E (owned by O, assigned to C, Planning, D 14:00 to D 18:00, 80 attending),
 * venues V1 (Theatre, 100) and V2 (Hall, 200) looked after by VS, confirmed bookings B1 and B2 for
 * E's period, reservation R1 by T, and O's pending change request CR with `changes`, made through
 * S1's route. Every call builds its own, with its own references. Leaves C signed in.
 */
async function fixture(changes: Record<string, unknown>): Promise<Fx> {
  const name = "G2 fixture event";
  const id = await seedEvent(sql, { ownerId: A.org, status: "PLANNING", endsAt: new Date(EVENT_END), name });
  await sql`update event.events set expected_attendance = 80, equipment_required = true where id = ${id}`;
  await sql`insert into event.assignments (event_id, coordinator_id, assignment_rule) values (${id}, ${A.c1}, 'TEST_FIXTURE')`;
  const [row] = await sql<{ reference: string }[]>`select reference from event.events where id = ${id}`;
  const event = { id, reference: row!.reference, name };

  const suffix = randomUUID().slice(0, 6);
  const v1 = await newVenue(sql, A.vs, "Venue One", "Theatre", 100);
  const v2 = await newVenue(sql, A.vs, "Venue Two", "Hall", 200);
  const booking = async (venueId: string, reference: string, layout: string) => ({
    id: await confirmedBooking(sql, { staffId: A.vs, requestedBy: A.c1, venueId, eventId: id, reference, layout }),
    reference,
  });
  const b1 = await booking(v1.id, `BKR-G2A${suffix}`, "Theatre");
  const b2 = await booking(v2.id, `BKR-G2B${suffix}`, "Hall");
  const reserved = await reservedChairs(sql, { event, requestedBy: A.c1, reservedBy: A.ts, quantity: 4, suffix });
  const r1 = { id: reserved.reservationId, typeName: reserved.chairs.name };

  asO();
  const created = await request(app)
    .post(`/api/v1/events/${id}/change-requests`)
    .set(bearer)
    .send({ reason: "G2 card change", changes });
  expect(created.status).toBe(201);
  asC();
  return { event, v1, v2, b1, b2, r1, cr: created.body.id as string };
}

const preview = (cr: string) => request(app).get(`/api/v1/change-requests/${cr}/impact`).set(bearer);
const decide = (cr: string) => request(app).post(`/api/v1/change-requests/${cr}/decision`).set(bearer).send({ decision: "APPROVE" });

type FlagView = { arrangement: string; id: string; reference: string; name: string; flag: string; reason: string };
const sorted = (flags: FlagView[]) => [...flags].sort((a, b) => `${a.id}/${a.flag}`.localeCompare(`${b.id}/${b.flag}`));
const bookingFlag = (fx: Fx, which: "b1" | "b2", flag: string, reason: string): FlagView => ({
  arrangement: "BOOKING",
  id: fx[which].id,
  reference: fx[which].reference,
  name: which === "b1" ? fx.v1.name : fx.v2.name,
  flag,
  reason,
});
const reservationFlag = (fx: Fx, reason: string): FlagView => ({
  arrangement: "EQUIPMENT",
  id: fx.r1.id,
  reference: fx.r1.id,
  name: fx.r1.typeName,
  flag: "FLAGGED_FOR_REVIEW",
  reason,
});
/** The three flags a moved date previews (G2-T3). */
const dateMovedFlags = (fx: Fx) =>
  sorted([
    bookingFlag(fx, "b1", "REQUIRES_RECONFIRMATION", bookingMovedReason),
    bookingFlag(fx, "b2", "REQUIRES_RECONFIRMATION", bookingMovedReason),
    reservationFlag(fx, reservationMovedReason),
  ]);

const listsTheArrangements = (fx: Fx, impact: { bookings: unknown[]; reservations: unknown[]; activeRegistrations: number }) => {
  expect(impact.bookings).toHaveLength(2);
  expect(impact.bookings).toEqual(
    expect.arrayContaining([
      { arrangement: "BOOKING", id: fx.b1.id, reference: fx.b1.reference, venueName: fx.v1.name, startsAt: at("14:00"), endsAt: at("18:00") },
      { arrangement: "BOOKING", id: fx.b2.id, reference: fx.b2.reference, venueName: fx.v2.name, startsAt: at("14:00"), endsAt: at("18:00") },
    ]),
  );
  expect(impact.reservations).toEqual([
    { id: fx.r1.id, equipmentTypeName: fx.r1.typeName, reservedQuantity: 4, startsAt: at("14:00"), endsAt: at("18:00") },
  ]);
  expect(impact.activeRegistrations).toBe(0);
};

const requestStatus = async (cr: string) =>
  (await sql<{ status: string }[]>`select status from change.change_requests where id = ${cr}`)[0]!.status;
const count = async (query: PromiseLike<readonly { count: unknown }[]>) => Number((await query)[0]!.count);

/** Everything an approval of FX-G2's request would write, as stored now (G2-T5). */
async function stored(fx: Fx) {
  const e = fx.event.id;
  return {
    slots: await sql`select * from venue.venue_slots where event_id = ${e} order by id`,
    bookingRequests: await sql`select * from venue.booking_requests where event_id = ${e} order by id`,
    reservations: await sql`select * from equipment.reservations where event_id = ${e} order by id`,
    venueFlags: await sql`select * from venue.arrangement_flags where event_id = ${e} order by id`,
    reservationFlags: await sql`select * from equipment.reservation_flags where event_id = ${e} order by id`,
    changeRequest: await sql`select * from change.change_requests where id = ${fx.cr}`,
    changeRequestFields: await sql`select * from change.change_request_fields where request_id = ${fx.cr} order by field_name`,
    event: await sql`select * from event.events where id = ${e}`,
    history: await count(sql`select count(*) from event.event_history where event_id = ${e}`),
    // Test files run one at a time (vitest.config.ts), so a whole outbox's count is this card's.
    outboxes: {
      change: await count(sql`select count(*) from change.outbox`),
      event: await count(sql`select count(*) from event.outbox`),
      venue: await count(sql`select count(*) from venue.outbox`),
      equipment: await count(sql`select count(*) from equipment.outbox`),
    },
  };
}

beforeAll(clean);
beforeEach(async () => {
  await clean();
  asC();
});
afterAll(async () => {
  try {
    await clean();
  } finally {
    await sql.end();
  }
});

describe("G2 cards: previewing the arrangements a pending change would affect", () => {
  it("G2-T2 a pending date change previews both bookings, the reservation and the registration count", async () => {
    const fx = await fixture(DATE_MOVED);

    const response = await preview(fx.cr);

    expect(response.status).toBe(200);
    listsTheArrangements(fx, response.body.impact);
    expect(await requestStatus(fx.cr)).toBe("PENDING");
  });

  it("G2-T3 a moved date previews Requires Reconfirmation and Flagged for review with the period reasons", async () => {
    const fx = await fixture(DATE_MOVED);

    const response = await preview(fx.cr);

    expect(response.status).toBe(200);
    expect(sorted(response.body.impact.flags)).toEqual(dateMovedFlags(fx));
  });

  it("G2-T4 attendance 150 previews only the 100-seat booking as Unsuitable, naming both numbers", async () => {
    const fx = await fixture(ATTENDANCE_150);

    const response = await preview(fx.cr);

    expect(response.status).toBe(200);
    expect(response.body.impact.flags).toEqual([
      bookingFlag(fx, "b1", "UNSUITABLE", `Expected attendance is now 150, but ${fx.v1.name} holds 100 in the Theatre layout.`),
    ]);
    expect(response.body.impact.bookings).toHaveLength(2);
  });

  it("G2-T5 previewing alters no booking, reservation, flag, request, event or outbox", async () => {
    const fx = await fixture({ ...DATE_MOVED, ...ATTENDANCE_150 });
    const before = await stored(fx);
    // The fixture as the card states it: nothing flagged yet, the request pending.
    expect(before.venueFlags).toHaveLength(0);
    expect(before.reservationFlags).toHaveLength(0);
    expect(before.slots.every((s) => s.status === "CONFIRMED" && !s.period_mismatch && !s.unsuitable && !s.requires_reconfirmation)).toBe(true);
    expect(before.reservations.every((r) => r.status === "RESERVED" && !r.flagged_for_review)).toBe(true);
    expect(before.changeRequest[0]!.status).toBe("PENDING");

    const first = await preview(fx.cr);
    const second = await preview(fx.cr);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body).toEqual(first.body);
    expect(sorted(first.body.impact.flags)).toEqual(
      sorted([
        bookingFlag(fx, "b1", "REQUIRES_RECONFIRMATION", bookingMovedReason),
        bookingFlag(fx, "b1", "UNSUITABLE", `Expected attendance is now 150, but ${fx.v1.name} holds 100 in the Theatre layout.`),
        bookingFlag(fx, "b2", "REQUIRES_RECONFIRMATION", bookingMovedReason),
        reservationFlag(fx, reservationMovedReason),
      ]),
    );
    expect(await stored(fx)).toEqual(before);
  });

  it("G2-T6 a descriptive-only change lists the arrangements and previews no flag", async () => {
    const fx = await fixture(LECTERN);

    const response = await preview(fx.cr);

    expect(response.status).toBe(200);
    listsTheArrangements(fx, response.body.impact);
    expect(response.body.impact.flags).toEqual([]);
  });

  it("G2-T7 the owner, the coordinator and an Event Coordinator see the preview, others get 404 and a decided request 409", async () => {
    const fx = await fixture(DATE_MOVED);

    const seen: { impact: { bookings: unknown[]; reservations: unknown[]; activeRegistrations: number; flags: FlagView[] } }[] = [];
    for (const signIn of [asO, asC, asC2]) {
      signIn();
      const response = await preview(fx.cr);
      expect(response.status).toBe(200);
      seen.push(response.body);
    }
    listsTheArrangements(fx, seen[0]!.impact);
    expect(sorted(seen[0]!.impact.flags)).toEqual(dateMovedFlags(fx));
    expect(seen[1]).toEqual(seen[0]);
    expect(seen[2]).toEqual(seen[0]);

    const refused: { code: string; message: string }[] = [];
    for (const signIn of [asO2, asVS]) {
      signIn();
      const response = await preview(fx.cr);
      expect(response.status).toBe(404);
      expect(response.body.error).toMatchObject({ code: "CHANGE_REQUEST_NOT_FOUND", message: "No change request with that id exists." });
      expect(JSON.stringify(response.body)).not.toContain(fx.event.id);
      expect(JSON.stringify(response.body)).not.toContain(fx.event.reference);
      refused.push(response.body.error);
    }

    asC();
    const unknown = await preview(randomUUID());
    expect(unknown.status).toBe(404);
    // Each response has its own correlation id, so compare the code and message.
    for (const error of refused) {
      expect({ code: unknown.body.error.code, message: unknown.body.error.message }).toEqual({ code: error.code, message: error.message });
    }

    const decided = await fixture(DATE_MOVED);
    const approval = await decide(decided.cr);
    expect(approval.status).toBe(200);
    const decidedAt = approval.body.changeRequest.decidedAt as string;

    const afterDecision = await preview(decided.cr);

    expect(afterDecision.status).toBe(409);
    expect(afterDecision.body.error).toMatchObject({
      code: "CHANGE_REQUEST_ALREADY_DECIDED",
      message: `This change request was already Approved on ${decidedAt}.`,
      details: { status: "APPROVED", decidedAt },
    });
  });
});
