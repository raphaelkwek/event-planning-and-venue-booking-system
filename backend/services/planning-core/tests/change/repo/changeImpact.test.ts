import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import type { EventStatus } from "@connectsphere/contracts";
import { testDb } from "../../support/testDb.js";
import { seedEvent } from "../../support/seedEvent.js";
import { EVENT_END, EVENT_START } from "../../support/eventDates.js";
import { cleanVenueFixtures } from "../../support/venueFixtures.js";
import { cleanLineFixtures } from "../../support/lineFixtures.js";
import { confirmedBooking, newVenue, reservedChairs } from "../../support/s3Fixtures.js";

// AC11 needs the venue module's flag writer to fail on demand; every other test uses the real one.
vi.mock("../../../src/modules/venue/index.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/modules/venue/index.js")>();
  return { ...actual, flagBookings: vi.fn(actual.flagBookings) };
});

const { flagBookings } = await import("../../../src/modules/venue/index.js");
const { insertChangeRequest } = await import("../../../src/modules/change/repo/changeRequests.js");
const { decideChangeRequest } = await import("../../../src/modules/change/repo/decisions.js");

/**
 * S3 against real Postgres (CI's throwaway database, never the shared one): an approval flags the
 * arrangements its change affects, returns a Confirmed event to Planning, and rolls everything back
 * when flagging fails (AC11). The full cards are tests/change/api/s3Cards.test.ts.
 */

const sql = testDb();
const OWNER = "a5340000-0000-4000-8000-000000000001";
const C1 = "a5340000-0000-4000-8000-000000000002";
const STAFF = "a5340000-0000-4000-8000-000000000003";
const TS = "a5340000-0000-4000-8000-000000000004";
const coordinator = { userId: C1, role: "EVENT_COORDINATOR" as const };

async function clean() {
  const events = sql`select id from event.events where owner_id = ${OWNER}`;
  const requests = sql`select id from change.change_requests where event_id in (${events})`;
  await sql`delete from change.outbox where message_key in (select id::text from (${events}) e)`;
  await sql`delete from change.change_request_fields where request_id in (${requests})`;
  await sql`delete from change.change_requests where event_id in (${events})`;
  await cleanVenueFixtures(sql, STAFF);
  await cleanLineFixtures(sql, [OWNER], [TS]);
}
beforeEach(async () => {
  vi.mocked(flagBookings).mockClear();
  await clean();
});
afterAll(async () => {
  try {
    await clean();
  } finally {
    await sql.end();
  }
});

const LECTERN = { layout: null, facilities: null, notes: "Stage with a lectern" };
const hourLater = (iso: string) => new Date(Date.parse(iso) + 3_600_000).toISOString();

/**
 * FX-S3 in short: an event in `status` (14:00–18:00, 150 attending) assigned to C1, confirmed
 * bookings B1 (Theatre 100) and B2 (Hall 200), a reservation R1 by TS, and a pending request.
 */
async function fixture(status: EventStatus, changes: Record<string, unknown>) {
  const eventId = await seedEvent(sql, { ownerId: OWNER, status, endsAt: new Date(EVENT_END), name: "S3 repo event" });
  await sql`insert into event.assignments (event_id, coordinator_id, assignment_rule) values (${eventId}, ${C1}, 'TEST_FIXTURE')`;
  const [row] = await sql<{ reference: string }[]>`select reference from event.events where id = ${eventId}`;
  const event = { id: eventId, reference: row!.reference };

  const v1 = await newVenue(sql, STAFF, "S3 Venue One", "Theatre", 100);
  const v2 = await newVenue(sql, STAFF, "S3 Venue Two", "Hall", 200);
  const suffix = randomUUID().slice(0, 6);
  const booking = (venueId: string, reference: string, layout: string) =>
    confirmedBooking(sql, { staffId: STAFF, requestedBy: C1, venueId, eventId, reference, layout });
  const b1 = await booking(v1.id, `BKR-S3A${suffix}`, "Theatre");
  const b2 = await booking(v2.id, `BKR-S3B${suffix}`, "Hall");
  const { chairs, reservationId: r1 } = await reservedChairs(sql, { event, requestedBy: C1, reservedBy: TS, quantity: 4, suffix });

  const current: Record<string, unknown> = { proposedStartAt: EVENT_START, proposedEndAt: EVENT_END, expectedAttendance: 150, venueRequirements: null };
  const request = await sql.begin((tx) =>
    insertChangeRequest(tx, {
      event,
      reason: "S3 repo change",
      changes,
      current: Object.fromEntries(Object.keys(changes).map((field) => [field, current[field]])),
      actorId: OWNER,
    })
  );
  return { event, v1, v2, b1, b2, r1, chairs, request };
}

const approve = (requestId: string) => sql.begin((tx) => decideChangeRequest(tx, requestId, { decision: "APPROVE" }, coordinator));

const eventState = async (id: string) =>
  (await sql<{ status: string; version: number; start: Date }[]>`
    select status, version, proposed_start_at as start from event.events where id = ${id}`)[0]!;
const slotFlags = (eventId: string) =>
  sql<{ id: string; requires_reconfirmation: boolean; period_mismatch: boolean; unsuitable: boolean; starts_at: Date; status: string }[]>`
    select id, requires_reconfirmation, period_mismatch, unsuitable, starts_at, status
    from venue.venue_slots where event_id = ${eventId} order by reference`;
const reservationFlag = async (id: string) =>
  (await sql<{ flagged_for_review: boolean; status: string }[]>`
    select flagged_for_review, status from equipment.reservations where id = ${id}`)[0]!;
const flagRows = async (eventId: string) => ({
  venue: Number((await sql`select count(*) from venue.arrangement_flags where event_id = ${eventId}`)[0]!.count),
  equipment: Number((await sql`select count(*) from equipment.reservation_flags where event_id = ${eventId}`)[0]!.count),
});
const changeOutbox = (eventId: string) =>
  sql<{ type: string; data: Record<string, unknown> }[]>`
    select envelope->>'type' as type, envelope->'data' as data from change.outbox where message_key = ${eventId} order by envelope->>'type'`;
const statusHistory = (eventId: string) =>
  sql<{ previous_status: string; new_status: string; triggering_action: string; actor_user_id: string; actor_role: string }[]>`
    select previous_status, new_status, triggering_action, actor_user_id, actor_role
    from event.event_history where event_id = ${eventId} and entry_type = 'STATUS_CHANGE'`;
const statusMessages = (eventId: string) =>
  sql<{ data: Record<string, unknown> }[]>`
    select envelope->'data' as data from event.outbox where message_key = ${eventId} and envelope->>'type' = 'event.status-changed'`;

describe("decideChangeRequest flags the affected arrangements (S3)", () => {
  it("flags both bookings and the reservation when the start moves, returns the impact, and writes one message", async () => {
    const later = hourLater(EVENT_START);
    const fx = await fixture("PLANNING", { proposedStartAt: later });

    const outcome = await approve(fx.request.id);

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const impact = outcome.impact!;
    expect(impact.bookings.map((b) => b.id).sort()).toEqual([fx.b1, fx.b2].sort());
    expect(impact.reservations.map((r) => r.id)).toEqual([fx.r1]);
    expect(impact.activeRegistrations).toBe(0);
    expect(impact.bookingFlags.map((f) => [f.bookingId, f.flag]).sort()).toEqual(
      [[fx.b1, "REQUIRES_RECONFIRMATION"], [fx.b2, "REQUIRES_RECONFIRMATION"]].sort()
    );
    expect(impact.reservationFlags).toMatchObject([{ reservationId: fx.r1, flag: "FLAGGED_FOR_REVIEW" }]);
    expect(impact.returnedToPlanning).toBe(false);

    // AC2/AC3: flagged, but nothing moved or released.
    const slots = await slotFlags(fx.event.id);
    // S3's own column; I2's and H3's is left alone.
    expect(slots.every((s) => s.period_mismatch && !s.requires_reconfirmation && !s.unsuitable && s.status === "CONFIRMED")).toBe(true);
    expect(slots.every((s) => s.starts_at.toISOString() === new Date(EVENT_START).toISOString())).toBe(true);
    expect(await reservationFlag(fx.r1)).toEqual({ flagged_for_review: true, status: "RESERVED" });
    expect(await flagRows(fx.event.id)).toEqual({ venue: 2, equipment: 1 });

    const messages = await changeOutbox(fx.event.id);
    expect(messages.map((m) => m.type)).toEqual(["change-request.approved", "change-request.arrangements-flagged"]);
    const flagged = messages[1]!.data;
    expect(flagged).toMatchObject({
      eventId: fx.event.id,
      eventReference: fx.event.reference,
      eventName: "S3 repo event",
      changeRequestId: fx.request.id,
      returnedToPlanning: false,
      reservations: [{ equipmentTypeName: fx.chairs.name, flag: "FLAGGED_FOR_REVIEW", reservedBy: TS }],
    });
    expect((flagged.bookings as { venueName: string; flag: string; staffIds: string[] }[]).map((b) => [b.venueName, b.flag, b.staffIds]).sort()).toEqual(
      [[fx.v1.name, "REQUIRES_RECONFIRMATION", [STAFF]], [fx.v2.name, "REQUIRES_RECONFIRMATION", [STAFF]]].sort()
    );
  });

  it("flags only the booking whose layout is now too small when attendance rises (AC4, AC5)", async () => {
    const fx = await fixture("PLANNING", { expectedAttendance: 180 });

    const outcome = await approve(fx.request.id);

    expect(outcome.ok && outcome.impact!.bookingFlags).toEqual([
      expect.objectContaining({ bookingId: fx.b1, flag: "UNSUITABLE", reason: `Expected attendance is now 180, but ${fx.v1.name} holds 100 in the Theatre layout.` }),
    ]);
    expect(outcome.ok && outcome.impact!.reservationFlags).toEqual([]);
    expect(await flagRows(fx.event.id)).toEqual({ venue: 1, equipment: 0 });
  });

  it("approves a change to an event with no expected attendance, skipping the capacity rule", async () => {
    const fx = await fixture("PLANNING", { venueRequirements: LECTERN });
    await sql`update event.events set expected_attendance = null where id = ${fx.event.id}`;

    const outcome = await approve(fx.request.id);

    expect(outcome.ok && outcome.impact).toMatchObject({ bookingFlags: [], reservationFlags: [] });
    expect(await flagRows(fx.event.id)).toEqual({ venue: 0, equipment: 0 });
  });

  it("lists the arrangements but flags nothing, and writes no flag message, for a descriptive change", async () => {
    const fx = await fixture("CONFIRMED", { venueRequirements: LECTERN });

    const outcome = await approve(fx.request.id);

    expect(outcome.ok && outcome.impact).toMatchObject({ bookingFlags: [], reservationFlags: [], activeRegistrations: 0 });
    expect(outcome.ok && outcome.impact!.bookings).toHaveLength(2);
    expect(await flagRows(fx.event.id)).toEqual({ venue: 0, equipment: 0 });
    expect((await changeOutbox(fx.event.id)).map((m) => m.type)).toEqual(["change-request.approved"]);
  });
});

describe("the event's status after an approved change (S3 AC6, AC7)", () => {
  it("returns a Confirmed event to Planning, with a history entry and a status message", async () => {
    const later = hourLater(EVENT_START);
    const fx = await fixture("CONFIRMED", { proposedStartAt: later });

    const outcome = await approve(fx.request.id);

    expect(outcome.ok && outcome.impact!.returnedToPlanning).toBe(true);
    expect((await eventState(fx.event.id)).status).toBe("PLANNING");
    expect(await statusHistory(fx.event.id)).toEqual([
      {
        previous_status: "CONFIRMED",
        new_status: "PLANNING",
        triggering_action: "RECONSIDER_AFTER_CHANGE",
        actor_user_id: C1,
        actor_role: "EVENT_COORDINATOR",
      },
    ]);
    expect((await statusMessages(fx.event.id)).map((m) => m.data)).toEqual([
      expect.objectContaining({ previousStatus: "CONFIRMED", newStatus: "PLANNING", action: "RECONSIDER_AFTER_CHANGE", proposedStartAt: later }),
    ]);
    expect((await changeOutbox(fx.event.id)).find((m) => m.type === "change-request.arrangements-flagged")!.data).toMatchObject({
      returnedToPlanning: true,
    });
    // The flags stay on the arrangements (AC7).
    expect(await flagRows(fx.event.id)).toEqual({ venue: 2, equipment: 1 });
  });

  it("returns a Confirmed event to Planning even when nothing is flagged (every significant field is material)", async () => {
    const fx = await fixture("CONFIRMED", { venueRequirements: LECTERN });

    await approve(fx.request.id);

    expect((await eventState(fx.event.id)).status).toBe("PLANNING");
  });

  it.each(["APPROVED", "PLANNING", "SAFETY_REVIEW"] as const)("leaves a %s event's status alone", async (status) => {
    const fx = await fixture(status, { proposedStartAt: hourLater(EVENT_START) });

    const outcome = await approve(fx.request.id);

    expect(outcome.ok && outcome.impact!.returnedToPlanning).toBe(false);
    expect((await eventState(fx.event.id)).status).toBe(status);
    expect(await statusHistory(fx.event.id)).toEqual([]);
    expect(await statusMessages(fx.event.id)).toEqual([]);
  });
});

describe("a failure while flagging (S3 AC11)", () => {
  it("rolls back the change, the decision, the status and every flag", async () => {
    const fx = await fixture("CONFIRMED", { proposedStartAt: hourLater(EVENT_START) });
    const before = await eventState(fx.event.id);
    const actual = vi.mocked(flagBookings).getMockImplementation()!;
    // The venue writes its flags, then fails, so the rollback has something to undo.
    vi.mocked(flagBookings).mockImplementationOnce(async (...args) => {
      await actual(...args);
      throw new Error("forced flag failure");
    });

    await expect(approve(fx.request.id)).rejects.toThrow("forced flag failure");

    expect(vi.mocked(flagBookings)).toHaveBeenCalledTimes(1);
    const [stored] = await sql<{ status: string; decided_by: string | null; decided_at: Date | null }[]>`
      select status, decided_by, decided_at from change.change_requests where id = ${fx.request.id}`;
    expect(stored).toEqual({ status: "PENDING", decided_by: null, decided_at: null });
    expect(await eventState(fx.event.id)).toEqual(before);
    expect(Number((await sql`select count(*) from event.event_history where event_id = ${fx.event.id}`)[0]!.count)).toBe(0);
    expect((await slotFlags(fx.event.id)).every((s) => !s.requires_reconfirmation && !s.period_mismatch && !s.unsuitable)).toBe(true);
    expect(await reservationFlag(fx.r1)).toEqual({ flagged_for_review: false, status: "RESERVED" });
    expect(await flagRows(fx.event.id)).toEqual({ venue: 0, equipment: 0 });
    expect(await changeOutbox(fx.event.id)).toEqual([]);
    expect(await statusMessages(fx.event.id)).toEqual([]);

    // With the writer working again the same request approves.
    expect(await approve(fx.request.id)).toMatchObject({ ok: true });
  });
});
