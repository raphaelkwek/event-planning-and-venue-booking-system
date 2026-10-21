import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { testDb } from "../../support/testDb.js";

/**
 * H3 (CR-01) — a venue's setup and turnaround time, against the venue and event
 * schemas: an approval occupies the venue for the event's period widened by
 * the venue's times (H3-T8, H3-T9), and changing those times flags each live
 * booking and hold that now overlaps another, naming it, telling its
 * coordinator and removing nothing (H3-T10).
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

const sql = testDb();
const OWNER = "a9999999-0000-0000-0000-000000000081";
const COORDINATOR = "a9999999-0000-0000-0000-000000000082";
const OTHER_COORDINATOR = "a9999999-0000-0000-0000-000000000085";
const STAFF = "a9999999-0000-0000-0000-000000000083";
const VENUE_NAME = "H3 Auditorium";
const bearer = { Authorization: "Bearer test-token" };

function signedInAs(role: string, userId: string) {
  vi.mocked(resolveCurrentUser).mockResolvedValue({ id: userId, email: "user@connectsphere.test", role: role as never });
}

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

/** The venue as Venue Staff save it, with the times given (H1, H3). */
const venueBody = (setupMinutes: number, turnaroundMinutes: number) => ({
  name: VENUE_NAME,
  building: "H3 Test Building",
  maxCapacity: 300,
  layouts: LAYOUTS,
  facilities: [],
  accessibilityFeatures: [],
  operatingHours: HOURS,
  isActive: true,
  setupMinutes,
  turnaroundMinutes,
});

async function cleanUp() {
  const ours = sql`select id from venue.venues where created_by = ${STAFF}`;
  const slots = sql`select id from venue.venue_slots where venue_id in (${ours})`;
  const blocks = sql`select id from venue.unavailability_blocks where venue_id in (${ours})`;
  await sql`delete from venue.outbox where message_key in (select id::text from venue.venue_slots where venue_id in (${ours}))`;
  await sql`delete from venue.outbox where message_key in (select id::text from venue.unavailability_blocks where venue_id in (${ours}))`;
  await sql`delete from venue.outbox where message_key in (select id::text from venue.booking_requests where venue_id in (${ours}))`;
  await sql`delete from venue.buffer_conflicts where slot_id in (${slots})`;
  await sql`delete from venue.block_disruptions where block_id in (${blocks})`;
  await sql`delete from venue.booking_requests where venue_id in (${ours})`;
  await sql`delete from venue.venue_slots where venue_id in (${ours})`;
  await sql`delete from venue.unavailability_blocks where venue_id in (${ours})`;
  await sql`delete from venue.venue_history where venue_id in (${ours})`;
  await sql`delete from venue.venue_staff where venue_id in (${ours})`;
  await sql`delete from venue.venues where created_by = ${STAFF}`;
  const events = sql`select id from event.events where owner_id = ${OWNER}`;
  await sql`delete from event.event_history where event_id in (${events})`;
  await sql`delete from event.assignments where event_id in (${events})`;
  await sql`delete from event.events where owner_id = ${OWNER}`;
}

beforeEach(cleanUp);
afterAll(async () => {
  await cleanUp();
  await sql.end();
});

async function newVenue(setup = 0, turnaround = 0): Promise<string> {
  const [row] = await sql<{ id: string }[]>`
    insert into venue.venues
      (name, building, max_capacity, layouts, operating_hours, setup_minutes, turnaround_minutes, created_by, updated_by)
    values (${VENUE_NAME}, 'H3 Test Building', 300, ${sql.json(LAYOUTS)}, ${sql.json(HOURS)}, ${setup}, ${turnaround}, ${STAFF}, ${STAFF})
    returning id
  `;
  await sql`insert into venue.venue_staff (venue_id, user_id, created_by, updated_by) values (${row!.id}, ${STAFF}, ${STAFF}, ${STAFF})`;
  return row!.id;
}

/** A Singapore time on Wednesday 2 December 2026. */
const at = (hhmm: string) => `2026-12-02T${hhmm}:00+08:00`;
const utc = (hhmm: string) => new Date(at(hhmm)).toISOString();

async function newEvent(name: string, coordinator = COORDINATOR): Promise<{ id: string; reference: string }> {
  const [row] = await sql<{ id: string; reference: string }[]>`
    insert into event.events (
      reference, owner_id, name, purpose, description, proposed_start_at, proposed_end_at,
      expected_attendance, equipment_required, registration_required, status, submitted_at,
      last_saved_at, created_by, updated_by
    ) values (
      'EVT-' || lpad(nextval('event.event_reference_seq')::text, 6, '0'), ${OWNER}, ${name}, 'H3 test',
      'H3 test', ${at("10:00")}, ${at("12:00")}, 150, false, false, 'APPROVED', now(), now(), ${OWNER}, ${OWNER}
    )
    returning id, reference
  `;
  await sql`insert into event.assignments (event_id, coordinator_id, assignment_rule, created_by, updated_by)
            values (${row!.id}, ${coordinator}, 'TEST', ${coordinator}, ${coordinator})`;
  return row!;
}

const save = (venueId: string, setup: number, turnaround: number) =>
  request(app).put(`/api/v1/venues/${venueId}`).set(bearer).send(venueBody(setup, turnaround));
const calendar = (venueId: string) =>
  request(app).get(`/api/v1/venues/${venueId}/availability`).query({ from: "2026-12-02", to: "2026-12-02" }).set(bearer);
const eventBookings = (eventId: string) => request(app).get("/api/v1/booking-requests").query({ eventId }).set(bearer);

/** The event's coordinator requests the venue, Theatre, and the venue's staff approve it (L1, M1). */
async function approval(venueId: string, event: { id: string }, from: string, until: string, coordinator = COORDINATOR) {
  signedInAs("EVENT_COORDINATOR", coordinator);
  const made = await request(app)
    .post("/api/v1/booking-requests")
    .set(bearer)
    .send({ eventId: event.id, venueId, startsAt: at(from), endsAt: at(until), layout: "Theatre", expectedAttendance: 150 });
  expect(made.status).toBe(201);
  signedInAs("VENUE_STAFF", STAFF);
  return { request: made.body as { id: string; reference: string }, res: await request(app).post(`/api/v1/booking-requests/${made.body.id}/approve`).set(bearer) };
}

async function booked(venueId: string, event: { id: string }, from: string, until: string, coordinator = COORDINATOR) {
  const { request: made, res } = await approval(venueId, event, from, until, coordinator);
  expect(res.status).toBe(200);
  return { reference: made.reference, bookingId: res.body.bookingId as string };
}

/** A hold of the venue, as L3 places one: a HELD slot. */
async function held(venueId: string, event: { id: string; reference: string }, from: string, until: string) {
  const [row] = await sql<{ id: string }[]>`
    insert into venue.venue_slots (venue_id, event_id, reference, starts_at, ends_at, status, created_by, updated_by)
    values (${venueId}, ${event.id}, ${`H3-HOLD-${event.reference}`}, ${at(from)}, ${at(until)}, 'HELD', ${STAFF}, ${STAFF})
    returning id
  `;
  return { bookingId: row!.id, reference: `H3-HOLD-${event.reference}` };
}

interface SlotState {
  status: string;
  starts_at: Date;
  ends_at: Date;
  setup_minutes: number;
  turnaround_minutes: number;
  requires_reconfirmation: boolean;
}
const slot = async (id: string) =>
  (await sql<SlotState[]>`
    select status, starts_at, ends_at, setup_minutes, turnaround_minutes, requires_reconfirmation from venue.venue_slots where id = ${id}
  `)[0]!;
const flaggedMessages = (slotId: string) =>
  sql<{ envelope: { data: Record<string, unknown> } }[]>`
    select envelope from venue.outbox where message_key = ${slotId} and envelope->>'type' = 'venue-booking.buffer-conflict-flagged'
    order by created_at
  `;

describe("an approval occupies the venue for the event widened by its setup and turnaround time (H3-T8, H3-T9)", () => {
  it("copies the venue's times into the booking, so the calendar shows it occupied 09:30–12:45 (H3-T8)", async () => {
    const venueId = await newVenue(30, 45);
    const event = await newEvent("H3 Symposium");
    const booking = await booked(venueId, event, "10:00", "12:00");

    expect(await slot(booking.bookingId)).toMatchObject({ setup_minutes: 30, turnaround_minutes: 45, status: "CONFIRMED" });
    signedInAs("EVENT_COORDINATOR", COORDINATOR);
    const res = await calendar(venueId);
    expect(res.status).toBe(200);
    const parts = (res.body.days[0].committed as { kind: string; startsAt: string; endsAt: string }[]).filter((p) => p.kind !== "OUTSIDE_HOURS");
    expect(parts.map((p) => [p.kind, p.startsAt, p.endsAt])).toEqual([
      ["SETUP", utc("09:30"), utc("10:00")],
      ["BOOKING", utc("10:00"), utc("12:00")],
      ["TURNAROUND", utc("12:00"), utc("12:45")],
    ]);
  });

  it("approves a booking whose occupied period only touches another's at 12:45, and refuses one that overlaps it (H3-T9)", async () => {
    const venueId = await newVenue(30, 45);
    const symposium = await newEvent("H3 Symposium");
    await booked(venueId, symposium, "10:00", "12:00");

    // Occupied 12:45–14:45: it starts as the symposium's turnaround ends.
    const touching = await approval(venueId, await newEvent("H3 Workshop"), "13:15", "14:00");
    expect(touching.res.status).toBe(200);

    // Occupied 14:15–16:15: its setup runs into the workshop's turnaround, which ends at 14:45.
    const tooClose = await approval(venueId, await newEvent("H3 Talk"), "14:45", "15:30");
    expect(tooClose.res.status).toBe(409);
    expect(tooClose.res.body.error.code).toBe("VENUE_SLOT_CONFLICT");
  });
});

describe("PUT /api/v1/venues/:id with new setup or turnaround time (H3-T10)", () => {
  it("flags both bookings that now overlap, each naming the other, and moves neither", async () => {
    const venueId = await newVenue();
    const symposium = await newEvent("H3 Symposium");
    const workshop = await newEvent("H3 Workshop", OTHER_COORDINATOR);
    const morning = await booked(venueId, symposium, "10:00", "12:00");
    const midday = await booked(venueId, workshop, "12:15", "14:00", OTHER_COORDINATOR);

    signedInAs("VENUE_STAFF", STAFF);
    const res = await save(venueId, 0, 30);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: venueId, setupMinutes: 0, turnaroundMinutes: 30 });
    expect(res.body.flaggedBookings).toEqual([
      { kind: "BOOKING", reference: morning.reference, eventReference: symposium.reference, overlapsReferences: [midday.reference] },
      { kind: "BOOKING", reference: midday.reference, eventReference: workshop.reference, overlapsReferences: [morning.reference] },
    ]);
    for (const [booking, from, until] of [[morning, "10:00", "12:00"], [midday, "12:15", "14:00"]] as const) {
      expect(await slot(booking.bookingId)).toEqual({
        status: "CONFIRMED",
        starts_at: new Date(at(from)),
        ends_at: new Date(at(until)),
        setup_minutes: 0,
        turnaround_minutes: 0,
        requires_reconfirmation: true,
      });
    }
  });

  it("shows each coordinator their booking flagged, naming the booking it overlaps", async () => {
    const venueId = await newVenue();
    const symposium = await newEvent("H3 Symposium");
    const workshop = await newEvent("H3 Workshop", OTHER_COORDINATOR);
    const morning = await booked(venueId, symposium, "10:00", "12:00");
    const midday = await booked(venueId, workshop, "12:15", "14:00", OTHER_COORDINATOR);
    signedInAs("VENUE_STAFF", STAFF);
    expect((await save(venueId, 0, 30)).status).toBe(200);

    signedInAs("EVENT_COORDINATOR", COORDINATOR);
    const mine = await eventBookings(symposium.id);
    expect(mine.body.bookings).toMatchObject([{ reference: morning.reference, requiresReconfirmation: true, overlaps: [midday.reference] }]);
    signedInAs("EVENT_COORDINATOR", OTHER_COORDINATOR);
    const theirs = await eventBookings(workshop.id);
    expect(theirs.body.bookings).toMatchObject([{ reference: midday.reference, requiresReconfirmation: true, overlaps: [morning.reference] }]);
  });

  it("tells each booking's assigned coordinator, with the venue's new times and what it overlaps", async () => {
    const venueId = await newVenue();
    const symposium = await newEvent("H3 Symposium");
    const workshop = await newEvent("H3 Workshop", OTHER_COORDINATOR);
    const morning = await booked(venueId, symposium, "10:00", "12:00");
    const midday = await booked(venueId, workshop, "12:15", "14:00", OTHER_COORDINATOR);
    signedInAs("VENUE_STAFF", STAFF);
    await save(venueId, 0, 30);

    const [toMorning] = await flaggedMessages(morning.bookingId);
    expect(toMorning!.envelope.data).toEqual({
      venueId,
      venueName: VENUE_NAME,
      kind: "BOOKING",
      reference: morning.reference,
      eventId: symposium.id,
      eventReference: symposium.reference,
      eventName: "H3 Symposium",
      coordinatorId: COORDINATOR,
      overlapsReferences: [midday.reference],
      setupMinutes: 0,
      turnaroundMinutes: 30,
      actedBy: STAFF,
      actedAt: expect.any(String),
    });
    const [toMidday] = await flaggedMessages(midday.bookingId);
    expect(toMidday!.envelope.data).toMatchObject({ coordinatorId: OTHER_COORDINATOR, overlapsReferences: [morning.reference] });
  });

  it("records which booking overlaps which, the venue's times, who and when", async () => {
    const venueId = await newVenue();
    const morning = await booked(venueId, await newEvent("H3 Symposium"), "10:00", "12:00");
    const midday = await booked(venueId, await newEvent("H3 Workshop"), "12:15", "14:00");
    signedInAs("VENUE_STAFF", STAFF);
    const before = Date.now();
    await save(venueId, 0, 30);

    const rows = await sql<{ slot_id: string; other_slot_id: string; setup_minutes: number; turnaround_minutes: number; created_by: string; created_at: Date; cleared_at: Date | null }[]>`
      select slot_id, other_slot_id, setup_minutes, turnaround_minutes, created_by, created_at, cleared_at
      from venue.buffer_conflicts where venue_id = ${venueId} order by created_at, slot_id
    `;
    expect(rows.map((r) => [r.slot_id, r.other_slot_id]).sort()).toEqual(
      [[morning.bookingId, midday.bookingId], [midday.bookingId, morning.bookingId]].sort(),
    );
    for (const row of rows) {
      expect(row).toMatchObject({ setup_minutes: 0, turnaround_minutes: 30, created_by: STAFF, cleared_at: null });
      expect(row.created_at.getTime()).toBeGreaterThanOrEqual(before - 5_000);
    }
  });

  it("flags nothing when the bookings still fit, when only touching, or when another field changes", async () => {
    const venueId = await newVenue();
    const morning = await booked(venueId, await newEvent("H3 Symposium"), "10:00", "12:00");
    const midday = await booked(venueId, await newEvent("H3 Workshop"), "12:15", "14:00");
    signedInAs("VENUE_STAFF", STAFF);

    const touching = await save(venueId, 0, 15);
    expect(touching.status).toBe(200);
    expect(touching.body.flaggedBookings).toEqual([]);
    const capacityOnly = await request(app).put(`/api/v1/venues/${venueId}`).set(bearer).send({ ...venueBody(0, 15), maxCapacity: 290 });
    expect(capacityOnly.body.flaggedBookings).toEqual([]);
    for (const booking of [morning, midday]) {
      expect((await slot(booking.bookingId)).requires_reconfirmation).toBe(false);
      expect(await flaggedMessages(booking.bookingId)).toHaveLength(0);
    }
  });

  it("tells the coordinator once: saving the same times again flags nothing new", async () => {
    const venueId = await newVenue();
    const morning = await booked(venueId, await newEvent("H3 Symposium"), "10:00", "12:00");
    await booked(venueId, await newEvent("H3 Workshop"), "12:15", "14:00");
    signedInAs("VENUE_STAFF", STAFF);
    await save(venueId, 0, 30);
    const again = await request(app).put(`/api/v1/venues/${venueId}`).set(bearer).send({ ...venueBody(0, 30), maxCapacity: 290 });

    expect(again.body.flaggedBookings).toEqual([]);
    expect(await flaggedMessages(morning.bookingId)).toHaveLength(1);
  });

  it("tells a coordinator again when a further change makes their booking overlap one more", async () => {
    const venueId = await newVenue();
    const morning = await booked(venueId, await newEvent("H3 Symposium"), "10:00", "12:00");
    const midday = await booked(venueId, await newEvent("H3 Workshop"), "12:15", "14:00");
    const early = await booked(venueId, await newEvent("H3 Breakfast"), "08:00", "09:00");
    signedInAs("VENUE_STAFF", STAFF);
    await save(venueId, 0, 30);
    const res = await save(venueId, 0, 75);

    expect(res.body.flaggedBookings).toEqual([
      expect.objectContaining({ reference: early.reference, overlapsReferences: [morning.reference] }),
      expect.objectContaining({ reference: morning.reference, overlapsReferences: [early.reference, midday.reference] }),
    ]);
    const toMorning = await flaggedMessages(morning.bookingId);
    expect(toMorning.map((m) => m.envelope.data.overlapsReferences)).toEqual([[midday.reference], [early.reference, midday.reference]]);
  });

  it("flags a hold as a hold, and leaves bookings that have already ended alone", async () => {
    const venueId = await newVenue();
    const event = await newEvent("H3 Symposium");
    const booking = await booked(venueId, event, "10:00", "12:00");
    const hold = await held(venueId, event, "12:15", "14:00");
    const [past] = await sql<{ id: string }[]>`
      insert into venue.venue_slots (venue_id, event_id, reference, starts_at, ends_at, status, created_by, updated_by)
      values (${venueId}, ${event.id}, 'H3-PAST-1', '2026-10-01T10:00:00+08:00', '2026-10-01T12:00:00+08:00', 'CONFIRMED', ${STAFF}, ${STAFF}),
             (${venueId}, ${event.id}, 'H3-PAST-2', '2026-10-01T12:15:00+08:00', '2026-10-01T14:00:00+08:00', 'CONFIRMED', ${STAFF}, ${STAFF})
      returning id
    `;
    signedInAs("VENUE_STAFF", STAFF);
    const res = await save(venueId, 0, 30);

    expect(res.body.flaggedBookings).toEqual([
      expect.objectContaining({ kind: "BOOKING", reference: booking.reference, overlapsReferences: [hold.reference] }),
      expect.objectContaining({ kind: "HOLD", reference: hold.reference, overlapsReferences: [booking.reference] }),
    ]);
    expect((await flaggedMessages(hold.bookingId))[0]!.envelope.data).toMatchObject({ kind: "HOLD", coordinatorId: COORDINATOR });
    expect((await slot(past!.id)).requires_reconfirmation).toBe(false);
  });

  it("clears the flag once the times fit again, keeping the record, unless a block still disrupts the booking (I2)", async () => {
    const venueId = await newVenue();
    const morning = await booked(venueId, await newEvent("H3 Symposium"), "10:00", "12:00");
    const midday = await booked(venueId, await newEvent("H3 Workshop"), "12:15", "14:00");
    signedInAs("VENUE_STAFF", STAFF);
    const block = await request(app)
      .post(`/api/v1/venues/${venueId}/unavailability`)
      .set(bearer)
      .send({ startsAt: at("10:30"), endsAt: at("11:00"), reasonType: "MAINTENANCE", description: "Projector replacement" });
    expect(block.status).toBe(201);
    await save(venueId, 0, 30);

    const res = await save(venueId, 0, 0);
    expect(res.body.flaggedBookings).toEqual([]);
    expect((await slot(morning.bookingId)).requires_reconfirmation).toBe(true);
    expect((await slot(midday.bookingId)).requires_reconfirmation).toBe(false);
    const rows = await sql<{ cleared_by: string | null; cleared_at: Date | null }[]>`
      select cleared_by, cleared_at from venue.buffer_conflicts where venue_id = ${venueId}
    `;
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.cleared_by).toBe(STAFF);
      expect(row.cleared_at).toBeInstanceOf(Date);
    }
  });

  it("keeps a booking flagged when its block is removed while the venue's times still make it overlap another (I2-T11)", async () => {
    const venueId = await newVenue();
    const morning = await booked(venueId, await newEvent("H3 Symposium"), "10:00", "12:00");
    await booked(venueId, await newEvent("H3 Workshop"), "12:15", "14:00");
    signedInAs("VENUE_STAFF", STAFF);
    const block = await request(app)
      .post(`/api/v1/venues/${venueId}/unavailability`)
      .set(bearer)
      .send({ startsAt: at("10:30"), endsAt: at("11:00"), reasonType: "MAINTENANCE", description: "Projector replacement" });
    await save(venueId, 0, 30);

    const removed = await request(app).post(`/api/v1/venues/${venueId}/unavailability/${block.body.block.id}/remove`).set(bearer);
    expect(removed.status).toBe(200);
    expect(removed.body.cleared).toEqual([expect.objectContaining({ reference: morning.reference, stillDisrupted: true })]);
    expect((await slot(morning.bookingId)).requires_reconfirmation).toBe(true);
  });
});
