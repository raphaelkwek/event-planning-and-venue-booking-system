import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { TransactionSql } from "postgres";
import { testDb } from "../../support/testDb.js";

/**
 * The venue audit of 2 Nov 2026, one describe per finding (M1, M3, M4, M5, L1,
 * L2, L5, L9). H3's venue-staff scope is in venues.test.ts. Each test names the
 * story criterion it holds the code to.
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

const { resolveCurrentUser } = await import("../../../src/modules/venue/auth/identity.js");
const { app } = await import("../../../src/app.js");
const { releaseVenueArrangementsForEvent, venueArrangementsForEvent } = await import("../../../src/modules/venue/index.js");
const { disruptedBy } = await import("../../../src/modules/venue/repo/unavailability.js");
const { searchVenues } = await import("../../../src/modules/venue/repo/venueSearch.js");
const { expireOverdueHolds, runHoldExpirySweep } = await import("../../../src/modules/venue/jobs/expireOverdueHolds.js");

const sql = testDb();
const OWNER = "a9999999-0000-0000-0000-0000000000f1";
const C1 = "a9999999-0000-0000-0000-0000000000f2";
const C2 = "a9999999-0000-0000-0000-0000000000f4";
const STAFF = "a9999999-0000-0000-0000-0000000000f3";
const BUILDING = "Audit Fix Building";
const bearer = { Authorization: "Bearer test-token" };

function signedInAs(role: string, userId: string) {
  vi.mocked(resolveCurrentUser).mockResolvedValue({ id: userId, email: "user@connectsphere.test", role: role as never });
}
const asStaff = () => signedInAs("VENUE_STAFF", STAFF);
const asCoordinator = (id = C1) => signedInAs("EVENT_COORDINATOR", id);

const open = (opensAt: string, closesAt: string) => ({ opensAt, closesAt });
const HOURS = {
  monday: open("08:00", "22:00"),
  tuesday: open("08:00", "22:00"),
  wednesday: open("08:00", "22:00"),
  thursday: open("08:00", "22:00"),
  friday: open("08:00", "22:00"),
  saturday: null,
  sunday: null,
};
const LAYOUTS = [{ name: "Theatre", capacity: 300 }];

async function cleanUp() {
  const ours = sql`select id from venue.venues where created_by = ${STAFF}`;
  const blocks = sql`select id from venue.unavailability_blocks where venue_id in (${ours})`;
  await sql`delete from venue.outbox where message_key in (select id::text from venue.holds where venue_id in (${ours}))`;
  await sql`delete from venue.outbox where message_key in (select id::text from venue.venue_slots where venue_id in (${ours}))`;
  await sql`delete from venue.outbox where message_key in (select id::text from venue.unavailability_blocks where venue_id in (${ours}))`;
  await sql`delete from venue.outbox where message_key in (select id::text from venue.booking_requests where venue_id in (${ours}))`;
  await sql`delete from venue.buffer_conflicts where venue_id in (${ours})`;
  await sql`delete from venue.block_disruptions where block_id in (${blocks})`;
  await sql`delete from venue.holds where venue_id in (${ours})`;
  await sql`delete from venue.booking_requests where venue_id in (${ours})`;
  await sql`delete from venue.venue_slots where venue_id in (${ours})`;
  await sql`delete from venue.unavailability_blocks where venue_id in (${ours})`;
  await sql`delete from venue.venue_history where venue_id in (${ours})`;
  await sql`delete from venue.venue_staff where venue_id in (${ours})`;
  await sql`delete from venue.venues where created_by = ${STAFF}`;
  const events = sql`select id from event.events where owner_id = ${OWNER}`;
  await sql`delete from event.outbox where message_key in (select id::text from (${events}) e)`;
  await sql`delete from event.event_history where event_id in (${events})`;
  await sql`delete from event.assignments where event_id in (${events})`;
  await sql`delete from event.events where owner_id = ${OWNER}`;
}

beforeEach(cleanUp);
afterAll(async () => {
  await cleanUp();
  await sql.end();
});

/** A Singapore time on Wednesday 2 December 2026. */
const at = (hhmm: string) => `2026-12-02T${hhmm}:00+08:00`;
const utc = (hhmm: string) => new Date(at(hhmm)).toISOString();
const dayFromNow = () => new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

async function newVenue(name: string, setup = 0, turnaround = 0): Promise<string> {
  const [row] = await sql<{ id: string }[]>`
    insert into venue.venues
      (name, building, max_capacity, layouts, operating_hours, setup_minutes, turnaround_minutes, created_by, updated_by)
    values (${name}, ${BUILDING}, 300, ${sql.json(LAYOUTS)}, ${sql.json(HOURS)}, ${setup}, ${turnaround}, ${STAFF}, ${STAFF})
    returning id
  `;
  await sql`insert into venue.venue_staff (venue_id, user_id, created_by, updated_by) values (${row!.id}, ${STAFF}, ${STAFF}, ${STAFF})`;
  return row!.id;
}

async function newEvent(name: string, coordinator = C1): Promise<{ id: string; reference: string }> {
  const [row] = await sql<{ id: string; reference: string }[]>`
    insert into event.events (
      reference, owner_id, name, purpose, description, proposed_start_at, proposed_end_at,
      expected_attendance, equipment_required, registration_required, status, submitted_at,
      last_saved_at, created_by, updated_by
    ) values (
      'EVT-' || lpad(nextval('event.event_reference_seq')::text, 6, '0'), ${OWNER}, ${name}, 'Audit test',
      'Audit test', ${at("10:00")}, ${at("12:00")}, 150, false, false, 'APPROVED', now(), now(), ${OWNER}, ${OWNER}
    )
    returning id, reference
  `;
  await sql`insert into event.assignments (event_id, coordinator_id, assignment_rule, created_by, updated_by)
            values (${row!.id}, ${coordinator}, 'TEST', ${coordinator}, ${coordinator})`;
  return row!;
}

const post = (path: string, body: object = {}) => request(app).post(path).set(bearer).send(body);

async function requested(eventId: string, venueId: string, from: string, until: string, coordinator = C1, extra: object = {}) {
  asCoordinator(coordinator);
  const res = await post("/api/v1/booking-requests", {
    eventId,
    venueId,
    startsAt: at(from),
    endsAt: at(until),
    layout: "Theatre",
    expectedAttendance: 150,
    ...extra,
  });
  expect(res.status).toBe(201);
  return res.body as { id: string; reference: string };
}

async function booked(eventId: string, venueId: string, from: string, until: string, coordinator = C1) {
  const made = await requested(eventId, venueId, from, until, coordinator);
  asStaff();
  const res = await post(`/api/v1/booking-requests/${made.id}/approve`);
  expect(res.status).toBe(200);
  return { ...made, bookingId: res.body.bookingId as string };
}

async function heldHold(eventId: string, venueId: string, from: string, until: string, coordinator = C1) {
  asCoordinator(coordinator);
  const res = await post("/api/v1/holds", { eventId, venueId, startsAt: at(from), endsAt: at(until), reminderLeadMinutes: 60 });
  expect(res.status).toBe(201);
  asStaff();
  const placed = await post(`/api/v1/holds/${res.body.id}/place`, { expiresAt: dayFromNow() });
  expect(placed.status).toBe(200);
  return placed.body as { id: string; reference: string; slotId: string };
}

/** The HoldExpiry workflow never ran: the expiry passed an hour ago and the hold is still Held. */
async function overdue(holdId: string) {
  await sql`update venue.holds set placed_at = now() - interval '2 hours', expires_at = now() - interval '1 hour' where id = ${holdId}`;
}

async function holdRow(holdId: string) {
  const [row] = await sql<{ status: string; expired_at: Date | null; expires_at: Date; slot_status: string }[]>`
    select h.status, h.expired_at, h.expires_at, s.status as slot_status
    from venue.holds h join venue.venue_slots s on s.id = h.slot_id where h.id = ${holdId}
  `;
  return row!;
}

async function expiredMessages(holdId: string): Promise<number> {
  const [row] = await sql<{ n: number }[]>`
    select count(*)::int as n from venue.outbox where message_key = ${holdId} and envelope->>'type' = 'venue-booking.hold-expired'
  `;
  return row!.n;
}

const flagOf = async (table: "venue_slots" | "booking_requests", id: string) =>
  (await sql<{ requires_reconfirmation: boolean }[]>`select requires_reconfirmation from venue.${sql(table)} where id = ${id}`)[0]!
    .requires_reconfirmation;

/** Venue Staff change the venue's turnaround time (H3), which flags what now overlaps. */
async function setTurnaround(venueId: string, minutes: number) {
  asStaff();
  const res = await request(app)
    .put(`/api/v1/venues/${venueId}`)
    .set(bearer)
    .send({
      name: "Audit Hall",
      building: BUILDING,
      maxCapacity: 300,
      layouts: LAYOUTS,
      facilities: [],
      accessibilityFeatures: [],
      operatingHours: HOURS,
      isActive: true,
      setupMinutes: 0,
      turnaroundMinutes: minutes,
    });
  expect(res.status).toBe(200);
  return res.body.flaggedBookings as { reference: string }[];
}

const block = (venueId: string, body: object) => {
  asStaff();
  return post(`/api/v1/venues/${venueId}/unavailability`, { reasonType: "MAINTENANCE", description: "Roof leak repair", ...body });
};

const f5Flags = async (eventId: string) => {
  const arrangements = await sql.begin((tx) => venueArrangementsForEvent(tx, eventId));
  return [...arrangements.bookings, ...arrangements.requests].flatMap((a) => a.flags);
};

describe("M1: requests, I2's flags and venue search compare occupied periods with blocks (H3, I2, I5, J1)", () => {
  it("I2 flags a pending request whose turnaround reaches an open-ended block, naming the overlap", async () => {
    const venueId = await newVenue("Audit Hall", 0, 30);
    const event = await newEvent("Audit Gala");
    const pending = await requested(event.id, venueId, "10:00", "12:00");

    const res = await block(venueId, { startsAt: at("12:00") });

    expect(res.status).toBe(201);
    expect(res.body.disrupted).toEqual([
      expect.objectContaining({ kind: "REQUEST", reference: pending.reference, overlapFrom: utc("12:00"), overlapUntil: utc("12:30") }),
    ]);
    expect(await flagOf("booking_requests", pending.id)).toBe(true);
    // The repo function the impact review uses agrees, and a request ending at 11:30 only touches the block.
    const found = await disruptedBy(sql, venueId, new Date(at("12:00")), null);
    expect(found.map((d) => d.id)).toEqual([pending.id]);
    expect(await disruptedBy(sql, venueId, new Date(at("12:30")), null)).toEqual([]);
  });

  it("L1 refuses a request whose occupied period overlaps the block, and stores nothing; one that only touches it is raised", async () => {
    const venueId = await newVenue("Audit Hall", 0, 30);
    const event = await newEvent("Audit Gala");
    expect((await block(venueId, { startsAt: at("12:00") })).status).toBe(201);

    asCoordinator();
    const refused = await post("/api/v1/booking-requests", {
      eventId: event.id,
      venueId,
      startsAt: at("10:00"),
      endsAt: at("12:00"),
      layout: "Theatre",
      expectedAttendance: 150,
    });
    expect(refused.status).toBe(409);
    expect(refused.body.error.code).toBe("VENUE_UNAVAILABLE");
    const [none] = await sql<{ n: number }[]>`select count(*)::int as n from venue.booking_requests where event_id = ${event.id}`;
    expect(none!.n).toBe(0);

    await requested(event.id, venueId, "10:00", "11:30");
  });

  it("J1 leaves the venue out when the window widened by its turnaround overlaps a block, and keeps it when it only touches", async () => {
    const venueId = await newVenue("Audit Hall", 0, 30);
    expect((await block(venueId, { startsAt: at("12:00") })).status).toBe(201);
    const filters = { q: null, minCapacity: null, location: BUILDING, layout: null, facilities: [], accessibility: [] };

    const overlapping = await searchVenues(sql, { ...filters, from: utc("10:00"), to: utc("12:00") });
    expect(overlapping.map((v) => v.id)).not.toContain(venueId);
    const touching = await searchVenues(sql, { ...filters, from: utc("10:00"), to: utc("11:30") });
    expect(touching.map((v) => v.id)).toContain(venueId);
  });

  it("J1-T18: the window is widened by the venue's own times against a hold taken before they were set", async () => {
    const venueId = await newVenue("Audit Hall", 30, 30);
    const event = await newEvent("Audit Gala");
    await sql`
      insert into venue.venue_slots (venue_id, event_id, reference, starts_at, ends_at, status, created_by, updated_by)
      values (${venueId}, ${event.id}, 'HLD-AUDIT-1', ${at("14:00")}, ${at("16:00")}, 'HELD', ${STAFF}, ${STAFF})
    `;
    const filters = { q: null, minCapacity: null, location: BUILDING, layout: null, facilities: [], accessibility: [] };

    // 16:00-17:00 widens back to 15:30, into the hold; 16:30-17:30 widens to 16:00, where the hold ends.
    expect((await searchVenues(sql, { ...filters, from: utc("16:00"), to: utc("17:00") })).map((v) => v.id)).not.toContain(venueId);
    expect((await searchVenues(sql, { ...filters, from: utc("16:30"), to: utc("17:30") })).map((v) => v.id)).toContain(venueId);
  });

  it("the venue's setup time counts too: a block ending at 10:00 refuses a 10:15 request with 30 minutes' setup", async () => {
    const venueId = await newVenue("Audit Hall", 30, 0);
    const event = await newEvent("Audit Gala");
    expect((await block(venueId, { startsAt: at("08:00"), endsAt: at("10:00") })).status).toBe(201);

    asCoordinator();
    const refused = await post("/api/v1/booking-requests", {
      eventId: event.id,
      venueId,
      startsAt: at("10:15"),
      endsAt: at("12:00"),
      layout: "Theatre",
      expectedAttendance: 150,
    });
    expect(refused.status).toBe(409);
    expect(refused.body.error.code).toBe("VENUE_UNAVAILABLE");
  });
});

describe("L1 and M5: a hold request and a placement read the venue under its lock (I4, H3)", () => {
  it("refuses a hold request over a block in one transaction and stores nothing", async () => {
    const venueId = await newVenue("Audit Hall", 0, 30);
    const event = await newEvent("Audit Gala");
    expect((await block(venueId, { startsAt: at("12:00") })).status).toBe(201);

    asCoordinator();
    const res = await post("/api/v1/holds", { eventId: event.id, venueId, startsAt: at("10:00"), endsAt: at("12:00"), reminderLeadMinutes: 60 });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("VENUE_UNAVAILABLE");
    const [none] = await sql<{ n: number }[]>`select count(*)::int as n from venue.holds where event_id = ${event.id}`;
    expect(none!.n).toBe(0);
  });

  it("still answers 404 for an unknown venue and 422 for an inactive one when requesting or placing", async () => {
    const venueId = await newVenue("Audit Hall");
    const event = await newEvent("Audit Gala");
    asCoordinator();
    const body = { eventId: event.id, startsAt: at("10:00"), endsAt: at("12:00"), reminderLeadMinutes: 60 };
    const unknown = await post("/api/v1/holds", { ...body, venueId: "00000000-0000-0000-0000-00000000dead" });
    expect(unknown.status).toBe(404);
    expect(unknown.body.error.code).toBe("VENUE_NOT_FOUND");

    const hold = await post("/api/v1/holds", { ...body, venueId });
    expect(hold.status).toBe(201);
    await sql`update venue.venues set status = 'INACTIVE' where id = ${venueId}`;
    const inactive = await post("/api/v1/holds", { ...body, venueId, startsAt: at("13:00"), endsAt: at("14:00") });
    expect(inactive.status).toBe(422);
    asStaff();
    const placing = await post(`/api/v1/holds/${hold.body.id}/place`, { expiresAt: dayFromNow() });
    expect(placing.status).toBe(422);
    expect(placing.body.error.code).toBe("VENUE_INACTIVE");
  });

  it("places a hold with the venue's times as they are when it is placed, not when it was requested", async () => {
    const venueId = await newVenue("Audit Hall");
    const event = await newEvent("Audit Gala");
    asCoordinator();
    const res = await post("/api/v1/holds", { eventId: event.id, venueId, startsAt: at("10:00"), endsAt: at("12:00"), reminderLeadMinutes: 60 });
    expect(res.status).toBe(201);
    await setTurnaround(venueId, 45);

    asStaff();
    const placed = await post(`/api/v1/holds/${res.body.id}/place`, { expiresAt: dayFromNow() });
    expect(placed.status).toBe(200);
    const [slot] = await sql<{ turnaround_minutes: number; occupied_until: Date }[]>`
      select turnaround_minutes, upper(blocked_period) as occupied_until from venue.venue_slots where id = ${placed.body.slotId}
    `;
    expect(slot).toEqual({ turnaround_minutes: 45, occupied_until: new Date(at("12:45")) });
  });
});

describe("M4: an expired hold blocks nothing, even when the HoldExpiry workflow never ran (L6, CR-04)", () => {
  it("placing another hold over an overdue one expires it first, with the workflow's records and message", async () => {
    const venueId = await newVenue("Audit Hall");
    const first = await newEvent("Audit Gala");
    const second = await newEvent("Audit Rival", C2);
    const stale = await heldHold(first.id, venueId, "10:00", "12:00");
    await overdue(stale.id);

    const rival = await heldHold(second.id, venueId, "10:00", "12:00", C2);

    expect(rival).toMatchObject({ status: "HELD" });
    const row = await holdRow(stale.id);
    expect(row).toMatchObject({ status: "EXPIRED", slot_status: "EXPIRED" });
    expect(row.expired_at).not.toBeNull();
    expect(await expiredMessages(stale.id)).toBe(1);
  });

  it("approving a request over an overdue hold expires the hold and confirms the booking", async () => {
    const venueId = await newVenue("Audit Hall");
    const first = await newEvent("Audit Gala");
    const second = await newEvent("Audit Rival", C2);
    const stale = await heldHold(first.id, venueId, "10:00", "12:00");
    await overdue(stale.id);

    const booking = await booked(second.id, venueId, "10:00", "12:00", C2);

    expect(booking.bookingId).toEqual(expect.any(String));
    expect(await holdRow(stale.id)).toMatchObject({ status: "EXPIRED", slot_status: "EXPIRED" });
    expect(await expiredMessages(stale.id)).toBe(1);
  });

  it("refuses to change an expiry that has already passed, and expires the hold instead of reviving it", async () => {
    const venueId = await newVenue("Audit Hall");
    const event = await newEvent("Audit Gala");
    const stale = await heldHold(event.id, venueId, "10:00", "12:00");
    await overdue(stale.id);
    const before = await holdRow(stale.id);

    asStaff();
    const res = await request(app).patch(`/api/v1/holds/${stale.id}/expiry`).set(bearer).send({ expiresAt: dayFromNow() });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("HOLD_NOT_HELD");
    expect(res.body.error.message).toBe(
      `${stale.reference} is Expired, so its expiry can't be changed. Only a hold Venue Staff have placed and that is still held has one.`,
    );
    const after = await holdRow(stale.id);
    expect(after).toMatchObject({ status: "EXPIRED", slot_status: "EXPIRED" });
    expect(after.expires_at).toEqual(before.expires_at);
    expect(await expiredMessages(stale.id)).toBe(1);
  });

  it("the jobs:expire-holds sweep expires every overdue hold once, leaves holds not yet due, and is idempotent", async () => {
    const venueId = await newVenue("Audit Hall");
    const first = await newEvent("Audit Gala");
    const second = await newEvent("Audit Later", C2);
    const stale = await heldHold(first.id, venueId, "10:00", "12:00");
    const current = await heldHold(second.id, venueId, "13:00", "15:00", C2);
    await overdue(stale.id);

    const run = await expireOverdueHolds(sql);
    expect(run.expired).toContain(stale.id);
    expect(run.expired).not.toContain(current.id);
    expect(run.failed).toEqual([]);
    expect(await holdRow(stale.id)).toMatchObject({ status: "EXPIRED", slot_status: "EXPIRED" });
    expect(await holdRow(current.id)).toMatchObject({ status: "HELD", slot_status: "HELD" });

    const again = await expireOverdueHolds(sql);
    expect(again.expired).not.toContain(stale.id);
    expect(await expiredMessages(stale.id)).toBe(1);
    expect(await runHoldExpirySweep(sql)).toBe(0);
  });
});

describe("M3: ending an arrangement clears the buffer-change flags it caused (H3, I6, F5)", () => {
  /** Booking A 10:00–12:00, then B from 12:00; 30 minutes' turnaround makes them overlap and flags both. */
  async function flaggedPair(second: "hold" | "request") {
    const venueId = await newVenue("Audit Hall");
    const a = await newEvent("Audit Gala");
    const b = await newEvent("Audit Rival", C2);
    const booking = await booked(a.id, venueId, "10:00", "12:00");
    const other = second === "hold" ? await heldHold(b.id, venueId, "12:00", "14:00", C2) : await requested(b.id, venueId, "12:00", "14:00", C2);
    const flagged = await setTurnaround(venueId, 30);
    expect(flagged.map((f) => f.reference).sort()).toEqual([booking.reference, other.reference].sort());
    expect(await flagOf("venue_slots", booking.bookingId)).toBe(true);
    expect(await f5Flags(a.id)).toEqual(["REQUIRES_RECONFIRMATION"]);
    return { venueId, a, b, booking, other };
  }

  it("releasing the other hold clears the booking's flag, so F5 no longer sees it", async () => {
    const { a, booking, other } = await flaggedPair("hold");
    asCoordinator(C2);
    expect((await post(`/api/v1/holds/${other.id}/release`)).status).toBe(200);

    expect(await flagOf("venue_slots", booking.bookingId)).toBe(false);
    expect(await f5Flags(a.id)).toEqual([]);
  });

  it("the other hold expiring clears it, through the sweep with no worker", async () => {
    const { a, booking, other } = await flaggedPair("hold");
    await overdue(other.id);
    expect((await expireOverdueHolds(sql)).expired).toContain(other.id);

    expect(await flagOf("venue_slots", booking.bookingId)).toBe(false);
    expect(await f5Flags(a.id)).toEqual([]);
  });

  it("withdrawing the other request clears it", async () => {
    const { a, booking, other } = await flaggedPair("request");
    asCoordinator(C2);
    expect((await post(`/api/v1/booking-requests/${other.id}/withdraw`)).status).toBe(200);

    expect(await flagOf("venue_slots", booking.bookingId)).toBe(false);
    expect(await f5Flags(a.id)).toEqual([]);
  });

  it("rejecting the other request clears it", async () => {
    const { a, booking, other } = await flaggedPair("request");
    asStaff();
    expect((await post(`/api/v1/booking-requests/${other.id}/reject`, { reason: "Clashes with the gala" })).status).toBe(200);

    expect(await flagOf("venue_slots", booking.bookingId)).toBe(false);
    expect(await f5Flags(a.id)).toEqual([]);
  });

  it("cancelling the other event, which releases its arrangements (F4), clears it", async () => {
    const { a, b, booking } = await flaggedPair("hold");
    await sql.begin((tx: TransactionSql) => releaseVenueArrangementsForEvent(tx, b.id, C2));

    expect(await flagOf("venue_slots", booking.bookingId)).toBe(false);
    expect(await f5Flags(a.id)).toEqual([]);
  });

  it("keeps the flag while an active block still disrupts the booking, and clears it when the block is removed", async () => {
    const { venueId, a, booking, other } = await flaggedPair("hold");
    const blocked = await block(venueId, { startsAt: at("11:00"), endsAt: at("11:30") });
    expect(blocked.status).toBe(201);
    asCoordinator(C2);
    expect((await post(`/api/v1/holds/${other.id}/release`)).status).toBe(200);
    expect(await flagOf("venue_slots", booking.bookingId)).toBe(true);

    asStaff();
    const removed = await post(`/api/v1/venues/${venueId}/unavailability/${blocked.body.block.id}/remove`);
    expect(removed.status).toBe(200);
    expect(removed.body.cleared).toEqual([expect.objectContaining({ reference: booking.reference, stillDisrupted: false })]);
    expect(await flagOf("venue_slots", booking.bookingId)).toBe(false);
    expect(await f5Flags(a.id)).toEqual([]);
  });

  it("keeps the flag while another live arrangement still overlaps it", async () => {
    const venueId = await newVenue("Audit Hall");
    const a = await newEvent("Audit Gala");
    const b = await newEvent("Audit Rival", C2);
    const c = await newEvent("Audit Morning", C2);
    const booking = await booked(a.id, venueId, "10:00", "12:00");
    const after = await heldHold(b.id, venueId, "12:00", "14:00", C2);
    await booked(c.id, venueId, "08:00", "10:00", C2);
    await setTurnaround(venueId, 30);

    asCoordinator(C2);
    expect((await post(`/api/v1/holds/${after.id}/release`)).status).toBe(200);
    expect(await flagOf("venue_slots", booking.bookingId)).toBe(true);
  });
});

describe("L5: one pending replacement per disrupted booking (CR-02)", () => {
  it("refuses a second pending replacement, naming the first, and allows another once it is withdrawn", async () => {
    const venueId = await newVenue("Audit Hall");
    const spare = await newVenue("Audit Annexe");
    const spare2 = await newVenue("Audit Pavilion");
    const event = await newEvent("Audit Gala");
    const disrupted = await booked(event.id, venueId, "10:00", "12:00");
    expect((await block(venueId, { startsAt: at("09:00"), endsAt: at("13:00") })).status).toBe(201);

    const first = await requested(event.id, spare, "10:00", "12:00", C1, { replacesBookingId: disrupted.bookingId });
    asCoordinator();
    const body = { eventId: event.id, venueId: spare2, startsAt: at("10:00"), endsAt: at("12:00"), layout: "Theatre", expectedAttendance: 150 };
    const second = await post("/api/v1/booking-requests", { ...body, replacesBookingId: disrupted.bookingId });

    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe("BOOKING_REQUEST_DUPLICATE");
    expect(second.body.error.message).toBe(
      `A replacement for this booking is already pending: ${first.reference}. Withdraw it, or wait for Venue Staff to decide it, before requesting another.`,
    );
    const [count] = await sql<{ n: number }[]>`select count(*)::int as n from venue.booking_requests where replaces_booking_id = ${disrupted.bookingId}`;
    expect(count!.n).toBe(1);

    expect((await post(`/api/v1/booking-requests/${first.id}/withdraw`)).status).toBe(200);
    const again = await post("/api/v1/booking-requests", { ...body, replacesBookingId: disrupted.bookingId });
    expect(again.status).toBe(201);
  });
});

describe("L9: 0011's suitability checks are validated (migration 0021)", () => {
  it("has both checks validated", async () => {
    const rows = await sql<{ conname: string; convalidated: boolean }[]>`
      select conname, convalidated from pg_constraint
      where conrelid = 'venue.booking_requests'::regclass
        and conname in ('booking_requests_suitability_status_check', 'booking_requests_justification_recorded')
      order by conname
    `;
    expect(rows).toEqual([
      { conname: "booking_requests_justification_recorded", convalidated: true },
      { conname: "booking_requests_suitability_status_check", convalidated: true },
    ]);
  });
});

describe("L2: F5 takes a converted hold's request before its slot, as M1 does, so the two can't deadlock", () => {
  it("F5 waits on the request M1 has locked, and M1 can still lock the slot and finish", async () => {
    const venueId = await newVenue("Audit Hall");
    const event = await newEvent("Audit Gala");
    const hold = await heldHold(event.id, venueId, "10:00", "12:00");
    asCoordinator();
    const converted = await post(`/api/v1/holds/${hold.id}/convert`, { layout: "Theatre", expectedAttendance: 150 });
    expect(converted.status).toBe(201);
    const requestId = converted.body.request.id as string;

    const watcher = testDb();
    try {
      const started: { f5?: Promise<unknown> } = {};
      // M1's order: the request, then (once F5 is waiting) the slot its hold took.
      await sql.begin(async (tx) => {
        await tx`set local lock_timeout = '5s'`;
        await tx`select id from venue.booking_requests where id = ${requestId} for update`;
        started.f5 = sql.begin(async (f5tx) => {
          await f5tx`set local lock_timeout = '5s'`;
          return venueArrangementsForEvent(f5tx, event.id);
        });
        for (let i = 0; i < 50; i += 1) {
          const [waiting] = await watcher<{ n: number }[]>`
            select count(*)::int as n from pg_stat_activity where datname = current_database() and wait_event_type = 'Lock'
          `;
          if (waiting!.n > 0) break;
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        await tx`select id from venue.venue_slots where id = ${hold.slotId} for update`;
      });
      const arrangements = (await started.f5) as { bookings: { id: string }[]; requests: { id: string }[] };
      expect(arrangements.requests.map((r) => r.id)).toEqual([requestId]);
      expect(arrangements.bookings.map((b) => b.id)).toEqual([hold.slotId]);
    } finally {
      await watcher.end();
    }
  });
});
