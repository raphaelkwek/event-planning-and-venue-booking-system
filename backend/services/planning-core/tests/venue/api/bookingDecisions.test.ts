import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { testDb } from "../../support/testDb.js";

/**
 * M1, M2 — Venue Staff approve or reject a booking request, against the venue
 * and event schemas: the confirmed booking an approval creates, the refusals
 * that leave the request Pending, what a rejection records, who may decide,
 * and the messages for the coordinator and the owner. The setup mirrors
 * FX-BOOKING (tests/L1/README.md).
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
const OWNER = "a9999999-0000-0000-0000-000000000061";
const COORDINATOR = "a9999999-0000-0000-0000-000000000062";
const STAFF = "a9999999-0000-0000-0000-000000000063";
const OTHER_STAFF = "a9999999-0000-0000-0000-000000000064";
const BUILDING = "M1 Test Building";
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

async function cleanUp() {
  const ours = sql`select id from venue.venues where created_by in ${sql([STAFF, OTHER_STAFF])}`;
  await sql`delete from venue.outbox where message_key in (select id::text from venue.booking_requests where venue_id in (${ours}))`;
  await sql`delete from venue.booking_requests where venue_id in (${ours})`;
  await sql`delete from venue.venue_slots where venue_id in (${ours})`;
  await sql`delete from venue.unavailability_blocks where venue_id in (${ours})`;
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

async function newVenue(name: string, staff = STAFF): Promise<string> {
  const [row] = await sql<{ id: string }[]>`
    insert into venue.venues (name, building, max_capacity, layouts, operating_hours, created_by, updated_by)
    values (${name}, ${BUILDING}, 300, ${sql.json([{ name: "Theatre", capacity: 300 }])}, ${sql.json(HOURS)}, ${staff}, ${staff})
    returning id
  `;
  await sql`insert into venue.venue_staff (venue_id, user_id, created_by, updated_by) values (${row!.id}, ${staff}, ${staff}, ${staff})`;
  return row!.id;
}

/** A Singapore time on 2 December 2026. */
const at = (hhmm: string) => `2026-12-02T${hhmm}:00+08:00`;
const utc = (hhmm: string) => new Date(at(hhmm)).toISOString();

async function newEvent(name = "M1 test event"): Promise<{ id: string; reference: string }> {
  const [row] = await sql<{ id: string; reference: string }[]>`
    insert into event.events (
      reference, owner_id, name, purpose, description, proposed_start_at, proposed_end_at,
      expected_attendance, equipment_required, registration_required, status, submitted_at,
      last_saved_at, created_by, updated_by
    ) values (
      'EVT-' || lpad(nextval('event.event_reference_seq')::text, 6, '0'), ${OWNER}, ${name}, 'M1 test',
      'M1 test', ${at("14:00")}, ${at("18:00")}, 150, false, false, 'APPROVED', now(), now(), ${OWNER}, ${OWNER}
    )
    returning id, reference
  `;
  await sql`insert into event.assignments (event_id, coordinator_id, assignment_rule, created_by, updated_by)
            values (${row!.id}, ${COORDINATOR}, 'TEST', ${COORDINATOR}, ${COORDINATOR})`;
  return row!;
}

/** Another event's confirmed booking at the venue: the M1 booking statement. */
async function otherBooking(venueId: string, from: string, until: string, setup = 0, turnaround = 0) {
  const event = await newEvent("Other Department Seminar");
  const [row] = await sql<{ id: string }[]>`
    insert into venue.venue_slots
      (venue_id, event_id, reference, starts_at, ends_at, setup_minutes, turnaround_minutes, status, created_by, updated_by)
    values (${venueId}, ${event.id}, ${`M1-FX-${event.reference}`}, ${at(from)}, ${at(until)}, ${setup}, ${turnaround}, 'CONFIRMED', ${STAFF}, ${STAFF})
    returning id
  `;
  return { id: row!.id, eventReference: event.reference };
}

const submit = (payload: object) => request(app).post("/api/v1/booking-requests").set(bearer).send(payload);
const approve = (id: string) => request(app).post(`/api/v1/booking-requests/${id}/approve`).set(bearer);
const reject = (id: string, payload: unknown) => request(app).post(`/api/v1/booking-requests/${id}/reject`).set(bearer).send(payload as object);
const queue = () => request(app).get("/api/v1/booking-requests/queue").set(bearer);
const forEvent = (eventId: string) => request(app).get("/api/v1/booking-requests").query({ eventId }).set(bearer);
const calendar = (venueId: string) =>
  request(app).get(`/api/v1/venues/${venueId}/availability`).query({ from: "2026-12-02", to: "2026-12-02" }).set(bearer);

/** The coordinator's request for the venue, Theatre, 14:00–18:00 unless the test says otherwise. */
async function requested(venueId: string, event: { id: string }, overrides: Record<string, unknown> = {}) {
  signedInAs("EVENT_COORDINATOR", COORDINATOR);
  const res = await submit({
    eventId: event.id,
    venueId,
    startsAt: at("14:00"),
    endsAt: at("18:00"),
    layout: "Theatre",
    expectedAttendance: 150,
    ...overrides,
  });
  expect(res.status).toBe(201);
  return res.body as { id: string; reference: string };
}

async function requestRow(id: string) {
  const [row] = await sql<{ status: string; decided_by: string | null; decided_at: Date | null; booking_id: string | null }[]>`
    select status, decided_by, decided_at, booking_id from venue.booking_requests where id = ${id}
  `;
  return row!;
}

async function confirmedFor(eventId: string) {
  return sql<{ id: string; venue_id: string; starts_at: Date; ends_at: Date; reference: string }[]>`
    select id, venue_id, starts_at, ends_at, reference from venue.venue_slots where event_id = ${eventId} and status = 'CONFIRMED'
  `;
}

async function outboxFor(id: string, type: string) {
  return sql<{ envelope: { data: Record<string, unknown> } }[]>`
    select envelope from venue.outbox where message_key = ${id} and envelope->>'type' = ${type}
  `;
}

describe("POST /api/v1/booking-requests/:id/approve (M1)", () => {
  it("approves: Approved with who and when, and a confirmed booking for the venue and period (M1-T3)", async () => {
    const venueId = await newVenue("M1 Auditorium");
    const event = await newEvent();
    const made = await requested(venueId, event);
    signedInAs("VENUE_STAFF", STAFF);
    const before = Date.now();

    const res = await approve(made.id);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: made.id, status: "APPROVED", decidedBy: STAFF, eventReference: event.reference });
    expect(Date.parse(res.body.decidedAt)).toBeGreaterThanOrEqual(before - 5000);
    const bookings = await confirmedFor(event.id);
    expect(bookings).toHaveLength(1);
    expect(bookings[0]).toMatchObject({ id: res.body.bookingId, venue_id: venueId, reference: made.reference });
    expect(bookings[0]!.starts_at.toISOString()).toBe(utc("14:00"));
    expect(bookings[0]!.ends_at.toISOString()).toBe(utc("18:00"));
    expect((await queue()).body.items.map((i: { id: string }) => i.id)).not.toContain(made.id);
  });

  it("shows the booking as Confirmed on the calendar and takes the venue out of search for the period (M1-T7)", async () => {
    const venueId = await newVenue("M1 Auditorium");
    const event = await newEvent();
    const made = await requested(venueId, event);
    signedInAs("VENUE_STAFF", STAFF);
    await approve(made.id);

    signedInAs("EVENT_COORDINATOR", COORDINATOR);
    const committed = (await calendar(venueId)).body.days[0].committed;
    expect(committed).toContainEqual(expect.objectContaining({ kind: "BOOKING", bookingStatus: "CONFIRMED", eventReference: event.reference }));
    expect(committed.filter((p: { kind: string }) => p.kind === "BOOKING")).toHaveLength(1);
    const search = (from: string, to: string) =>
      request(app).get("/api/v1/venues/search").query({ location: BUILDING, from: at(from), to: at(to) }).set(bearer);
    expect((await search("15:00", "17:00")).body.items.map((v: { name: string }) => v.name)).not.toContain("M1 Auditorium");
    expect((await search("18:00", "20:00")).body.items.map((v: { name: string }) => v.name)).toContain("M1 Auditorium");
  });

  it("writes one approval message naming the coordinator, the owner and the booking, in the same transaction (M1-T8)", async () => {
    const venueId = await newVenue("M1 Auditorium");
    const event = await newEvent();
    const made = await requested(venueId, event);
    signedInAs("VENUE_STAFF", STAFF);

    const res = await approve(made.id);

    const rows = await outboxFor(made.id, "venue-booking.request-approved");
    expect(rows).toHaveLength(1);
    expect(rows[0]!.envelope.data).toEqual({
      bookingRequestId: made.id,
      reference: made.reference,
      bookingId: res.body.bookingId,
      eventId: event.id,
      eventReference: event.reference,
      eventName: "M1 test event",
      venueId,
      venueName: "M1 Auditorium",
      startsAt: utc("14:00"),
      endsAt: utc("18:00"),
      coordinatorId: COORDINATOR,
      ownerId: OWNER,
      decidedBy: STAFF,
      decidedAt: res.body.decidedAt,
      replacedBookingId: null,
      layout: "Theatre",
      layoutCapacity: 300,
    });
  });

  it("names the layout and its capacity as the venue holds them at approval, so seats can be built from the message alone (EN-13-T1)", async () => {
    const venueId = await newVenue("M1 Auditorium");
    const event = await newEvent();
    const made = await requested(venueId, event);
    // The venue changes its Theatre layout after the request was raised: approval reads what it holds now.
    await sql`update venue.venues set layouts = ${sql.json([{ name: "Theatre", capacity: 240 }])} where id = ${venueId}`;
    signedInAs("VENUE_STAFF", STAFF);

    await approve(made.id);

    const [row] = await outboxFor(made.id, "venue-booking.request-approved");
    expect(row!.envelope.data).toMatchObject({ layout: "Theatre", layoutCapacity: 240 });
  });

  it("leaves the layout out when the venue no longer offers the one asked for, so no seats are built from a guess (EN-13-T7)", async () => {
    const venueId = await newVenue("M1 Auditorium");
    const event = await newEvent();
    const made = await requested(venueId, event);
    await sql`update venue.venues set layouts = ${sql.json([{ name: "Classroom", capacity: 90 }])} where id = ${venueId}`;
    signedInAs("VENUE_STAFF", STAFF);

    await approve(made.id);

    const [row] = await outboxFor(made.id, "venue-booking.request-approved");
    expect(row!.envelope.data).not.toHaveProperty("layout");
    expect(row!.envelope.data).not.toHaveProperty("layoutCapacity");
  });

  it("refuses when the period overlaps another event's confirmed booking, naming it; nothing changes (M1-T4)", async () => {
    const venueId = await newVenue("M1 Auditorium");
    const other = await otherBooking(venueId, "13:00", "15:00");
    const event = await newEvent();
    const made = await requested(venueId, event);
    signedInAs("VENUE_STAFF", STAFF);

    const res = await approve(made.id);

    expect(res.status).toBe(409);
    expect(res.body.error).toEqual(
      expect.objectContaining({
        code: "VENUE_SLOT_CONFLICT",
        message:
          `${made.reference} wasn't approved: M1 Auditorium is already booked for ${other.eventReference} ` +
          "(Wednesday 2 December 2026, 13:00–15:00), counting setup and turnaround time. " +
          "Nothing was approved, and the request is still Pending.",
      }),
    );
    expect(await requestRow(made.id)).toMatchObject({ status: "PENDING", decided_by: null, booking_id: null });
    expect(await confirmedFor(event.id)).toHaveLength(0);
    expect(await outboxFor(made.id, "venue-booking.request-approved")).toHaveLength(0);
    expect((await queue()).body.items.map((i: { id: string }) => i.id)).toContain(made.id);
  });

  it("refuses when the period overlaps recorded unavailability, naming its type, reason and period (M1-T5)", async () => {
    const venueId = await newVenue("M1 Auditorium");
    const event = await newEvent();
    // The request first: since I2, no request can be raised over an active block.
    const made = await requested(venueId, event);
    await sql`
      insert into venue.unavailability_blocks
        (venue_id, starts_at, ends_at, reason_type, description, status, created_by, updated_by, removed_by, removed_at)
      values (${venueId}, ${at("16:00")}, ${at("19:00")}, 'MAINTENANCE', 'Stage rigging inspection', 'ACTIVE', ${STAFF}, ${STAFF}, null, null),
             (${venueId}, ${at("15:00")}, ${at("16:00")}, 'SAFETY', 'Removed drill', 'REMOVED', ${STAFF}, ${STAFF}, ${STAFF}, now())
    `;
    signedInAs("VENUE_STAFF", STAFF);

    const res = await approve(made.id);

    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({
      code: "VENUE_UNAVAILABLE",
      message:
        `${made.reference} wasn't approved: M1 Auditorium is unavailable for Maintenance, “Stage rigging inspection” ` +
        "(Wednesday 2 December 2026, 16:00–19:00). Nothing was approved, and the request is still Pending.",
    });
    expect(await requestRow(made.id)).toMatchObject({ status: "PENDING", booking_id: null });
    expect(await confirmedFor(event.id)).toHaveLength(0);
  });

  it("compares occupied periods: names 09:30–12:45 for 10:00–12:00 with setup and turnaround, and lets 12:45 through (M1-T6)", async () => {
    const venueId = await newVenue("M1 Auditorium");
    const other = await otherBooking(venueId, "10:00", "12:00", 30, 45);
    const event = await newEvent();
    const early = await requested(venueId, event, { startsAt: at("12:30"), endsAt: at("14:00") });
    signedInAs("VENUE_STAFF", STAFF);

    const refused = await approve(early.id);
    expect(refused.status).toBe(409);
    expect(refused.body.error.message).toContain(`booked for ${other.eventReference} (Wednesday 2 December 2026, 09:30–12:45)`);

    signedInAs("EVENT_COORDINATOR", COORDINATOR);
    await request(app).post(`/api/v1/booking-requests/${early.id}/withdraw`).set(bearer);
    const touching = await requested(venueId, event, { startsAt: at("12:45"), endsAt: at("14:00") });
    signedInAs("VENUE_STAFF", STAFF);
    expect((await approve(touching.id)).status).toBe(200);
    const [kept] = await sql`select status from venue.venue_slots where id = ${other.id}`;
    expect(kept).toEqual({ status: "CONFIRMED" });
  });

  it("refuses a request that is no longer pending, naming its status, and writes no second decision (M1-T9)", async () => {
    const venueId = await newVenue("M1 Auditorium");
    const event = await newEvent();
    const approved = await requested(venueId, event);
    const rejected = await requested(venueId, event, { startsAt: at("18:00"), endsAt: at("20:00") });
    const withdrawn = await requested(venueId, event, { startsAt: at("20:00"), endsAt: at("21:00") });
    await request(app).post(`/api/v1/booking-requests/${withdrawn.id}/withdraw`).set(bearer);
    signedInAs("VENUE_STAFF", STAFF);
    await approve(approved.id);
    await reject(rejected.id, { reason: "No" });
    const decidedAt = (await requestRow(approved.id)).decided_at;

    for (const [made, label] of [[approved, "Approved"], [rejected, "Rejected"], [withdrawn, "Withdrawn"]] as const) {
      const res = await approve(made.id);
      expect(res.status, label).toBe(409);
      expect(res.body.error).toMatchObject({
        code: "BOOKING_REQUEST_NOT_PENDING",
        message: `${made.reference} is ${label}, so it can't be approved. Only a pending request can be.`,
      });
    }
    expect((await requestRow(approved.id)).decided_at).toEqual(decidedAt);
    expect((await requestRow(rejected.id)).status).toBe("REJECTED");
    expect(await confirmedFor(event.id)).toHaveLength(1);
  });

  it("releases the disrupted booking a replacement approves over, with the reason replaced, and keeps it (CR-02, M1-T10)", async () => {
    const venueId = await newVenue("M1 Auditorium");
    const disruptedVenue = await newVenue("M1 Seminar Room");
    const event = await newEvent();
    const [disrupted] = await sql<{ id: string }[]>`
      insert into venue.venue_slots (venue_id, event_id, reference, starts_at, ends_at, status, requires_reconfirmation, created_by, updated_by)
      values (${disruptedVenue}, ${event.id}, 'M1-DISRUPTED', ${at("14:00")}, ${at("18:00")}, 'CONFIRMED', true, ${STAFF}, ${STAFF})
      returning id
    `;
    const made = await requested(venueId, event, { replacesBookingId: disrupted!.id });
    signedInAs("VENUE_STAFF", STAFF);

    const res = await approve(made.id);

    expect(res.status).toBe(200);
    const [slot] = await sql`select status, release_reason from venue.venue_slots where id = ${disrupted!.id}`;
    expect(slot).toEqual({ status: "RELEASED", release_reason: "replaced" });
    expect((await outboxFor(made.id, "venue-booking.request-approved"))[0]!.envelope.data.replacedBookingId).toBe(disrupted!.id);
    const committed = (await request(app).get(`/api/v1/venues/${disruptedVenue}/availability`).query({ from: "2026-12-02", to: "2026-12-02" }).set(bearer))
      .body.days[0].committed;
    expect(committed.some((p: { kind: string }) => p.kind === "BOOKING")).toBe(false);
  });

  it("keeps the disrupted booking when the replacement's approval is refused", async () => {
    const venueId = await newVenue("M1 Auditorium");
    const disruptedVenue = await newVenue("M1 Seminar Room");
    const event = await newEvent();
    const [disrupted] = await sql<{ id: string }[]>`
      insert into venue.venue_slots (venue_id, event_id, reference, starts_at, ends_at, status, requires_reconfirmation, created_by, updated_by)
      values (${disruptedVenue}, ${event.id}, 'M1-DISRUPTED', ${at("14:00")}, ${at("18:00")}, 'CONFIRMED', true, ${STAFF}, ${STAFF})
      returning id
    `;
    await otherBooking(venueId, "13:00", "15:00");
    const made = await requested(venueId, event, { replacesBookingId: disrupted!.id });
    signedInAs("VENUE_STAFF", STAFF);

    expect((await approve(made.id)).status).toBe(409);
    const [slot] = await sql`select status, release_reason from venue.venue_slots where id = ${disrupted!.id}`;
    expect(slot).toEqual({ status: "CONFIRMED", release_reason: null });
  });

  it("lets only the venue's own Venue Staff decide; nothing changes for anyone else (M1-T11)", async () => {
    const mine = await newVenue("M1 Auditorium");
    const theirs = await newVenue("M1 Other Hall", OTHER_STAFF);
    const event = await newEvent();
    const forTheirs = await requested(theirs, event);
    const forMine = await requested(mine, event);

    signedInAs("VENUE_STAFF", STAFF);
    const notMine = await approve(forTheirs.id);
    expect(notMine.status).toBe(403);
    expect(notMine.body.error).toMatchObject({ code: "ROLE_NOT_AUTHORISED", message: "Only the venue's Venue Staff can decide its requests." });

    for (const [role, userId] of [["EVENT_COORDINATOR", COORDINATOR], ["EVENT_ORGANISER", OWNER], ["TECH_SUPPORT_STAFF", STAFF]] as const) {
      signedInAs(role, userId);
      const res = await approve(forMine.id);
      expect(res.status, role).toBe(403);
      expect(res.body.error.code).toBe("ROLE_NOT_AUTHORISED");
    }
    expect((await requestRow(forTheirs.id)).status).toBe("PENDING");
    expect((await requestRow(forMine.id)).status).toBe("PENDING");
  });

  it("answers 404 for an unknown request", async () => {
    signedInAs("VENUE_STAFF", STAFF);
    for (const id of [randomUUID(), "not-a-request"]) {
      const res = await approve(id);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("BOOKING_REQUEST_NOT_FOUND");
    }
  });

  it("confirms exactly one of two overlapping requests approved at the same moment (N1)", async () => {
    const venueId = await newVenue("M1 Auditorium");
    const first = await requested(venueId, await newEvent());
    const second = await requested(venueId, await newEvent(), { startsAt: at("16:00"), endsAt: at("20:00") });
    signedInAs("VENUE_STAFF", STAFF);

    const results = await Promise.all([approve(first.id), approve(second.id)]);

    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(results.find((r) => r.status === 409)!.body.error.code).toBe("VENUE_SLOT_CONFLICT");
    const [{ n }] = await sql<{ n: number }[]>`
      select count(*)::int as n from venue.venue_slots where venue_id = ${venueId} and status = 'CONFIRMED'
    `;
    expect(n).toBe(1);
  });

  it("approves a request once when it is approved twice at the same moment", async () => {
    const venueId = await newVenue("M1 Auditorium");
    const event = await newEvent();
    const made = await requested(venueId, event);
    signedInAs("VENUE_STAFF", STAFF);

    const results = await Promise.all([approve(made.id), approve(made.id)]);

    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await confirmedFor(event.id)).toHaveLength(1);
    expect(await outboxFor(made.id, "venue-booking.request-approved")).toHaveLength(1);
  });
});

describe("POST /api/v1/booking-requests/:id/reject (M2)", () => {
  it("needs a reason of at least one non-whitespace character; without one nothing changes (M2-T1)", async () => {
    const venueId = await newVenue("M1 Auditorium");
    const made = await requested(venueId, await newEvent());
    signedInAs("VENUE_STAFF", STAFF);

    for (const payload of [{}, { reason: "" }, { reason: "   " }]) {
      const res = await reject(made.id, payload);
      expect(res.status).toBe(400);
      expect(res.body.error).toMatchObject({
        code: "VALIDATION_FAILED",
        fields: [{ field: "reason", message: "Enter the reason for rejecting the request." }],
      });
      expect(await requestRow(made.id)).toMatchObject({ status: "PENDING", decided_at: null });
    }
    const res = await reject(made.id, { reason: "X" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "REJECTED", rejectionReason: "X", suggestedAlternative: null });
  });

  it("records the reason, any suggestion, who and when, and shows them to the coordinator (M2-T2, M2-T3)", async () => {
    const venueId = await newVenue("M1 Auditorium");
    const event = await newEvent();
    const made = await requested(venueId, event);
    signedInAs("VENUE_STAFF", STAFF);
    const before = Date.now();

    const res = await reject(made.id, {
      reason: "Already promised to another faculty",
      suggestion: "Thursday 3 December at the same time, or Seminar Room 2-1",
    });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "REJECTED", decidedBy: STAFF, bookingId: null, eventReference: event.reference });
    expect(Date.parse(res.body.decidedAt)).toBeGreaterThanOrEqual(before - 5000);
    expect((await queue()).body.items.map((i: { id: string }) => i.id)).not.toContain(made.id);

    signedInAs("EVENT_COORDINATOR", COORDINATOR);
    expect((await forEvent(event.id)).body.items[0]).toMatchObject({
      status: "REJECTED",
      rejectionReason: "Already promised to another faculty",
      suggestedAlternative: "Thursday 3 December at the same time, or Seminar Room 2-1",
    });
  });

  it("leaves the venue free for the period and takes the request off the calendar (M2-T4)", async () => {
    const venueId = await newVenue("M1 Auditorium");
    const event = await newEvent();
    const made = await requested(venueId, event);
    signedInAs("VENUE_STAFF", STAFF);

    await reject(made.id, { reason: "Not available" });

    const committed = (await calendar(venueId)).body.days[0].committed;
    expect(committed.some((p: { kind: string }) => p.kind === "BOOKING")).toBe(false);
    expect(await confirmedFor(event.id)).toHaveLength(0);
  });

  it("writes one rejection message with the reason and the suggestion, naming the coordinator and the owner (M2-T5)", async () => {
    const venueId = await newVenue("M1 Auditorium");
    const event = await newEvent();
    const made = await requested(venueId, event);
    signedInAs("VENUE_STAFF", STAFF);

    const res = await reject(made.id, { reason: "Already promised", suggestion: "Seminar Room 2-1" });

    const rows = await outboxFor(made.id, "venue-booking.request-rejected");
    expect(rows).toHaveLength(1);
    expect(rows[0]!.envelope.data).toEqual({
      bookingRequestId: made.id,
      reference: made.reference,
      eventId: event.id,
      eventReference: event.reference,
      eventName: "M1 test event",
      venueId,
      venueName: "M1 Auditorium",
      startsAt: utc("14:00"),
      endsAt: utc("18:00"),
      coordinatorId: COORDINATOR,
      ownerId: OWNER,
      decidedBy: STAFF,
      decidedAt: res.body.decidedAt,
      reason: "Already promised",
      suggestion: "Seminar Room 2-1",
    });
  });

  it("leaves the event untouched, and a further request can follow (M2-T6)", async () => {
    const venueId = await newVenue("M1 Auditorium");
    const event = await newEvent();
    const made = await requested(venueId, event);
    const [before] = await sql`select status, version from event.events where id = ${event.id}`;
    signedInAs("VENUE_STAFF", STAFF);

    await reject(made.id, { reason: "Not available" });

    const [after] = await sql`select status, version from event.events where id = ${event.id}`;
    expect(after).toEqual(before);
    await requested(venueId, event);
  });

  it("lets only the venue's Venue Staff reject, and only a pending request (M2-T7)", async () => {
    const mine = await newVenue("M1 Auditorium");
    const theirs = await newVenue("M1 Other Hall", OTHER_STAFF);
    const event = await newEvent();
    const pending = await requested(mine, event);
    const forTheirs = await requested(theirs, event);
    const approved = await requested(mine, event, { startsAt: at("18:00"), endsAt: at("20:00") });
    signedInAs("VENUE_STAFF", STAFF);
    await approve(approved.id);

    const notMine = await reject(forTheirs.id, { reason: "No" });
    expect(notMine.status).toBe(403);
    expect(notMine.body.error).toMatchObject({ code: "ROLE_NOT_AUTHORISED", message: "Only the venue's Venue Staff can decide its requests." });

    const decided = await reject(approved.id, { reason: "No" });
    expect(decided.status).toBe(409);
    expect(decided.body.error).toMatchObject({
      code: "BOOKING_REQUEST_NOT_PENDING",
      message: `${approved.reference} is Approved, so it can't be rejected. Only a pending request can be.`,
    });

    signedInAs("EVENT_COORDINATOR", COORDINATOR);
    expect((await reject(pending.id, { reason: "No" })).status).toBe(403);

    expect((await requestRow(pending.id)).status).toBe("PENDING");
    expect((await requestRow(forTheirs.id)).status).toBe("PENDING");
    expect((await requestRow(approved.id)).status).toBe("APPROVED");
  });

  it("answers 404 for an unknown request, and is rate limited (until the gateway's limits, ADR-0011)", async () => {
    signedInAs("VENUE_STAFF", STAFF);
    const res = await reject(randomUUID(), { reason: "No" });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("BOOKING_REQUEST_NOT_FOUND");
    expect(res.headers["ratelimit-policy"]).toMatch(/q=120; w=60/);
  });
});

describe("N1: approval never double-books a venue", () => {
  it("leaves the existing booking exactly as it was when a competing approval is refused (N1-T3)", async () => {
    const venueId = await newVenue("M1 Auditorium");
    const other = await otherBooking(venueId, "13:00", "15:00");
    const read = () => sql`select status, starts_at, ends_at, event_id, reference, updated_at, updated_by from venue.venue_slots where id = ${other.id}`;
    const [before] = await read();
    const made = await requested(venueId, await newEvent());
    signedInAs("VENUE_STAFF", STAFF);

    expect((await approve(made.id)).status).toBe(409);

    const [after] = await read();
    expect(after).toEqual(before);
    const [{ n }] = await sql<{ n: number }[]>`
      select count(*)::int as n from venue.venue_slots where venue_id = ${venueId} and status = 'CONFIRMED'
    `;
    expect(n).toBe(1);
  });

  it("confirms a booking that only touches another, ending exactly when it begins (N1-T4)", async () => {
    const venueId = await newVenue("M1 Auditorium");
    await otherBooking(venueId, "10:00", "14:00");
    const made = await requested(venueId, await newEvent());
    signedInAs("VENUE_STAFF", STAFF);

    expect((await approve(made.id)).status).toBe(200);
    const periods = await sql<{ starts_at: Date; ends_at: Date }[]>`
      select starts_at, ends_at from venue.venue_slots where venue_id = ${venueId} and status = 'CONFIRMED' order by starts_at
    `;
    expect(periods.map((p) => [p.starts_at.toISOString(), p.ends_at.toISOString()])).toEqual([
      [utc("10:00"), utc("14:00")],
      [utc("14:00"), utc("18:00")],
    ]);
  });

  it("confirms exactly one of six overlapping approvals sent at once; each refusal names the winner and stays Pending (N1-T6)", async () => {
    const venueId = await newVenue("M1 Auditorium");
    const events = await Promise.all(Array.from({ length: 6 }, (_, i) => newEvent(`N1 race event ${i}`)));
    const made = [];
    for (const [i, event] of events.entries()) {
      made.push(await requested(venueId, event, { startsAt: at(`${String(12 + (i % 3)).padStart(2, "0")}:00`), endsAt: at("18:00") }));
    }
    signedInAs("VENUE_STAFF", STAFF);

    const results = await Promise.all(made.map((m) => approve(m.id)));

    const won = results.filter((r) => r.status === 200);
    expect(won).toHaveLength(1);
    const winner = events.find((e) => e.id === won[0]!.body.eventId)!;
    for (const lost of results.filter((r) => r.status !== 200)) {
      expect(lost.status).toBe(409);
      expect(lost.body.error.code).toBe("VENUE_SLOT_CONFLICT");
      expect(lost.body.error.message).toContain(`already booked for ${winner.reference} (`);
    }
    const statuses = await sql<{ status: string; n: number }[]>`
      select status, count(*)::int as n from venue.booking_requests where venue_id = ${venueId} group by status order by status
    `;
    expect(statuses).toEqual([
      { status: "APPROVED", n: 1 },
      { status: "PENDING", n: 5 },
    ]);
    const [{ n }] = await sql<{ n: number }[]>`
      select count(*)::int as n from venue.venue_slots where venue_id = ${venueId} and status = 'CONFIRMED'
    `;
    expect(n).toBe(1);
  });

  it("is never blocked by released bookings, or by withdrawn or rejected requests, for the same period (N1-T7)", async () => {
    const venueId = await newVenue("M1 Auditorium");
    for (const reason of [null, "replaced"]) {
      const { id } = await otherBooking(venueId, "14:00", "18:00");
      await sql`update venue.venue_slots set status = 'RELEASED', release_reason = ${reason} where id = ${id}`;
    }
    const second = await newEvent("Faculty Awards Night");
    const withdrawn = await requested(venueId, second);
    signedInAs("EVENT_COORDINATOR", COORDINATOR);
    expect((await request(app).post(`/api/v1/booking-requests/${withdrawn.id}/withdraw`).set(bearer)).status).toBe(200);
    const rejected = await requested(venueId, second);
    signedInAs("VENUE_STAFF", STAFF);
    expect((await reject(rejected.id, { reason: "Not available" })).status).toBe(200);
    const event = await newEvent();
    const made = await requested(venueId, event);
    signedInAs("VENUE_STAFF", STAFF);

    expect((await approve(made.id)).status).toBe(200);
    const confirmed = await sql<{ event_id: string }[]>`
      select event_id from venue.venue_slots where venue_id = ${venueId} and status = 'CONFIRMED'
    `;
    expect(confirmed).toEqual([{ event_id: event.id }]);
  });

  it("takes the venue out of search for any window overlapping the booking by even a minute, and not one that only touches it (N1-T8)", async () => {
    const venueId = await newVenue("M1 Auditorium");
    const made = await requested(venueId, await newEvent());
    signedInAs("VENUE_STAFF", STAFF);
    await approve(made.id);

    signedInAs("EVENT_COORDINATOR", COORDINATOR);
    const listed = async (from: string, to: string) =>
      (await request(app).get("/api/v1/venues/search").query({ location: BUILDING, from: at(from), to: at(to) }).set(bearer)).body.items.map(
        (v: { name: string }) => v.name,
      );
    expect(await listed("15:00", "17:00")).not.toContain("M1 Auditorium");
    expect(await listed("17:59", "20:00")).not.toContain("M1 Auditorium");
    expect(await listed("18:00", "20:00")).toContain("M1 Auditorium");
    expect(await listed("12:00", "14:00")).toContain("M1 Auditorium");
  });
});
