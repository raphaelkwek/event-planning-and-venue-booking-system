import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { testDb } from "../../support/testDb.js";

/**
 * N2 — each pending request is flagged with the other pending requests and
 * confirmed bookings at its venue whose occupied periods overlap its own
 * (CR-01), for Venue Staff in their queue and for the coordinator on the
 * event's venue requests. The flag is worked out on every read, so creating,
 * approving, rejecting, withdrawing or releasing a booking changes it, and it
 * decides nothing.
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
const OWNER = "a9999999-0000-0000-0000-000000000091";
const COORDINATOR = "a9999999-0000-0000-0000-000000000092";
const OTHER_COORDINATOR = "a9999999-0000-0000-0000-000000000095";
const STAFF = "a9999999-0000-0000-0000-000000000093";
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

async function cleanUp() {
  const ours = sql`select id from venue.venues where created_by = ${STAFF}`;
  const blocks = sql`select id from venue.unavailability_blocks where venue_id in (${ours})`;
  await sql`delete from venue.outbox where message_key in (select id::text from venue.unavailability_blocks where venue_id in (${ours}))`;
  await sql`delete from venue.outbox where message_key in (select id::text from venue.booking_requests where venue_id in (${ours}))`;
  await sql`delete from venue.block_disruptions where block_id in (${blocks})`;
  await sql`delete from venue.booking_requests where venue_id in (${ours})`;
  await sql`delete from venue.venue_slots where venue_id in (${ours})`;
  await sql`delete from venue.unavailability_blocks where venue_id in (${ours})`;
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

async function newVenue(name: string, setup = 0, turnaround = 0): Promise<string> {
  const [row] = await sql<{ id: string }[]>`
    insert into venue.venues
      (name, building, max_capacity, layouts, operating_hours, setup_minutes, turnaround_minutes, created_by, updated_by)
    values (${name}, 'N2 Test Building', 300, ${sql.json(LAYOUTS)}, ${sql.json(HOURS)}, ${setup}, ${turnaround}, ${STAFF}, ${STAFF})
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
      'EVT-' || lpad(nextval('event.event_reference_seq')::text, 6, '0'), ${OWNER}, ${name}, 'N2 test',
      'N2 test', ${at("14:00")}, ${at("18:00")}, 150, false, false, 'APPROVED', now(), now(), ${OWNER}, ${OWNER}
    )
    returning id, reference
  `;
  await sql`insert into event.assignments (event_id, coordinator_id, assignment_rule, created_by, updated_by)
            values (${row!.id}, ${coordinator}, 'TEST', ${coordinator}, ${coordinator})`;
  return row!;
}

interface Made {
  id: string;
  reference: string;
  conflicts: unknown[];
}

/** The event's coordinator requests the venue, Theatre (L1). */
async function requested(venueId: string, event: { id: string }, from: string, until: string, coordinator = COORDINATOR, extra: object = {}): Promise<Made> {
  signedInAs("EVENT_COORDINATOR", coordinator);
  const res = await request(app)
    .post("/api/v1/booking-requests")
    .set(bearer)
    .send({ eventId: event.id, venueId, startsAt: at(from), endsAt: at(until), layout: "Theatre", expectedAttendance: 150, ...extra });
  expect(res.status).toBe(201);
  return res.body as Made;
}

/** Another event's confirmed booking at the venue, with the times it was made with. */
async function confirmed(venueId: string, from: string, until: string, setup = 0, turnaround = 0, status = "CONFIRMED") {
  const event = await newEvent("Other Department Seminar");
  const reference = `N2-FX-${event.reference}`;
  const [row] = await sql<{ id: string }[]>`
    insert into venue.venue_slots
      (venue_id, event_id, reference, starts_at, ends_at, setup_minutes, turnaround_minutes, status, created_by, updated_by)
    values (${venueId}, ${event.id}, ${reference}, ${at(from)}, ${at(until)}, ${setup}, ${turnaround}, ${status}, ${STAFF}, ${STAFF})
    returning id
  `;
  return { id: row!.id, reference };
}

async function queue(): Promise<Map<string, { status: string; conflicts: unknown[] }>> {
  signedInAs("VENUE_STAFF", STAFF);
  const res = await request(app).get("/api/v1/booking-requests/queue").set(bearer);
  expect(res.status).toBe(200);
  return new Map((res.body.items as { reference: string; status: string; conflicts: unknown[] }[]).map((item) => [item.reference, item]));
}

const conflictsOf = async (reference: string) => (await queue()).get(reference)!.conflicts;
const asRequest = (made: { reference: string }, from: string, until: string) => ({ kind: "REQUEST", reference: made.reference, startsAt: utc(from), endsAt: utc(until) });
const asBooking = (reference: string, from: string, until: string) => ({ kind: "BOOKING", reference, startsAt: utc(from), endsAt: utc(until) });

const approve = (id: string) => {
  signedInAs("VENUE_STAFF", STAFF);
  return request(app).post(`/api/v1/booking-requests/${id}/approve`).set(bearer);
};

describe("the queue flags each pending request that overlaps another, or a confirmed booking (N2)", () => {
  it("flags two overlapping pending requests at one venue, each naming the other and its period (N2-T1)", async () => {
    const venueId = await newVenue("N2 Auditorium");
    const a = await requested(venueId, await newEvent("N2 Symposium"), "14:00", "18:00");
    const b = await requested(venueId, await newEvent("N2 Awards Night", OTHER_COORDINATOR), "16:00", "20:00", OTHER_COORDINATOR);

    const items = await queue();
    expect(items.get(a.reference)!.conflicts).toEqual([asRequest(b, "16:00", "20:00")]);
    expect(items.get(b.reference)!.conflicts).toEqual([asRequest(a, "14:00", "18:00")]);
    expect([items.get(a.reference)!.status, items.get(b.reference)!.status]).toEqual(["PENDING", "PENDING"]);
  });

  it("flags a pending request that overlaps a confirmed booking, naming the booking and its period (N2-T2)", async () => {
    const venueId = await newVenue("N2 Auditorium");
    const booking = await confirmed(venueId, "13:00", "15:00");
    const a = await requested(venueId, await newEvent("N2 Symposium"), "14:00", "18:00");

    expect(await conflictsOf(a.reference)).toEqual([asBooking(booking.reference, "13:00", "15:00")]);
  });

  it("lists every conflict, soonest first", async () => {
    const venueId = await newVenue("N2 Auditorium");
    const a = await requested(venueId, await newEvent("N2 Symposium"), "12:00", "18:00");
    const b = await requested(venueId, await newEvent("N2 Awards Night"), "16:00", "20:00");
    const booking = await confirmed(venueId, "10:00", "13:00");

    expect(await conflictsOf(a.reference)).toEqual([asBooking(booking.reference, "10:00", "13:00"), asRequest(b, "16:00", "20:00")]);
  });

  it("returns a new request's conflicts in the response to raising it", async () => {
    const venueId = await newVenue("N2 Auditorium");
    const booking = await confirmed(venueId, "13:00", "15:00");
    const a = await requested(venueId, await newEvent("N2 Symposium"), "14:00", "18:00");

    expect(a.conflicts).toEqual([asBooking(booking.reference, "13:00", "15:00")]);
  });
});

describe("occupied periods are compared (N2, CR-01)", () => {
  it("widens a pending request by the venue's setup time (N2-T3)", async () => {
    const venueId = await newVenue("N2 Auditorium", 30, 0);
    const booking = await confirmed(venueId, "10:00", "13:45");
    const a = await requested(venueId, await newEvent("N2 Symposium"), "14:00", "18:00");

    expect(await conflictsOf(a.reference)).toEqual([asBooking(booking.reference, "10:00", "13:45")]);
  });

  it("uses the turnaround time a confirmed booking was made with", async () => {
    const venueId = await newVenue("N2 Auditorium");
    const booking = await confirmed(venueId, "10:00", "13:30", 0, 45);
    const a = await requested(venueId, await newEvent("N2 Symposium"), "14:00", "18:00");

    expect(await conflictsOf(a.reference)).toEqual([asBooking(booking.reference, "10:00", "13:30")]);
  });

  it("widens both pending requests by the venue's times", async () => {
    const venueId = await newVenue("N2 Auditorium", 0, 30);
    const a = await requested(venueId, await newEvent("N2 Symposium"), "10:00", "12:00");
    const b = await requested(venueId, await newEvent("N2 Awards Night"), "12:15", "14:00");

    const items = await queue();
    expect(items.get(a.reference)!.conflicts).toEqual([asRequest(b, "12:15", "14:00")]);
    expect(items.get(b.reference)!.conflicts).toEqual([asRequest(a, "10:00", "12:00")]);
  });

  it("doesn't flag periods that only touch, or overlapping ones at another venue (N2-T4)", async () => {
    const venueId = await newVenue("N2 Auditorium");
    const otherVenue = await newVenue("N2 Seminar Room");
    await confirmed(venueId, "10:00", "14:00");
    const event = await newEvent("N2 Symposium");
    const a = await requested(venueId, event, "14:00", "18:00");
    const elsewhere = await requested(otherVenue, event, "14:00", "18:00");

    const items = await queue();
    expect(items.get(a.reference)!.conflicts).toEqual([]);
    expect(items.get(elsewhere.reference)!.conflicts).toEqual([]);
  });

  it("leaves out holds, released bookings, and the disrupted booking a replacement replaces (L5)", async () => {
    const venueId = await newVenue("N2 Auditorium");
    await confirmed(venueId, "08:00", "09:30", 0, 0, "HELD");
    await confirmed(venueId, "13:00", "15:00", 0, 0, "RELEASED");
    const a = await requested(venueId, await newEvent("N2 Symposium"), "08:30", "16:00");
    expect(await conflictsOf(a.reference)).toEqual([]);

    const event = await newEvent("N2 Gala");
    const original = await requested(venueId, event, "17:00", "21:00");
    const booked = await approve(original.id);
    expect(booked.status).toBe(200);
    await sql`update venue.venue_slots set requires_reconfirmation = true where id = ${booked.body.bookingId}`;
    const replacement = await requested(venueId, event, "17:30", "20:30", COORDINATOR, { replacesBookingId: booked.body.bookingId });
    expect(await conflictsOf(replacement.reference)).toEqual([]);
  });
});

describe("the coordinator sees the same flag (N2-T5)", () => {
  it("shows it on their own pending request on the event's venue requests", async () => {
    const venueId = await newVenue("N2 Auditorium");
    const event = await newEvent("N2 Symposium");
    const a = await requested(venueId, event, "14:00", "18:00");
    const b = await requested(venueId, await newEvent("N2 Awards Night", OTHER_COORDINATOR), "16:00", "20:00", OTHER_COORDINATOR);

    signedInAs("EVENT_COORDINATOR", COORDINATOR);
    const res = await request(app).get("/api/v1/booking-requests").query({ eventId: event.id }).set(bearer);
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([expect.objectContaining({ reference: a.reference, conflicts: [asRequest(b, "16:00", "20:00")] })]);
  });
});

describe("the flag follows every change at the venue (N2-T6 to N2-T8)", () => {
  async function pair() {
    const venueId = await newVenue("N2 Auditorium");
    const a = await requested(venueId, await newEvent("N2 Symposium"), "14:00", "18:00");
    const b = await requested(venueId, await newEvent("N2 Awards Night", OTHER_COORDINATOR), "16:00", "20:00", OTHER_COORDINATOR);
    return { venueId, a, b };
  }

  it("flags a request once an overlapping one is created (N2-T6)", async () => {
    const venueId = await newVenue("N2 Auditorium");
    const a = await requested(venueId, await newEvent("N2 Symposium"), "14:00", "18:00");
    expect(await conflictsOf(a.reference)).toEqual([]);
    const b = await requested(venueId, await newEvent("N2 Awards Night", OTHER_COORDINATOR), "16:00", "20:00", OTHER_COORDINATOR);
    expect(await conflictsOf(a.reference)).toEqual([asRequest(b, "16:00", "20:00")]);
  });

  it("clears it when the other is withdrawn (N2-T7)", async () => {
    const { a, b } = await pair();
    signedInAs("EVENT_COORDINATOR", OTHER_COORDINATOR);
    expect((await request(app).post(`/api/v1/booking-requests/${b.id}/withdraw`).set(bearer)).status).toBe(200);
    expect(await conflictsOf(a.reference)).toEqual([]);
  });

  it("clears it when the other is rejected, and a decided request carries no flag (N2-T7)", async () => {
    const { a, b } = await pair();
    signedInAs("VENUE_STAFF", STAFF);
    const rejected = await request(app).post(`/api/v1/booking-requests/${b.id}/reject`).set(bearer).send({ reason: "Double-booked" });
    expect(rejected.status).toBe(200);
    expect(rejected.body.conflicts).toEqual([]);
    expect(await conflictsOf(a.reference)).toEqual([]);
  });

  it("names the other's confirmed booking once it is approved, and clears when that booking is released (N2-T8)", async () => {
    const { a, b } = await pair();
    const approved = await approve(b.id);
    expect(approved.status).toBe(200);
    expect(await conflictsOf(a.reference)).toEqual([asBooking(b.reference, "16:00", "20:00")]);

    await sql`update venue.venue_slots set status = 'RELEASED', updated_at = now() where id = ${approved.body.bookingId}`;
    expect(await conflictsOf(a.reference)).toEqual([]);
  });

  it("follows a change of the venue's setup time (H3)", async () => {
    const venueId = await newVenue("N2 Auditorium");
    const booking = await confirmed(venueId, "10:00", "13:45");
    const a = await requested(venueId, await newEvent("N2 Symposium"), "14:00", "18:00");
    expect(await conflictsOf(a.reference)).toEqual([]);
    await sql`update venue.venues set setup_minutes = 30 where id = ${venueId}`;
    expect(await conflictsOf(a.reference)).toEqual([asBooking(booking.reference, "10:00", "13:45")]);
  });
});

describe("the flag is informational (N2-T9)", () => {
  it("lets a flagged request be approved, and leaves the other Pending, now flagged against the booking", async () => {
    const venueId = await newVenue("N2 Auditorium");
    const a = await requested(venueId, await newEvent("N2 Symposium"), "14:00", "18:00");
    const b = await requested(venueId, await newEvent("N2 Awards Night", OTHER_COORDINATOR), "16:00", "20:00", OTHER_COORDINATOR);

    const approved = await approve(a.id);
    expect(approved.status).toBe(200);
    expect(approved.body).toMatchObject({ status: "APPROVED", conflicts: [] });
    const items = await queue();
    expect(items.get(b.reference)).toMatchObject({ status: "PENDING", conflicts: [asBooking(a.reference, "14:00", "18:00")] });
  });
});
