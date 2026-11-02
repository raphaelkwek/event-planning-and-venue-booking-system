import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { testDb } from "../../support/testDb.js";

/**
 * L4 (audit, 2 Nov 2026) — M1 approved a booking request without looking at the event again, so a
 * request made while the event was Approved could still confirm a booking after the event was
 * Completed or Cancelled. The approval now reads the event's status under a share lock (through the
 * event module's index) and refuses unless the event can take a booking (the statuses L1 allows).
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
const at = (hhmm: string) => `2026-12-02T${hhmm}:00+08:00`;

async function cleanUp() {
  const ours = sql`select id from venue.venues where created_by = ${STAFF}`;
  await sql`delete from venue.outbox where message_key in (select id::text from venue.booking_requests where venue_id in (${ours}))`;
  await sql`delete from venue.booking_requests where venue_id in (${ours})`;
  await sql`delete from venue.venue_slots where venue_id in (${ours})`;
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

async function newVenue(): Promise<string> {
  const [row] = await sql<{ id: string }[]>`
    insert into venue.venues (name, building, max_capacity, layouts, operating_hours, created_by, updated_by)
    values ('L4 Hall', 'L4 Test Building', 300, ${sql.json([{ name: "Theatre", capacity: 300 }])}, ${sql.json(HOURS)}, ${STAFF}, ${STAFF})
    returning id
  `;
  await sql`insert into venue.venue_staff (venue_id, user_id, created_by, updated_by) values (${row!.id}, ${STAFF}, ${STAFF}, ${STAFF})`;
  return row!.id;
}

async function newEvent(): Promise<string> {
  const [row] = await sql<{ id: string }[]>`
    insert into event.events (
      reference, owner_id, name, purpose, description, proposed_start_at, proposed_end_at,
      expected_attendance, equipment_required, registration_required, status, submitted_at,
      last_saved_at, created_by, updated_by
    ) values (
      'EVT-' || lpad(nextval('event.event_reference_seq')::text, 6, '0'), ${OWNER}, 'L4 event', 'L4 test',
      'L4 test', ${at("14:00")}, ${at("18:00")}, 150, false, false, 'APPROVED', now(), now(), ${OWNER}, ${OWNER}
    )
    returning id
  `;
  await sql`insert into event.assignments (event_id, coordinator_id, assignment_rule, created_by, updated_by)
            values (${row!.id}, ${COORDINATOR}, 'TEST', ${COORDINATOR}, ${COORDINATOR})`;
  return row!.id;
}

async function pendingRequest(venueId: string, eventId: string): Promise<string> {
  signedInAs("EVENT_COORDINATOR", COORDINATOR);
  const res = await request(app)
    .post("/api/v1/booking-requests")
    .set(bearer)
    .send({ eventId, venueId, startsAt: at("14:00"), endsAt: at("18:00"), layout: "Theatre", expectedAttendance: 150 });
  expect(res.status).toBe(201);
  return res.body.id;
}

const approve = (id: string) => request(app).post(`/api/v1/booking-requests/${id}/approve`).set(bearer);
const bookings = (eventId: string) => sql`select id from venue.venue_slots where event_id = ${eventId}`;

describe("L4: M1 approval reads the event's status again", () => {
  it.each([
    ["COMPLETED", "It is Completed"],
    ["CANCELLED", "It is Cancelled"],
  ])("refuses to confirm a booking for a %s event, leaving the request Pending and creating no booking", async (status, sentence) => {
    const venueId = await newVenue();
    const eventId = await newEvent();
    const requestId = await pendingRequest(venueId, eventId);
    await sql`update event.events set status = ${status} where id = ${eventId}`;
    signedInAs("VENUE_STAFF", STAFF);

    const res = await approve(requestId);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("EVENT_NOT_BOOKABLE");
    expect(res.body.error.message).toContain(sentence);
    const [stored] = await sql<{ status: string; decided_by: string | null }[]>`
      select status, decided_by from venue.booking_requests where id = ${requestId}
    `;
    expect(stored).toEqual({ status: "PENDING", decided_by: null });
    expect(await bookings(eventId)).toEqual([]);
    expect(
      await sql`select 1 from venue.outbox where message_key = ${requestId} and envelope->>'type' = 'venue-booking.request-approved'`,
    ).toEqual([]);
  });

  it.each(["PLANNING", "SAFETY_REVIEW", "CONFIRMED"])("still confirms a booking while the event is %s", async (status) => {
    const venueId = await newVenue();
    const eventId = await newEvent();
    const requestId = await pendingRequest(venueId, eventId);
    await sql`update event.events set status = ${status} where id = ${eventId}`;
    signedInAs("VENUE_STAFF", STAFF);

    const res = await approve(requestId);

    expect(res.status).toBe(200);
    expect(await bookings(eventId)).toHaveLength(1);
  });

  it("waits for a cancellation in progress and then refuses, instead of confirming over it", async () => {
    const venueId = await newVenue();
    const eventId = await newEvent();
    const requestId = await pendingRequest(venueId, eventId);
    signedInAs("VENUE_STAFF", STAFF);

    // A cancellation holds the event row; the approval's share lock queues behind it.
    let release!: () => void;
    const cancelled = new Promise<void>((resolve) => (release = resolve));
    const canceller = sql.begin(async (tx) => {
      await tx`select id from event.events where id = ${eventId} for update`;
      await tx`update event.events set status = 'CANCELLED' where id = ${eventId}`;
      await cancelled;
    });
    await new Promise((resolve) => setTimeout(resolve, 300));
    const approval = approve(requestId).then((res) => res);
    await new Promise((resolve) => setTimeout(resolve, 500));
    release();
    await canceller;
    const res = await approval;

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("EVENT_NOT_BOOKABLE");
    expect(await bookings(eventId)).toEqual([]);
  });
});
