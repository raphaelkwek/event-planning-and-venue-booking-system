import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { testDb } from "../../support/testDb.js";
import { releaseVenueArrangementsForEvent } from "../../../src/modules/venue/index.js";

/**
 * L4 (CR-03) — one event with requests, holds and bookings at several venues
 * at once. Each venue is checked and decided on its own, the event shows them
 * all, changing one leaves the others alone, and cancelling the event releases
 * every one (the venue module's half of F4).
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
const OWNER = "a9999999-0000-0000-0000-0000000000a1";
const COORDINATOR = "a9999999-0000-0000-0000-0000000000a2";
const STAFF = "a9999999-0000-0000-0000-0000000000a3";
const OTHER_STAFF = "a9999999-0000-0000-0000-0000000000a4";
const bearer = { Authorization: "Bearer test-token" };

function signedInAs(role: string, userId: string) {
  vi.mocked(resolveCurrentUser).mockResolvedValue({ id: userId, email: "user@connectsphere.test", role: role as never });
}
const asCoordinator = () => signedInAs("EVENT_COORDINATOR", COORDINATOR);
const asStaff = (staff = STAFF) => signedInAs("VENUE_STAFF", staff);

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

async function cleanUp() {
  const ours = sql`select id from venue.venues where created_by in ${sql([STAFF, OTHER_STAFF])}`;
  await sql`delete from venue.outbox where message_key in (select id::text from venue.booking_requests where venue_id in (${ours}))`;
  await sql`delete from venue.outbox where message_key in (select id::text from venue.holds where venue_id in (${ours}))`;
  await sql`delete from venue.holds where venue_id in (${ours})`;
  await sql`delete from venue.booking_requests where venue_id in (${ours})`;
  await sql`delete from venue.venue_slots where venue_id in (${ours})`;
  await sql`delete from venue.venue_staff where venue_id in (${ours})`;
  await sql`delete from venue.venues where created_by in ${sql([STAFF, OTHER_STAFF])}`;
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

async function newVenue(name: string, layouts: { name: string; capacity: number }[], staff = STAFF): Promise<string> {
  const [row] = await sql<{ id: string }[]>`
    insert into venue.venues (name, building, max_capacity, layouts, operating_hours, created_by, updated_by)
    values (${name}, 'L4 Test Building', ${Math.max(...layouts.map((l) => l.capacity))}, ${sql.json(layouts)}, ${sql.json(HOURS)}, ${staff}, ${staff})
    returning id
  `;
  await sql`insert into venue.venue_staff (venue_id, user_id, created_by, updated_by) values (${row!.id}, ${staff}, ${staff}, ${staff})`;
  return row!.id;
}

/** The main hall, a breakout room, and a hall another Venue Staff member looks after. */
async function venues() {
  return {
    hall: await newVenue("L4 Main Hall", [{ name: "Theatre", capacity: 300 }]),
    breakout: await newVenue("L4 Breakout Room", [{ name: "Classroom", capacity: 60 }]),
    annex: await newVenue("L4 Annex", [{ name: "Theatre", capacity: 500 }], OTHER_STAFF),
  };
}

/** A Singapore time on Wednesday 2 December 2026. */
const at = (hhmm: string) => `2026-12-02T${hhmm}:00+08:00`;
const utc = (hhmm: string) => new Date(at(hhmm)).toISOString();

async function newEvent(): Promise<{ id: string; reference: string }> {
  const [row] = await sql<{ id: string; reference: string }[]>`
    insert into event.events (
      reference, owner_id, name, purpose, description, proposed_start_at, proposed_end_at,
      expected_attendance, equipment_required, registration_required, status, submitted_at,
      last_saved_at, created_by, updated_by
    ) values (
      'EVT-' || lpad(nextval('event.event_reference_seq')::text, 6, '0'), ${OWNER}, 'L4 Research Symposium', 'L4 test',
      'L4 test', ${at("14:00")}, ${at("18:00")}, 150, false, false, 'APPROVED', now(), now(), ${OWNER}, ${OWNER}
    )
    returning id, reference
  `;
  await sql`insert into event.assignments (event_id, coordinator_id, assignment_rule, created_by, updated_by)
            values (${row!.id}, ${COORDINATOR}, 'TEST', ${COORDINATOR}, ${COORDINATOR})`;
  return row!;
}

const submit = (body: object) => request(app).post("/api/v1/booking-requests").set(bearer).send(body);

async function requested(eventId: string, venueId: string, layout: string, attendance: number, extra: object = {}) {
  asCoordinator();
  const res = await submit({ eventId, venueId, startsAt: at("14:00"), endsAt: at("18:00"), layout, expectedAttendance: attendance, ...extra });
  expect(res.status).toBe(201);
  return res.body as { id: string; reference: string };
}

async function booked(eventId: string, venueId: string, layout: string, attendance: number) {
  const made = await requested(eventId, venueId, layout, attendance);
  asStaff();
  const res = await request(app).post(`/api/v1/booking-requests/${made.id}/approve`).set(bearer);
  expect(res.status).toBe(200);
  return { ...made, bookingId: res.body.bookingId as string };
}

async function held(eventId: string, venueId: string) {
  asCoordinator();
  const asked = await request(app)
    .post("/api/v1/holds")
    .set(bearer)
    .send({ eventId, venueId, startsAt: at("14:00"), endsAt: at("18:00"), reminderLeadMinutes: 1440 });
  expect(asked.status).toBe(201);
  asStaff();
  const placed = await request(app).post(`/api/v1/holds/${asked.body.id}/place`).set(bearer).send({ expiresAt: "2026-12-01T18:00+08:00" });
  expect(placed.status).toBe(200);
  return placed.body as { id: string; reference: string; slotId: string };
}

async function eventView(eventId: string) {
  asCoordinator();
  const res = await request(app).get("/api/v1/booking-requests").query({ eventId }).set(bearer);
  expect(res.status).toBe(200);
  const holds = await request(app).get("/api/v1/holds").query({ eventId }).set(bearer);
  return { items: res.body.items as { reference: string; venueName: string; status: string; startsAt: string; endsAt: string }[], bookings: res.body.bookings as { reference: string; venueName: string; status: string; startsAt: string; endsAt: string; requiresReconfirmation: boolean }[], holds: holds.body.items as { reference: string; status: string; venueId: string }[] };
}

const slotStatus = async (id: string) => (await sql<{ status: string }[]>`select status from venue.venue_slots where id = ${id}`)[0]!.status;

describe("one event, several venues at once (L4, CR-03)", () => {
  it("records requests for several venues for the same period against the same event (L4-T1)", async () => {
    const v = await venues();
    const event = await newEvent();
    const hall = await requested(event.id, v.hall, "Theatre", 150);
    const breakout = await requested(event.id, v.breakout, "Classroom", 40);

    const rows = await sql<{ reference: string; event_id: string; layout: string; expected_attendance: number }[]>`
      select reference, event_id, layout, expected_attendance from venue.booking_requests where id in (${hall.id}, ${breakout.id}) order by reference
    `;
    expect(rows.map((r) => [r.event_id, r.layout, r.expected_attendance])).toEqual([
      [event.id, "Theatre", 150],
      [event.id, "Classroom", 40],
    ]);
    expect((await eventView(event.id)).items.map((i) => [i.reference, i.status])).toEqual([
      [hall.reference, "PENDING"],
      [breakout.reference, "PENDING"],
    ]);
  });

  it("judges each venue against its own request's layout and attendance (L4-T2, K2)", async () => {
    const v = await venues();
    const event = await newEvent();
    await requested(event.id, v.hall, "Theatre", 150);
    asCoordinator();
    const refused = await submit({ eventId: event.id, venueId: v.breakout, startsAt: at("14:00"), endsAt: at("18:00"), layout: "Classroom", expectedAttendance: 150 });
    expect(refused.status).toBe(422);
    expect(refused.body.error.code).toBe("JUSTIFICATION_REQUIRED");
    const breakout = await requested(event.id, v.breakout, "Classroom", 40);
    expect(breakout).toMatchObject({ suitabilityStatus: "SUITABLE" });
  });

  it("checks conflicts and approval at each venue on its own (L4-T3, N1, N2)", async () => {
    const v = await venues();
    const other = await newEvent();
    const theirs = await booked(other.id, v.hall, "Theatre", 150);
    const event = await newEvent();
    const hall = await requested(event.id, v.hall, "Theatre", 150);
    const breakout = await requested(event.id, v.breakout, "Classroom", 40);

    asStaff();
    const queue = new Map((await request(app).get("/api/v1/booking-requests/queue").set(bearer)).body.items.map((i: { reference: string; conflicts: unknown[] }) => [i.reference, i.conflicts]));
    expect(queue.get(hall.reference)).toEqual([{ kind: "BOOKING", reference: theirs.reference, startsAt: utc("14:00"), endsAt: utc("18:00") }]);
    expect(queue.get(breakout.reference)).toEqual([]);
    expect((await request(app).post(`/api/v1/booking-requests/${breakout.id}/approve`).set(bearer)).status).toBe(200);
    const refused = await request(app).post(`/api/v1/booking-requests/${hall.id}/approve`).set(bearer);
    expect(refused.status).toBe(409);
    expect(refused.body.error.code).toBe("VENUE_SLOT_CONFLICT");
  });

  it("leaves each venue's decision to its own Venue Staff (L4-T4, M1, M2)", async () => {
    const v = await venues();
    const event = await newEvent();
    const hall = await requested(event.id, v.hall, "Theatre", 150);
    const breakout = await requested(event.id, v.breakout, "Classroom", 40);
    const annex = await requested(event.id, v.annex, "Theatre", 150);

    asStaff();
    const queue = (await request(app).get("/api/v1/booking-requests/queue").set(bearer)).body.items.map((i: { reference: string }) => i.reference);
    expect(queue).toEqual(expect.arrayContaining([hall.reference, breakout.reference]));
    expect(queue).not.toContain(annex.reference);
    expect((await request(app).post(`/api/v1/booking-requests/${annex.id}/approve`).set(bearer)).status).toBe(403);
    expect((await request(app).post(`/api/v1/booking-requests/${hall.id}/approve`).set(bearer)).status).toBe(200);
    expect((await request(app).post(`/api/v1/booking-requests/${breakout.id}/reject`).set(bearer).send({ reason: "Room closed for exams" })).status).toBe(200);

    const items = new Map((await eventView(event.id)).items.map((i) => [i.reference, i.status]));
    expect([items.get(hall.reference), items.get(breakout.reference), items.get(annex.reference)]).toEqual(["APPROVED", "REJECTED", "PENDING"]);
  });

  it("shows the event's booking, hold and request at three venues together (L4-T5)", async () => {
    const v = await venues();
    const event = await newEvent();
    const booking = await booked(event.id, v.hall, "Theatre", 150);
    const hold = await held(event.id, v.breakout);
    const pending = await requested(event.id, v.annex, "Theatre", 150);

    const view = await eventView(event.id);
    expect(view.bookings).toEqual([
      expect.objectContaining({ reference: booking.reference, venueName: "L4 Main Hall", status: "CONFIRMED", startsAt: utc("14:00"), endsAt: utc("18:00") }),
    ]);
    expect(view.holds).toEqual([expect.objectContaining({ reference: hold.reference, status: "HELD", venueId: v.breakout })]);
    expect(view.items).toEqual(
      expect.arrayContaining([expect.objectContaining({ reference: pending.reference, venueName: "L4 Annex", status: "PENDING", startsAt: utc("14:00") })]),
    );
  });
});

describe("changing one arrangement leaves the others alone (L4-T6 to L4-T8)", () => {
  it("withdraws one request and leaves the other request and the booking", async () => {
    const v = await venues();
    const event = await newEvent();
    const booking = await booked(event.id, v.hall, "Theatre", 150);
    const breakout = await requested(event.id, v.breakout, "Classroom", 40);
    const annex = await requested(event.id, v.annex, "Theatre", 150);

    asCoordinator();
    expect((await request(app).post(`/api/v1/booking-requests/${breakout.id}/withdraw`).set(bearer)).status).toBe(200);
    const items = new Map((await eventView(event.id)).items.map((i) => [i.reference, i.status]));
    expect([items.get(breakout.reference), items.get(annex.reference)]).toEqual(["WITHDRAWN", "PENDING"]);
    expect(await slotStatus(booking.bookingId)).toBe("CONFIRMED");
  });

  it("rejects one request and leaves the booking unflagged", async () => {
    const v = await venues();
    const event = await newEvent();
    const booking = await booked(event.id, v.hall, "Theatre", 150);
    const breakout = await requested(event.id, v.breakout, "Classroom", 40);

    asStaff();
    expect((await request(app).post(`/api/v1/booking-requests/${breakout.id}/reject`).set(bearer).send({ reason: "Room closed for exams" })).status).toBe(200);
    expect((await eventView(event.id)).bookings).toEqual([
      expect.objectContaining({ reference: booking.reference, status: "CONFIRMED", requiresReconfirmation: false }),
    ]);
  });

  it("releases one booking and leaves the other confirmed", async () => {
    const v = await venues();
    const event = await newEvent();
    const hall = await booked(event.id, v.hall, "Theatre", 150);
    const breakout = await booked(event.id, v.breakout, "Classroom", 40);

    await sql`update venue.venue_slots set status = 'RELEASED', updated_at = now() where id = ${breakout.bookingId}`;
    expect(await slotStatus(hall.bookingId)).toBe("CONFIRMED");
    expect((await eventView(event.id)).bookings.map((b) => [b.reference, b.status])).toEqual(
      expect.arrayContaining([[hall.reference, "CONFIRMED"], [breakout.reference, "RELEASED"]]),
    );
  });
});

describe("cancelling the event releases every venue arrangement (L4-T9, for F4)", () => {
  it("releases each booking and hold and withdraws each pending request, at every venue, and frees the venues", async () => {
    const v = await venues();
    const event = await newEvent();
    const booking = await booked(event.id, v.hall, "Theatre", 150);
    const hold = await held(event.id, v.breakout);
    const pending = await requested(event.id, v.annex, "Theatre", 150);
    const other = await newEvent();
    const theirs = await requested(other.id, v.annex, "Theatre", 150);

    const released = await sql.begin((tx) => releaseVenueArrangementsForEvent(tx, event.id, OWNER));

    expect(released).toEqual({ bookings: [booking.reference], holds: [hold.reference], requests: [pending.reference] });
    expect(await slotStatus(booking.bookingId)).toBe("RELEASED");
    expect(await slotStatus(hold.slotId)).toBe("RELEASED");
    const [slot] = await sql<{ release_reason: string; updated_by: string }[]>`select release_reason, updated_by from venue.venue_slots where id = ${booking.bookingId}`;
    expect(slot).toEqual({ release_reason: "event cancelled", updated_by: OWNER });
    const [req] = await sql<{ status: string; withdrawn_by: string }[]>`select status, withdrawn_by from venue.booking_requests where id = ${pending.id}`;
    expect(req).toEqual({ status: "WITHDRAWN", withdrawn_by: OWNER });
    const [h] = await sql<{ status: string }[]>`select status from venue.holds where id = ${hold.id}`;
    expect(h!.status).toBe("RELEASED");
    // Another event's request at the same venue is untouched.
    const [still] = await sql<{ status: string }[]>`select status from venue.booking_requests where id = ${theirs.id}`;
    expect(still!.status).toBe("PENDING");

    // Each venue is free again: another event's request for the period can be approved.
    const next = await requested(other.id, v.hall, "Theatre", 150);
    asStaff();
    expect((await request(app).post(`/api/v1/booking-requests/${next.id}/approve`).set(bearer)).status).toBe(200);
  });

  it("releases a hold converted into a pending request, with the request", async () => {
    const v = await venues();
    const event = await newEvent();
    const hold = await held(event.id, v.breakout);
    asCoordinator();
    const converted = await request(app).post(`/api/v1/holds/${hold.id}/convert`).set(bearer).send({ layout: "Classroom", expectedAttendance: 40 });
    expect(converted.status).toBe(201);

    const released = await sql.begin((tx) => releaseVenueArrangementsForEvent(tx, event.id, OWNER));
    expect(released).toEqual({ bookings: [], holds: [], requests: [converted.body.request.reference] });
    expect(await slotStatus(hold.slotId)).toBe("RELEASED");
  });

  it("does nothing, and says so, for an event with no live arrangements", async () => {
    const v = await venues();
    const event = await newEvent();
    const made = await requested(event.id, v.hall, "Theatre", 150);
    asCoordinator();
    await request(app).post(`/api/v1/booking-requests/${made.id}/withdraw`).set(bearer);

    expect(await sql.begin((tx) => releaseVenueArrangementsForEvent(tx, event.id, OWNER))).toEqual({ bookings: [], holds: [], requests: [] });
  });
});
