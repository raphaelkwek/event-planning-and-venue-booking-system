import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { KAFKA_TOPICS, parseCloudEvent, type EventStatus } from "@connectsphere/contracts";
import { notificationsFor } from "../../../../notification/src/domain/recipients.js";
import { testDb } from "../../support/testDb.js";
import { actorsWithPrefix, cleanLineFixtures } from "../../support/lineFixtures.js";
import { cleanVenueFixtures } from "../../support/venueFixtures.js";
import { confirmedBooking, newVenue, pendingRequest, reservedChairs } from "../../support/s3Fixtures.js";
import { seedEvent } from "../../support/seedEvent.js";
import { EVENT_END, EVENT_START } from "../../support/eventDates.js";
import { formatPeriod } from "../../../src/modules/change/domain/formatPeriod.js";

// The S3 cards (tests/S3): real Express app and migrated Postgres, with JWT verification and the
// identity lookups replaced. FX-S3's change requests are made through S1's real route and decided
// through S2's; its venues, bookings and reservation are the same direct inserts the S3 repository
// tests use (tests/support/s3Fixtures.ts). S3-T9 reads F5's confirmation route. S3-T10 passes the
// stored message through the notification service's recipient rule, as the S2 and F5 card tests do.
// S3-T11 forces the venue module's flag writer to fail, the mocking approach of
// tests/change/repo/changeImpact.test.ts. S3-T14 approves a booking request through M1's real route.
vi.mock("../../../src/shared/auth/verifyJwt.js", () => ({
  verifyJwt: (req: { auth?: { supabaseUserId?: string } }, _res: unknown, next: () => void) => {
    req.auth = { supabaseUserId: "s3-card-subject" };
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
vi.mock("../../../src/modules/venue/auth/identity.js", async () => {
  const actual = await vi.importActual<typeof import("../../../src/modules/venue/auth/identity.js")>(
    "../../../src/modules/venue/auth/identity.js",
  );
  return { ...actual, resolveCurrentUser: vi.fn() };
});
vi.mock("../../../src/modules/venue/index.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/modules/venue/index.js")>();
  return { ...actual, flagBookings: vi.fn(actual.flagBookings) };
});

const { resolveCurrentUser: resolveChangeUser } = await import("../../../src/modules/change/auth/identity.js");
const { resolveCurrentUser: resolveEventUser } = await import("../../../src/modules/event/auth/identity.js");
const { resolveCurrentUser: resolveVenueUser } = await import("../../../src/modules/venue/auth/identity.js");
const { flagBookings } = await import("../../../src/modules/venue/index.js");
const { app } = await import("../../../src/app.js");

const sql = testDb();
/** O = org, C = c1, C2 = c2, VS = vs, T = ts (tests/S3/README.md). O2 owns nothing here. */
const A = actorsWithPrefix("0c350000");
const O2 = "0c350000-0000-4000-8000-000000000007";
const bearer = { Authorization: "Bearer s3-card-token" };

type Role = "EVENT_COORDINATOR" | "TECH_SUPPORT_STAFF" | "EVENT_ORGANISER" | "VENUE_STAFF" | "ATTENDEE";
function signedInAs(userId: string, role: Role) {
  const user = { id: userId, email: "s3@connectsphere.test", role };
  vi.mocked(resolveChangeUser).mockResolvedValue(user);
  vi.mocked(resolveEventUser).mockResolvedValue(user);
  vi.mocked(resolveVenueUser).mockResolvedValue(user);
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
  r1: { id: string; lineId: string; typeName: string; lineName: string };
  cr: string;
}

/**
 * FX-S3: event E (owned by O, assigned to C, D 14:00 to D 18:00, 80 attending) in `status`, venues V1
 * (Theatre, 100) and V2 (Hall, 200) both looked after by VS, confirmed bookings B1 and B2 for E's
 * period (attendance 80), reservation R1 by T, and O's pending change request CR with `changes`,
 * made through S1's route. Every call builds its own, with its own references.
 */
async function fixture(changes: Record<string, unknown>, status: EventStatus = "PLANNING"): Promise<Fx> {
  const name = "S3 fixture event";
  const id = await seedEvent(sql, { ownerId: A.org, status, endsAt: new Date(EVENT_END), name });
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
  const b1 = await booking(v1.id, `BKR-S3A${suffix}`, "Theatre");
  const b2 = await booking(v2.id, `BKR-S3B${suffix}`, "Hall");
  const reserved = await reservedChairs(sql, { event, requestedBy: A.c1, reservedBy: A.ts, quantity: 4, suffix });
  const r1 = {
    id: reserved.reservationId,
    lineId: reserved.lineId,
    typeName: reserved.chairs.name,
    lineName: `${reserved.chairs.name} × 4`,
  };

  asO();
  const created = await request(app)
    .post(`/api/v1/events/${id}/change-requests`)
    .set(bearer)
    .send({ reason: "S3 card change", changes });
  expect(created.status).toBe(201);
  asC();
  return { event, v1, v2, b1, b2, r1, cr: created.body.id as string };
}

const decide = (cr: string) => request(app).post(`/api/v1/change-requests/${cr}/decision`).set(bearer).send({ decision: "APPROVE" });
const readFlags = (eventId: string) => request(app).get(`/api/v1/events/${eventId}/arrangement-flags`).set(bearer);
const readEvent = (eventId: string) => request(app).get(`/api/v1/events/${eventId}`).set(bearer);
const confirm = (eventId: string) => request(app).post(`/api/v1/events/${eventId}/confirmation`).set(bearer).send();

/** The bookings of E as stored: status, period and both flag columns. */
const slots = (eventId: string) =>
  sql<{ id: string; status: string; starts_at: Date; ends_at: Date; requires_reconfirmation: boolean; period_mismatch: boolean; unsuitable: boolean }[]>`
    select id, status, starts_at, ends_at, requires_reconfirmation, period_mismatch, unsuitable
    from venue.venue_slots where event_id = ${eventId} order by reference`;
const slotOf = async (eventId: string, slotId: string) => (await slots(eventId)).find((s) => s.id === slotId)!;
const reservationOf = async (id: string) =>
  (await sql<{ status: string; reserved_quantity: number; starts_at: Date; ends_at: Date; flagged_for_review: boolean }[]>`
    select status, reserved_quantity, starts_at, ends_at, flagged_for_review from equipment.reservations where id = ${id}`)[0]!;
const flagRowCounts = async (eventId: string) => ({
  venue: Number((await sql`select count(*) from venue.arrangement_flags where event_id = ${eventId}`)[0]!.count),
  equipment: Number((await sql`select count(*) from equipment.reservation_flags where event_id = ${eventId}`)[0]!.count),
});
const storedRequest = async (cr: string) =>
  (await sql<{ status: string; decided_by: string | null; decided_at: Date | null }[]>`
    select status, decided_by, decided_at from change.change_requests where id = ${cr}`)[0]!;
const eventRow = async (eventId: string) =>
  (await sql<{ status: string; version: number; start: Date }[]>`
    select status, version, proposed_start_at as start from event.events where id = ${eventId}`)[0]!;
const historyCount = async (eventId: string, entryType: "STATUS_CHANGE" | "FIELD_CHANGE") =>
  Number(
    (await sql`select count(*) from event.event_history where event_id = ${eventId} and entry_type = ${entryType}`)[0]!.count,
  );
const statusChanges = (eventId: string) =>
  sql<{ previous_status: string; new_status: string; triggering_action: string; actor_user_id: string; actor_role: string }[]>`
    select previous_status, new_status, triggering_action, actor_user_id, actor_role
    from event.event_history where event_id = ${eventId} and entry_type = 'STATUS_CHANGE'`;
const statusMessageCount = async (eventId: string) =>
  Number(
    (await sql`select count(*) from event.outbox where message_key = ${eventId} and envelope->>'type' = 'event.status-changed'`)[0]!.count,
  );
/** The event's change-outbox rows of one message type (ids are random, so never rely on order). */
async function outboxOfType(eventId: string, type: string) {
  const rows = await sql`select * from change.outbox where message_key = ${eventId}`;
  return rows.map((row) => ({ row, message: parseCloudEvent(row.envelope) })).filter(({ message }) => message.type === type);
}

type FlagView = { arrangement: string; id: string; reference: string; name: string; flag: string; reason: string };
const byIdAndFlag = (a: FlagView, b: FlagView) => `${a.id}/${a.flag}`.localeCompare(`${b.id}/${b.flag}`);
const sorted = (flags: FlagView[]) => [...flags].sort(byIdAndFlag);
const booking = (fx: Fx, which: "b1" | "b2", flag: string, reason: string): FlagView => ({
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

beforeAll(clean);
beforeEach(async () => {
  vi.mocked(flagBookings).mockClear();
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

describe("S3 cards: reconsidering the arrangements an approved change affects", () => {
  it("S3-T1 approval lists every booking, reservation and the registration count", async () => {
    const fx = await fixture(DATE_MOVED);

    const response = await decide(fx.cr);

    expect(response.status).toBe(200);
    expect(response.body.changeRequest).toMatchObject({ id: fx.cr, status: "APPROVED" });
    const { impact } = response.body;
    expect(impact.bookings.map((b: { reference: string; venueName: string }) => [b.reference, b.venueName]).sort()).toEqual(
      [[fx.b1.reference, fx.v1.name], [fx.b2.reference, fx.v2.name]].sort(),
    );
    expect(impact.reservations).toHaveLength(1);
    expect(impact.reservations[0]).toMatchObject({ id: fx.r1.id, equipmentTypeName: fx.r1.typeName });
    expect(impact.activeRegistrations).toBe(0);
  });

  it("S3-T2 a moved date sets both bookings to Requires Reconfirmation and keeps their period", async () => {
    const fx = await fixture(DATE_MOVED);

    const approved = await decide(fx.cr);
    expect(approved.status).toBe(200);
    const flagged = (approved.body.impact.flags as FlagView[]).filter((f) => f.arrangement === "BOOKING");
    expect(sorted(flagged)).toEqual(
      sorted([booking(fx, "b1", "REQUIRES_RECONFIRMATION", bookingMovedReason), booking(fx, "b2", "REQUIRES_RECONFIRMATION", bookingMovedReason)]),
    );

    const listed = await readFlags(fx.event.id);
    expect(listed.status).toBe(200);
    const bookingFlags = (listed.body.flags as FlagView[]).filter((f) => f.arrangement === "BOOKING");
    expect(sorted(bookingFlags)).toEqual(
      sorted([
        booking(fx, "b1", "REQUIRES_RECONFIRMATION", bookingMovedReason),
        booking(fx, "b2", "REQUIRES_RECONFIRMATION", bookingMovedReason),
      ]).map((flag) => expect.objectContaining(flag)),
    );

    // AC2: still confirmed, still holding the old period (nothing moved, nothing released).
    for (const id of [fx.b1.id, fx.b2.id]) {
      const stored = await slotOf(fx.event.id, id);
      expect(stored.status).toBe("CONFIRMED");
      // S3's own Requires Reconfirmation column, which I2 and H3 do not clear.
      expect(stored.period_mismatch).toBe(true);
      expect(stored.starts_at.toISOString()).toBe(at("14:00"));
      expect(stored.ends_at.toISOString()).toBe(at("18:00"));
    }
  });

  it("S3-T3 a moved date flags the reservation for review and releases nothing", async () => {
    const fx = await fixture(DATE_MOVED);
    const before = await reservationOf(fx.r1.id);

    const approved = await decide(fx.cr);
    expect(approved.status).toBe(200);

    const listed = await readFlags(fx.event.id);
    expect(listed.status).toBe(200);
    expect((listed.body.flags as FlagView[]).filter((f) => f.arrangement === "EQUIPMENT")).toEqual([
      expect.objectContaining(reservationFlag(fx, reservationMovedReason)),
    ]);

    const after = await reservationOf(fx.r1.id);
    expect(after).toMatchObject({ status: "RESERVED", flagged_for_review: true, reserved_quantity: before.reserved_quantity });
    expect(after.reserved_quantity).toBe(4);
    expect(after.starts_at.toISOString()).toBe(at("14:00"));
    expect(after.ends_at.toISOString()).toBe(at("18:00"));
  });

  it("S3-T4 attendance 150 makes the 100-seat booking Unsuitable, naming both numbers", async () => {
    const fx = await fixture(ATTENDANCE_150);
    const reason = `Expected attendance is now 150, but ${fx.v1.name} holds 100 in the Theatre layout.`;

    const approved = await decide(fx.cr);

    expect(approved.status).toBe(200);
    expect(approved.body.impact.flags).toEqual([booking(fx, "b1", "UNSUITABLE", reason)]);
    const listed = await readFlags(fx.event.id);
    expect(listed.status).toBe(200);
    expect(listed.body.flags).toEqual([expect.objectContaining(booking(fx, "b1", "UNSUITABLE", reason))]);
    // Still confirmed, period unchanged; no period flag since the dates did not change; R1 carries none.
    const stored = await slotOf(fx.event.id, fx.b1.id);
    expect(stored).toMatchObject({ status: "CONFIRMED", unsuitable: true, period_mismatch: false, requires_reconfirmation: false });
    expect(stored.starts_at.toISOString()).toBe(at("14:00"));
    expect(stored.ends_at.toISOString()).toBe(at("18:00"));
    expect((await reservationOf(fx.r1.id)).flagged_for_review).toBe(false);
  });

  it("S3-T5 attendance 150 flags only the booking whose layout is too small", async () => {
    const fx = await fixture(ATTENDANCE_150);

    const approved = await decide(fx.cr);

    expect(approved.status).toBe(200);
    // AC1 still lists both bookings, flagged or not.
    expect(approved.body.impact.bookings.map((b: { id: string }) => b.id).sort()).toEqual([fx.b1.id, fx.b2.id].sort());
    const listed = await readFlags(fx.event.id);
    expect(listed.status).toBe(200);
    expect(listed.body.flags).toHaveLength(1);
    expect(listed.body.flags[0]).toMatchObject({ arrangement: "BOOKING", id: fx.b1.id, flag: "UNSUITABLE" });
    expect(await slotOf(fx.event.id, fx.b2.id)).toMatchObject({ status: "CONFIRMED", unsuitable: false, period_mismatch: false });
    expect((await reservationOf(fx.r1.id)).flagged_for_review).toBe(false);
  });

  it("S3-T6 an event in Planning or Safety Review keeps its status", async () => {
    for (const status of ["PLANNING", "SAFETY_REVIEW"] as const) {
      const fx = await fixture(DATE_MOVED, status);

      const approved = await decide(fx.cr);

      expect(approved.status).toBe(200);
      expect(approved.body.impact.flags).toHaveLength(3);
      const opened = await readEvent(fx.event.id);
      expect(opened.status).toBe(200);
      expect(opened.body.status).toBe(status);
      expect(await historyCount(fx.event.id, "STATUS_CHANGE")).toBe(0);
      expect(await statusMessageCount(fx.event.id)).toBe(0);
      if (status === "PLANNING") expect(await historyCount(fx.event.id, "FIELD_CHANGE")).toBe(1);
    }
  });

  it("S3-T7 a Confirmed event returns to Planning with a history entry", async () => {
    const fx = await fixture(DATE_MOVED, "CONFIRMED");

    const approved = await decide(fx.cr);

    expect(approved.status).toBe(200);
    const opened = await readEvent(fx.event.id);
    expect(opened.body.status).toBe("PLANNING");
    expect(await statusChanges(fx.event.id)).toEqual([
      {
        previous_status: "CONFIRMED",
        new_status: "PLANNING",
        triggering_action: "RECONSIDER_AFTER_CHANGE",
        actor_user_id: A.c1,
        actor_role: "EVENT_COORDINATOR",
      },
    ]);
    const fieldChanges = await sql<{ field_name: string }[]>`
      select field_name from event.event_history where event_id = ${fx.event.id} and entry_type = 'FIELD_CHANGE'`;
    expect(fieldChanges.map((entry) => entry.field_name)).toEqual(["proposedStartAt"]);

    // The flags stay on all three arrangements.
    const listed = await readFlags(fx.event.id);
    expect(listed.status).toBe(200);
    expect(sorted(listed.body.flags).map((f) => [f.id, f.flag])).toEqual(
      sorted([
        booking(fx, "b1", "REQUIRES_RECONFIRMATION", ""),
        booking(fx, "b2", "REQUIRES_RECONFIRMATION", ""),
        reservationFlag(fx, ""),
      ]).map((f) => [f.id, f.flag]),
    );

    // Back in Planning, it is confirmed again only through F5, which refuses while the flags exist.
    const refused = await confirm(fx.event.id);
    expect(refused.status).toBe(422);
    expect(refused.body.error.code).toBe("ARRANGEMENTS_NOT_READY");
  });

  it("S3-T8 the owner, the coordinator and an Event Coordinator see the flags and another organiser gets 404", async () => {
    const fx = await fixture(DATE_MOVED);
    expect((await decide(fx.cr)).status).toBe(200);
    const expected = sorted([
      booking(fx, "b1", "REQUIRES_RECONFIRMATION", bookingMovedReason),
      booking(fx, "b2", "REQUIRES_RECONFIRMATION", bookingMovedReason),
      reservationFlag(fx, reservationMovedReason),
    ]);

    for (const signIn of [asO, asC, asC2]) {
      signIn();
      const response = await readFlags(fx.event.id);
      expect(response.status).toBe(200);
      expect(sorted(response.body.flags)).toEqual(expected.map((flag) => ({ ...flag, flaggedAt: expect.any(String) })));
    }

    asO2();
    const other = await readFlags(fx.event.id);
    expect(other.status).toBe(404);
    expect(other.body.error.code).toBe("EVENT_NOT_FOUND");
    expect(JSON.stringify(other.body)).not.toContain(fx.event.id);
    expect(JSON.stringify(other.body)).not.toContain(fx.event.reference);

    asC();
    const unknown = await readFlags(randomUUID());
    expect(unknown.status).toBe(404);
    // Each response has its own correlation id, so compare the code and message.
    const otherError = { code: other.body.error.code, message: other.body.error.message };
    expect(unknown.body.error).toMatchObject(otherError);
  });

  it("S3-T9 F5 confirmation is refused, naming each flag", async () => {
    const fx = await fixture({ ...DATE_MOVED, ...ATTENDANCE_150 });
    expect((await decide(fx.cr)).status).toBe(200);
    const stateOf = async () => ({
      event: await eventRow(fx.event.id),
      history: await historyCount(fx.event.id, "STATUS_CHANGE"),
      slots: await slots(fx.event.id),
      reservation: await reservationOf(fx.r1.id),
      flagRows: await flagRowCounts(fx.event.id),
      eventOutbox: Number((await sql`select count(*) from event.outbox where message_key = ${fx.event.id}`)[0]!.count),
    });
    const before = await stateOf();
    expect(before.event.status).toBe("PLANNING");

    const response = await confirm(fx.event.id);

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe("ARRANGEMENTS_NOT_READY");
    const named = (reference: string, name: string, flag: string, arrangement = "BOOKING") => ({ arrangement, reference, name, flag });
    const flags = response.body.error.details.flags as { arrangement: string; reference: string; name: string; flag: string }[];
    expect(flags).toHaveLength(4);
    expect(flags).toEqual(
      expect.arrayContaining([
        named(fx.b1.reference, fx.v1.name, "REQUIRES_RECONFIRMATION"),
        named(fx.b1.reference, fx.v1.name, "UNSUITABLE"),
        named(fx.b2.reference, fx.v2.name, "REQUIRES_RECONFIRMATION"),
        named(fx.r1.lineId, fx.r1.lineName, "FLAGGED_FOR_REVIEW", "EQUIPMENT_LINE"),
      ]),
    );
    const message: string = response.body.error.message;
    expect(message).toContain(`booking ${fx.b1.reference} at ${fx.v1.name} requires reconfirmation`);
    expect(message).toContain(`booking ${fx.b1.reference} at ${fx.v1.name} is flagged unsuitable`);
    expect(message).toContain(`booking ${fx.b2.reference} at ${fx.v2.name} requires reconfirmation`);
    expect(message).toContain(`equipment ${fx.r1.lineName} is flagged for review`);

    expect(await stateOf()).toEqual(before);
  });

  it("S3-T10 one arrangements-flagged message is written and Venue Staff and Technical Support are notified", async () => {
    const fx = await fixture(DATE_MOVED);

    const approved = await decide(fx.cr);
    expect(approved.status).toBe(200);

    const messages = await outboxOfType(fx.event.id, "change-request.arrangements-flagged");
    expect(messages).toHaveLength(1);
    const { row, message } = messages[0]!;
    expect(row).toMatchObject({ topic: KAFKA_TOPICS.event, message_key: fx.event.id });
    const data = message.data as {
      eventId: string;
      changeRequestId: string;
      bookings: { reference: string; venueName: string; flag: string; reason: string; staffIds: string[] }[];
      reservations: { equipmentTypeName: string; flag: string; reason: string; reservedBy: string }[];
    };
    expect(data).toMatchObject({ eventId: fx.event.id, changeRequestId: fx.cr });
    expect(data.bookings.map((b) => [b.reference, b.venueName, b.flag, b.staffIds]).sort()).toEqual(
      [
        [fx.b1.reference, fx.v1.name, "REQUIRES_RECONFIRMATION", [A.vs]],
        [fx.b2.reference, fx.v2.name, "REQUIRES_RECONFIRMATION", [A.vs]],
      ].sort(),
    );
    expect(data.reservations).toEqual([
      expect.objectContaining({ equipmentTypeName: fx.r1.typeName, flag: "FLAGGED_FOR_REVIEW", reservedBy: A.ts }),
    ]);

    // The notification service's recipient rule turns it into one notice per recipient and arrangement.
    const notices = notificationsFor(message);
    const venueStaffNotices = notices.filter((n) => n.recipientUserId === A.vs);
    expect(venueStaffNotices).toHaveLength(2);
    for (const reference of [fx.b1.reference, fx.b2.reference]) {
      const notice = venueStaffNotices.find((n) => n.message.includes(reference));
      expect(notice).toBeDefined();
      expect(notice).toMatchObject({ eventId: fx.event.id, eventReference: fx.event.reference });
      expect(notice!.message).toContain(fx.event.reference);
      expect(notice!.message).toContain(bookingMovedReason);
    }
    const supportNotices = notices.filter((n) => n.recipientUserId === A.ts);
    expect(supportNotices).toHaveLength(1);
    expect(supportNotices[0]!.message).toContain(fx.event.reference);
    expect(supportNotices[0]!.message).toContain(fx.r1.typeName);
    expect(supportNotices[0]!.message).toContain(reservationMovedReason);
    expect(notices).toHaveLength(3);

    // A change that flags nothing (S3-T12) writes no such message.
    const quiet = await fixture({ venueRequirements: { notes: "Stage with a lectern" } });
    expect((await decide(quiet.cr)).status).toBe(200);
    expect(await outboxOfType(quiet.event.id, "change-request.arrangements-flagged")).toHaveLength(0);
    expect(await outboxOfType(quiet.event.id, "change-request.approved")).toHaveLength(1);
  });

  it("S3-T11 a failure while flagging rolls back the change, the decision and every flag", async () => {
    const fx = await fixture(DATE_MOVED, "CONFIRMED");
    const before = await eventRow(fx.event.id);
    const actual = vi.mocked(flagBookings).getMockImplementation()!;
    // The venue writes its flags, then fails, so the rollback has something to undo.
    vi.mocked(flagBookings).mockImplementationOnce(async (...args) => {
      await actual(...args);
      throw new Error("forced flag failure");
    });

    const response = await decide(fx.cr);

    expect(response.status).toBe(500);
    expect(vi.mocked(flagBookings)).toHaveBeenCalledTimes(1);
    expect(await storedRequest(fx.cr)).toEqual({ status: "PENDING", decided_by: null, decided_at: null });
    expect(await eventRow(fx.event.id)).toEqual(before);
    expect(before.start.toISOString()).toBe(at("14:00"));
    expect(await historyCount(fx.event.id, "FIELD_CHANGE")).toBe(0);
    expect(await historyCount(fx.event.id, "STATUS_CHANGE")).toBe(0);
    expect(await statusMessageCount(fx.event.id)).toBe(0);
    expect(
      (await slots(fx.event.id)).every((s) => !s.requires_reconfirmation && !s.period_mismatch && !s.unsuitable && s.status === "CONFIRMED"),
    ).toBe(true);
    expect(await reservationOf(fx.r1.id)).toMatchObject({ flagged_for_review: false, status: "RESERVED" });
    expect(await flagRowCounts(fx.event.id)).toEqual({ venue: 0, equipment: 0 });
    expect(await outboxOfType(fx.event.id, "change-request.approved")).toHaveLength(0);
    expect(await outboxOfType(fx.event.id, "change-request.arrangements-flagged")).toHaveLength(0);

    // With the writer working again the same request approves.
    expect((await decide(fx.cr)).status).toBe(200);
  });

  it("S3-T12 a descriptive-only change lists the arrangements and flags none", async () => {
    const fx = await fixture({ venueRequirements: { notes: "Stage with a lectern" } });

    const approved = await decide(fx.cr);

    expect(approved.status).toBe(200);
    const { impact } = approved.body;
    expect(impact.bookings.map((b: { id: string }) => b.id).sort()).toEqual([fx.b1.id, fx.b2.id].sort());
    expect(impact.reservations.map((r: { id: string }) => r.id)).toEqual([fx.r1.id]);
    expect(impact.activeRegistrations).toBe(0);
    expect(impact.flags).toEqual([]);

    const listed = await readFlags(fx.event.id);
    expect(listed.status).toBe(200);
    expect(listed.body).toEqual({ flags: [] });
    const opened = await readEvent(fx.event.id);
    expect(opened.body.status).toBe("PLANNING");
    expect(await outboxOfType(fx.event.id, "change-request.arrangements-flagged")).toHaveLength(0);
    expect(await flagRowCounts(fx.event.id)).toEqual({ venue: 0, equipment: 0 });
  });

  it("S3-T14 a pending request flagged at approval stays flagged once M1 confirms it", async () => {
    const fx = await fixture(DATE_MOVED);
    // A third venue, so the request's period does not collide with B1 or B2 when M1 books it.
    const v3 = await newVenue(sql, A.vs, "Venue Three", "Theatre", 100);
    const pending = await pendingRequest(sql, { requestedBy: A.c1, venueId: v3.id, eventId: fx.event.id, layout: "Theatre" });
    const reason = `The booking request is for ${WAS}, but the event is now ${NOW_FROM_15}.`;

    const approved = await decide(fx.cr);

    expect(approved.status).toBe(200);
    expect(approved.body.impact.bookings).toContainEqual(
      expect.objectContaining({ arrangement: "BOOKING_REQUEST", id: pending.id, reference: pending.reference, venueName: v3.name }),
    );
    expect(approved.body.impact.flags).toContainEqual({
      arrangement: "BOOKING_REQUEST",
      id: pending.id,
      reference: pending.reference,
      name: v3.name,
      flag: "REQUIRES_RECONFIRMATION",
      reason,
    });

    // M1: Venue Staff approve the request for the old period, which confirms a booking.
    asVS();
    const confirmedByM1 = await request(app).post(`/api/v1/booking-requests/${pending.id}/approve`).set(bearer).send();
    expect(confirmedByM1.status).toBe(200);
    const [decided] = await sql<{ status: string; booking_id: string }[]>`
      select status, booking_id from venue.booking_requests where id = ${pending.id}`;
    expect(decided!.status).toBe("APPROVED");
    expect(await slotOf(fx.event.id, decided!.booking_id)).toMatchObject({ status: "CONFIRMED", period_mismatch: true });

    // The booking carries the flag and its reason, and F5 still refuses, naming it.
    asC();
    const listed = await readFlags(fx.event.id);
    expect(listed.status).toBe(200);
    expect(listed.body.flags).toContainEqual(
      expect.objectContaining({
        arrangement: "BOOKING",
        id: decided!.booking_id,
        reference: pending.reference,
        name: v3.name,
        flag: "REQUIRES_RECONFIRMATION",
        reason,
      }),
    );
    expect((listed.body.flags as FlagView[]).some((f) => f.arrangement === "BOOKING_REQUEST")).toBe(false);
    const refused = await confirm(fx.event.id);
    expect(refused.status).toBe(422);
    expect(refused.body.error.details.flags).toContainEqual({
      arrangement: "BOOKING",
      reference: pending.reference,
      name: v3.name,
      flag: "REQUIRES_RECONFIRMATION",
    });
  });
});
