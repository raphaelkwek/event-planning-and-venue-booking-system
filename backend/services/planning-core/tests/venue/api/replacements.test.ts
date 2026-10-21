import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { testDb } from "../../support/testDb.js";

/**
 * L5 (CR-02) end to end: block, flag, request, approve, release. The disrupted
 * booking is kept until its replacement is approved, and stays if the
 * replacement is rejected or withdrawn; the event is never cancelled. The
 * coordinator sees it all on the event's venue requests.
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
const bearer = { Authorization: "Bearer test-token" };

/** Open every weekday 08:00–22:00, so a request for 14:00–18:00 is suitable and needs no justification (K2). */
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

function signedInAs(role: string, userId: string) {
  vi.mocked(resolveCurrentUser).mockResolvedValue({ id: userId, email: "user@connectsphere.test", role: role as never });
}

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

async function newVenue(name: string): Promise<string> {
  const [row] = await sql<{ id: string }[]>`
    insert into venue.venues (name, building, max_capacity, layouts, operating_hours, created_by, updated_by)
    values (${name}, 'L5 Test Building', 300, ${sql.json([{ name: "Theatre", capacity: 300 }])}, ${sql.json(HOURS)}, ${STAFF}, ${STAFF})
    returning id
  `;
  await sql`insert into venue.venue_staff (venue_id, user_id, created_by, updated_by) values (${row!.id}, ${STAFF}, ${STAFF}, ${STAFF})`;
  return row!.id;
}

const at = (hhmm: string) => `2026-12-02T${hhmm}:00+08:00`;
const utc = (hhmm: string) => new Date(at(hhmm)).toISOString();

async function newEvent(): Promise<{ id: string; reference: string }> {
  const [row] = await sql<{ id: string; reference: string }[]>`
    insert into event.events (
      reference, owner_id, name, purpose, description, proposed_start_at, proposed_end_at,
      expected_attendance, equipment_required, registration_required, status, submitted_at,
      last_saved_at, created_by, updated_by
    ) values (
      'EVT-' || lpad(nextval('event.event_reference_seq')::text, 6, '0'), ${OWNER}, 'L5 test event', 'L5 test',
      'L5 test', ${at("14:00")}, ${at("18:00")}, 150, false, false, 'APPROVED', now(), now(), ${OWNER}, ${OWNER}
    )
    returning id, reference
  `;
  await sql`insert into event.assignments (event_id, coordinator_id, assignment_rule, created_by, updated_by)
            values (${row!.id}, ${COORDINATOR}, 'TEST', ${COORDINATOR}, ${COORDINATOR})`;
  return row!;
}

const submit = (payload: object) => request(app).post("/api/v1/booking-requests").set(bearer).send(payload);
const forEvent = (eventId: string) => request(app).get("/api/v1/booking-requests").query({ eventId }).set(bearer);

async function requested(venueId: string, eventId: string, overrides: Record<string, unknown> = {}) {
  signedInAs("EVENT_COORDINATOR", COORDINATOR);
  const res = await submit({ eventId, venueId, startsAt: at("14:00"), endsAt: at("18:00"), layout: "Theatre", expectedAttendance: 150, ...overrides });
  expect(res.status).toBe(201);
  return res.body as { id: string; reference: string; replacesBookingId: string | null };
}

/** FX-L5: the event's confirmed booking at the auditorium, 14:00–18:00, disrupted by a block from 16:00 to 19:00. */
async function fxL5() {
  const lkc = await newVenue("L5 Auditorium");
  const seminar = await newVenue("L5 Seminar Room");
  const event = await newEvent();
  const made = await requested(lkc, event.id);
  signedInAs("VENUE_STAFF", STAFF);
  const approved = await request(app).post(`/api/v1/booking-requests/${made.id}/approve`).set(bearer);
  const blocked = await request(app)
    .post(`/api/v1/venues/${lkc}/unavailability`)
    .set(bearer)
    .send({ startsAt: at("16:00"), endsAt: at("19:00"), reasonType: "MAINTENANCE", description: "Stage rigging inspection" });
  expect(blocked.status).toBe(201);
  return { lkc, seminar, event, booking: { id: approved.body.bookingId as string, reference: made.reference }, blockId: blocked.body.block.id as string };
}

async function slot(id: string) {
  const [row] = await sql<{ status: string; requires_reconfirmation: boolean; release_reason: string | null }[]>`
    select status, requires_reconfirmation, release_reason from venue.venue_slots where id = ${id}
  `;
  return row!;
}

const eventState = async (eventId: string) => {
  const [row] = await sql<{ status: string; version: number }[]>`select status, version from event.events where id = ${eventId}`;
  const [{ n }] = await sql<{ n: number }[]>`
    select count(*)::int as n from event.event_history where event_id = ${eventId} and entry_type = 'STATUS_CHANGE'
  `;
  return { ...row!, history: n };
};

describe("the event's bookings (L5-T1, L5-T2)", () => {
  it("lists each booking with the block disrupting it and its replacement requests, for the coordinator and the owner", async () => {
    const { lkc, seminar, event, booking, blockId } = await fxL5();
    const replacement = await requested(seminar, event.id, { replacesBookingId: booking.id });

    signedInAs("EVENT_COORDINATOR", COORDINATOR);
    const res = await forEvent(event.id);

    expect(res.status).toBe(200);
    expect(res.body.bookings).toEqual([
      {
        id: booking.id,
        reference: booking.reference,
        venueId: lkc,
        venueName: "L5 Auditorium",
        startsAt: utc("14:00"),
        endsAt: utc("18:00"),
        status: "CONFIRMED",
        requiresReconfirmation: true,
        releaseReason: null,
        disruptions: [{ blockId, reasonType: "MAINTENANCE", description: "Stage rigging inspection", startsAt: utc("16:00"), endsAt: utc("19:00") }],
        overlaps: [],
        replacements: [{ id: replacement.id, reference: replacement.reference, status: "PENDING", venueName: "L5 Seminar Room" }],
      },
    ]);
    signedInAs("EVENT_ORGANISER", OWNER);
    expect((await forEvent(event.id)).body.bookings).toHaveLength(1);
    signedInAs("EVENT_ORGANISER", randomUUID());
    expect((await forEvent(event.id)).status).toBe(404);
  });
});

describe("a replacement request (L5-T4)", () => {
  it("is linked to the disrupted booking, and raising it changes nothing on the event or the booking", async () => {
    const { seminar, event, booking } = await fxL5();
    const before = await eventState(event.id);

    const replacement = await requested(seminar, event.id, { replacesBookingId: booking.id });

    expect(replacement.replacesBookingId).toBe(booking.id);
    expect(await eventState(event.id)).toEqual(before);
    expect(await slot(booking.id)).toEqual({ status: "CONFIRMED", requires_reconfirmation: true, release_reason: null });
  });
});

describe("the disrupted booking (CR-02)", () => {
  it("is kept, still flagged, until the replacement is approved; then released as replaced and kept (L5-T5)", async () => {
    const { seminar, event, booking } = await fxL5();
    const replacement = await requested(seminar, event.id, { replacesBookingId: booking.id });
    expect(await slot(booking.id)).toEqual({ status: "CONFIRMED", requires_reconfirmation: true, release_reason: null });

    signedInAs("VENUE_STAFF", STAFF);
    const approved = await request(app).post(`/api/v1/booking-requests/${replacement.id}/approve`).set(bearer);

    expect(approved.status).toBe(200);
    expect(await slot(booking.id)).toMatchObject({ status: "RELEASED", release_reason: "replaced" });
    signedInAs("EVENT_COORDINATOR", COORDINATOR);
    const bookings = (await forEvent(event.id)).body.bookings as { id: string; status: string; releaseReason: string | null; venueName: string }[];
    expect(bookings.map((b) => [b.venueName, b.status, b.releaseReason])).toEqual([
      ["L5 Auditorium", "RELEASED", "replaced"],
      ["L5 Seminar Room", "CONFIRMED", null],
    ]);
  });

  it("stays as it was if the replacement is rejected, and another replacement can be requested (L5-T6)", async () => {
    const { seminar, event, booking } = await fxL5();
    const replacement = await requested(seminar, event.id, { replacesBookingId: booking.id });
    signedInAs("VENUE_STAFF", STAFF);
    expect((await request(app).post(`/api/v1/booking-requests/${replacement.id}/reject`).set(bearer).send({ reason: "Not available" })).status).toBe(200);

    expect(await slot(booking.id)).toEqual({ status: "CONFIRMED", requires_reconfirmation: true, release_reason: null });
    const again = await requested(seminar, event.id, { replacesBookingId: booking.id });
    expect(again.replacesBookingId).toBe(booking.id);
  });

  it("stays as it was if the replacement is withdrawn, and another replacement can be requested (L5-T7)", async () => {
    const { seminar, event, booking } = await fxL5();
    const replacement = await requested(seminar, event.id, { replacesBookingId: booking.id });
    signedInAs("EVENT_COORDINATOR", COORDINATOR);
    expect((await request(app).post(`/api/v1/booking-requests/${replacement.id}/withdraw`).set(bearer)).status).toBe(200);

    expect(await slot(booking.id)).toEqual({ status: "CONFIRMED", requires_reconfirmation: true, release_reason: null });
    expect((await requested(seminar, event.id, { replacesBookingId: booking.id })).replacesBookingId).toBe(booking.id);
  });

  it("can't be replaced once it no longer requires reconfirmation", async () => {
    const { lkc, seminar, event, booking, blockId } = await fxL5();
    signedInAs("VENUE_STAFF", STAFF);
    await request(app).post(`/api/v1/venues/${lkc}/unavailability/${blockId}/remove`).set(bearer);

    signedInAs("EVENT_COORDINATOR", COORDINATOR);
    const refused = await submit({
      eventId: event.id, venueId: seminar, startsAt: at("14:00"), endsAt: at("18:00"), layout: "Theatre", expectedAttendance: 150, replacesBookingId: booking.id,
    });
    expect(refused.status).toBe(422);
    expect(refused.body.error.code).toBe("REPLACEMENT_NOT_VALID");
  });
});

describe("the event (L5-T8)", () => {
  it("is never cancelled: its status and history are unchanged through block, replacement and release", async () => {
    const lkc = await newVenue("L5 Auditorium");
    const seminar = await newVenue("L5 Seminar Room");
    const event = await newEvent();
    const before = await eventState(event.id);
    const made = await requested(lkc, event.id);
    signedInAs("VENUE_STAFF", STAFF);
    const bookingId = (await request(app).post(`/api/v1/booking-requests/${made.id}/approve`).set(bearer)).body.bookingId as string;
    await request(app).post(`/api/v1/venues/${lkc}/unavailability`).set(bearer)
      .send({ startsAt: at("16:00"), endsAt: at("19:00"), reasonType: "SAFETY", description: "Ceiling inspection" });
    expect(await eventState(event.id)).toEqual(before);

    const replacement = await requested(seminar, event.id, { replacesBookingId: bookingId });
    signedInAs("VENUE_STAFF", STAFF);
    await request(app).post(`/api/v1/booking-requests/${replacement.id}/approve`).set(bearer);

    expect(await eventState(event.id)).toEqual(before);
    expect(before.status).toBe("APPROVED");
  });
});
