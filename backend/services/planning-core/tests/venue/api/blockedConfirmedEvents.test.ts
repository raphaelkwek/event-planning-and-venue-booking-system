import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { testDb } from "../../support/testDb.js";

/**
 * I3 — a block over a confirmed booking of a Confirmed event returns the event
 * to Planning (W9-50), with a status history entry naming the block as the
 * trigger (F1); the event and its other arrangements are kept, and the
 * coordinator's disruption message says the event returned (W9-51). The setup
 * mirrors FX-CONFIRMED-BOOKING (tests/I3/README.md).
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
const STAFF = "a9999999-0000-0000-0000-000000000083";
const BUILDING = "I3 Test Building";
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
  const ours = sql`select id from venue.venues where created_by = ${STAFF}`;
  const blocks = sql`select id from venue.unavailability_blocks where venue_id in (${ours})`;
  const events = sql`select id from event.events where owner_id = ${OWNER}`;
  await sql`delete from venue.outbox where message_key in (select id::text from venue.unavailability_blocks where venue_id in (${ours}))`;
  await sql`delete from venue.outbox where message_key in (select id::text from venue.booking_requests where venue_id in (${ours}))`;
  await sql`delete from venue.block_disruptions where block_id in (${blocks})`;
  await sql`delete from venue.booking_requests where venue_id in (${ours})`;
  await sql`delete from venue.venue_slots where venue_id in (${ours})`;
  await sql`delete from venue.unavailability_blocks where venue_id in (${ours})`;
  await sql`delete from venue.venue_staff where venue_id in (${ours})`;
  await sql`delete from venue.venues where created_by = ${STAFF}`;
  await sql`delete from event.outbox where message_key in (select id::text from event.events where owner_id = ${OWNER})`;
  await sql`delete from event.event_history where event_id in (${events})`;
  await sql`delete from event.assignments where event_id in (${events})`;
  await sql`delete from event.events where owner_id = ${OWNER}`;
}

beforeEach(cleanUp);
afterAll(async () => {
  await cleanUp();
  await sql.end();
});

async function newVenue(name: string): Promise<string> {
  const [row] = await sql<{ id: string }[]>`
    insert into venue.venues (name, building, max_capacity, layouts, operating_hours, created_by, updated_by)
    values (${name}, ${BUILDING}, 300, ${sql.json([{ name: "Theatre", capacity: 300 }])}, ${sql.json(HOURS)}, ${STAFF}, ${STAFF})
    returning id
  `;
  await sql`insert into venue.venue_staff (venue_id, user_id, created_by, updated_by) values (${row!.id}, ${STAFF}, ${STAFF}, ${STAFF})`;
  return row!.id;
}

/** A Singapore time on 2 December 2026. */
const at = (hhmm: string) => `2026-12-02T${hhmm}:00+08:00`;

async function newEvent(name = "I3 test event"): Promise<{ id: string; reference: string }> {
  const [row] = await sql<{ id: string; reference: string }[]>`
    insert into event.events (
      reference, owner_id, name, purpose, description, proposed_start_at, proposed_end_at,
      expected_attendance, equipment_required, registration_required, status, submitted_at,
      last_saved_at, created_by, updated_by
    ) values (
      'EVT-' || lpad(nextval('event.event_reference_seq')::text, 6, '0'), ${OWNER}, ${name}, 'I3 test',
      'I3 test', ${at("14:00")}, ${at("18:00")}, 150, false, false, 'APPROVED', now(), now(), ${OWNER}, ${OWNER}
    )
    returning id, reference
  `;
  await sql`insert into event.assignments (event_id, coordinator_id, assignment_rule, created_by, updated_by)
            values (${row!.id}, ${COORDINATOR}, 'TEST', ${COORDINATOR}, ${COORDINATOR})`;
  return row!;
}

/** FX-CONFIRMED: U1 isn't built, so the status is set directly, as FX-SEEDED does (tests/README.md). */
const setStatus = (eventId: string, status: string) => sql`update event.events set status = ${status}, updated_at = now() where id = ${eventId}`;

const record = (venueId: string, payload: object) =>
  request(app).post(`/api/v1/venues/${venueId}/unavailability`).set(bearer).send(payload);
const impact = (venueId: string, startsAt: string, endsAt: string) =>
  request(app).get(`/api/v1/venues/${venueId}/unavailability/impact`).query({ startsAt, endsAt }).set(bearer);

const blockBody = (from: string, until: string) => ({
  startsAt: at(from),
  endsAt: at(until),
  reasonType: "MAINTENANCE",
  description: "Stage rigging inspection",
});

/** A confirmed booking: the coordinator's request, approved by the venue's staff (M1). */
async function booked(venueId: string, event: { id: string }, from = "14:00", until = "18:00") {
  signedInAs("EVENT_COORDINATOR", COORDINATOR);
  const made = await request(app)
    .post("/api/v1/booking-requests")
    .set(bearer)
    .send({ eventId: event.id, venueId, startsAt: at(from), endsAt: at(until), layout: "Theatre", expectedAttendance: 150 });
  expect(made.status).toBe(201);
  signedInAs("VENUE_STAFF", STAFF);
  const approved = await request(app).post(`/api/v1/booking-requests/${made.body.id}/approve`).set(bearer);
  expect(approved.status).toBe(200);
  return { reference: made.body.reference as string, bookingId: approved.body.bookingId as string };
}

/** FX-CONFIRMED-BOOKING: an event with a confirmed booking at the venue, 14:00–18:00, then Confirmed. */
async function confirmedWithBooking(venueId: string, name?: string) {
  const event = await newEvent(name);
  const booking = await booked(venueId, event);
  await setStatus(event.id, "CONFIRMED");
  return { event, booking };
}

const statusOf = async (eventId: string) =>
  (await sql<{ status: string }[]>`select status from event.events where id = ${eventId}`)[0]!.status;
const statusChanges = (eventId: string) =>
  sql<{ previous_status: string; new_status: string; actor_user_id: string; actor_role: string; triggering_action: string; occurred_at: Date }[]>`
    select previous_status, new_status, actor_user_id, actor_role, triggering_action, occurred_at
    from event.event_history where event_id = ${eventId} and entry_type = 'STATUS_CHANGE'
    order by occurred_at
  `;
const disruptionMessages = (blockId: string) =>
  sql<{ envelope: { data: Record<string, unknown> } }[]>`
    select envelope from venue.outbox where message_key = ${blockId} and envelope->>'type' = 'venue-booking.booking-disrupted'
    order by created_at
  `;
const slot = async (id: string) =>
  (await sql<{ status: string; requires_reconfirmation: boolean }[]>`
    select status, requires_reconfirmation from venue.venue_slots where id = ${id}
  `)[0]!;

describe("a block over a Confirmed event's confirmed booking (I3-T1)", () => {
  it("returns the event to Planning, with a history entry by the Venue Staff member naming the block as the trigger", async () => {
    const venueId = await newVenue("I3 Auditorium");
    const { event } = await confirmedWithBooking(venueId);
    signedInAs("VENUE_STAFF", STAFF);

    const res = await record(venueId, blockBody("16:00", "19:00"));

    expect(res.status).toBe(201);
    expect(await statusOf(event.id)).toBe("PLANNING");
    const history = await statusChanges(event.id);
    expect(history.at(-1)).toMatchObject({
      previous_status: "CONFIRMED",
      new_status: "PLANNING",
      actor_user_id: STAFF,
      actor_role: "VENUE_STAFF",
      triggering_action: "VENUE_BLOCKED",
    });
    expect(Math.abs(history.at(-1)!.occurred_at.getTime() - Date.parse(res.body.block.createdAt))).toBeLessThan(5000);
  });

  it("says so in the review beforehand and in the recorded block's response", async () => {
    const venueId = await newVenue("I3 Auditorium");
    const { event, booking } = await confirmedWithBooking(venueId);
    signedInAs("VENUE_STAFF", STAFF);

    const reviewed = await impact(venueId, at("16:00"), at("19:00"));
    expect(reviewed.body.items).toEqual([
      expect.objectContaining({ kind: "BOOKING", reference: booking.reference, eventReference: event.reference, returnsEventToPlanning: true }),
    ]);
    expect(await statusOf(event.id)).toBe("CONFIRMED");

    const res = await record(venueId, blockBody("16:00", "19:00"));
    expect(res.body.disrupted).toEqual([expect.objectContaining({ reference: booking.reference, returnsEventToPlanning: true })]);
  });

  it("publishes the status change, so consumers waiting for the event (EN-11) see it leave Confirmed", async () => {
    const venueId = await newVenue("I3 Auditorium");
    const { event } = await confirmedWithBooking(venueId);
    signedInAs("VENUE_STAFF", STAFF);

    await record(venueId, blockBody("16:00", "19:00"));

    const rows = await sql<{ envelope: { data: Record<string, unknown> } }[]>`
      select envelope from event.outbox where message_key = ${event.id} and envelope->>'type' = 'event.status-changed'
    `;
    expect(rows.map((r) => r.envelope.data)).toEqual([
      expect.objectContaining({ eventId: event.id, previousStatus: "CONFIRMED", newStatus: "PLANNING", action: "VENUE_BLOCKED" }),
    ]);
  });

  it("moves an event once, however many of its bookings the block disrupts", async () => {
    const venueId = await newVenue("I3 Auditorium");
    const event = await newEvent();
    await booked(venueId, event, "09:00", "11:00");
    await booked(venueId, event, "14:00", "18:00");
    await setStatus(event.id, "CONFIRMED");
    signedInAs("VENUE_STAFF", STAFF);

    const res = await record(venueId, blockBody("08:00", "20:00"));

    expect(res.body.disrupted).toHaveLength(2);
    expect(await statusOf(event.id)).toBe("PLANNING");
    expect((await statusChanges(event.id)).filter((h) => h.triggering_action === "VENUE_BLOCKED")).toHaveLength(1);
    expect((await disruptionMessages(res.body.block.id)).map((m) => m.envelope.data.eventReturnedToPlanning)).toEqual([true, true]);
  });

  it("returns each Confirmed event it disrupts", async () => {
    const venueId = await newVenue("I3 Auditorium");
    const first = await newEvent("First symposium");
    const second = await newEvent("Second symposium");
    await booked(venueId, first, "09:00", "11:00");
    await booked(venueId, second, "14:00", "18:00");
    await setStatus(first.id, "CONFIRMED");
    await setStatus(second.id, "CONFIRMED");
    signedInAs("VENUE_STAFF", STAFF);

    await record(venueId, blockBody("08:00", "20:00"));

    expect([await statusOf(first.id), await statusOf(second.id)]).toEqual(["PLANNING", "PLANNING"]);
  });
});

describe("an event in any other status (I3-T2)", () => {
  for (const status of ["APPROVED", "PLANNING", "SAFETY_REVIEW"]) {
    it(`keeps a ${status} event's status, with no new history entry, and flags its booking as I2 does`, async () => {
      const venueId = await newVenue("I3 Auditorium");
      const event = await newEvent();
      const booking = await booked(venueId, event);
      await setStatus(event.id, status);
      const before = (await statusChanges(event.id)).length;
      signedInAs("VENUE_STAFF", STAFF);

      const res = await record(venueId, blockBody("16:00", "19:00"));

      expect(await statusOf(event.id)).toBe(status);
      expect(await statusChanges(event.id)).toHaveLength(before);
      expect((await slot(booking.bookingId)).requires_reconfirmation).toBe(true);
      expect(res.body.disrupted).toEqual([expect.objectContaining({ returnsEventToPlanning: false })]);
      const [message] = await disruptionMessages(res.body.block.id);
      expect(message!.envelope.data).not.toHaveProperty("eventReturnedToPlanning");
    });
  }

  it("keeps a Confirmed event Confirmed when the block disrupts only a pending request, not its confirmed booking", async () => {
    const venueId = await newVenue("I3 Auditorium");
    const otherVenue = await newVenue("I3 Seminar Room");
    const event = await newEvent();
    await booked(otherVenue, event);
    signedInAs("EVENT_COORDINATOR", COORDINATOR);
    const pending = await request(app)
      .post("/api/v1/booking-requests")
      .set(bearer)
      .send({ eventId: event.id, venueId, startsAt: at("14:00"), endsAt: at("18:00"), layout: "Theatre", expectedAttendance: 150 });
    expect(pending.status).toBe(201);
    await setStatus(event.id, "CONFIRMED");
    signedInAs("VENUE_STAFF", STAFF);

    const res = await record(venueId, blockBody("16:00", "19:00"));

    expect(res.body.disrupted).toEqual([expect.objectContaining({ kind: "REQUEST", returnsEventToPlanning: false })]);
    expect(await statusOf(event.id)).toBe("CONFIRMED");
  });
});

describe("the event and its other arrangements are kept (I3-T3)", () => {
  it("is Planning, not Cancelled; both bookings stay confirmed and only the blocked one is flagged; nothing is released", async () => {
    const venueId = await newVenue("I3 Auditorium");
    const seminarRoom = await newVenue("I3 Seminar Room");
    const event = await newEvent();
    const auditorium = await booked(venueId, event);
    const seminar = await booked(seminarRoom, event);
    await setStatus(event.id, "CONFIRMED");
    signedInAs("VENUE_STAFF", STAFF);

    await record(venueId, blockBody("16:00", "19:00"));

    expect(await statusOf(event.id)).toBe("PLANNING");
    expect(await slot(auditorium.bookingId)).toEqual({ status: "CONFIRMED", requires_reconfirmation: true });
    expect(await slot(seminar.bookingId)).toEqual({ status: "CONFIRMED", requires_reconfirmation: false });
  });
});

describe("the coordinator is told at once (I3-T4)", () => {
  it("writes the disruption message to the assigned coordinator, saying the event returned to Planning, and nothing for the owner", async () => {
    const venueId = await newVenue("I3 Auditorium");
    const { event, booking } = await confirmedWithBooking(venueId);
    signedInAs("VENUE_STAFF", STAFF);

    const res = await record(venueId, blockBody("16:00", "19:00"));

    const messages = await disruptionMessages(res.body.block.id);
    expect(messages.map((m) => m.envelope.data)).toEqual([
      expect.objectContaining({
        kind: "BOOKING",
        reference: booking.reference,
        eventId: event.id,
        coordinatorId: COORDINATOR,
        eventReturnedToPlanning: true,
      }),
    ]);
    const ownerMessages = await sql`
      select 1 from venue.outbox where message_key = ${res.body.block.id} and envelope->'data' ? 'ownerId'
    `;
    expect(ownerMessages).toHaveLength(0);
  });
});

describe("a failed block changes no status (I3-T7)", () => {
  it("leaves the event Confirmed, with no history entry, when the block is refused", async () => {
    const venueId = await newVenue("I3 Auditorium");
    const { event, booking } = await confirmedWithBooking(venueId);
    const before = (await statusChanges(event.id)).length;
    signedInAs("VENUE_STAFF", STAFF);

    expect((await record(venueId, blockBody("16:00", "15:00"))).status).toBe(400);

    expect(await statusOf(event.id)).toBe("CONFIRMED");
    expect(await statusChanges(event.id)).toHaveLength(before);
    expect((await slot(booking.bookingId)).requires_reconfirmation).toBe(false);
  });
});

describe("the event row is locked before the bookings are flagged (§4.6, F5's lock order)", () => {
  it("waits for a transaction holding the event, then returns the status it finds", async () => {
    const venueId = await newVenue("I3 Auditorium");
    const { event } = await confirmedWithBooking(venueId);
    signedInAs("VENUE_STAFF", STAFF);

    let release!: () => void;
    const released = new Promise<void>((resolve) => (release = resolve));
    let locked!: () => void;
    const lockTaken = new Promise<void>((resolve) => (locked = resolve));
    const holder = sql.begin(async (tx) => {
      await tx`select id from event.events where id = ${event.id} for update`;
      locked();
      await released;
    });
    await lockTaken;

    let settled = false;
    const recording = record(venueId, blockBody("16:00", "19:00")).then((res) => {
      settled = true;
      return res;
    });
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      expect(settled).toBe(false);
    } finally {
      release();
      await holder;
    }
    expect((await recording).status).toBe(201);
    expect(await statusOf(event.id)).toBe("PLANNING");
  });
});
