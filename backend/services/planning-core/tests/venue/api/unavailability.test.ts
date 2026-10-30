import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { testDb } from "../../support/testDb.js";

/**
 * I2 — Venue Staff record and remove periods of unavailability, against the
 * venue and event schemas: what a block records, the review of what it would
 * disrupt, the flags it sets and clears, the messages for coordinators, and the
 * requests it refuses. The setup mirrors FX-BOOKING (tests/L1/README.md).
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
const OWNER = "a9999999-0000-0000-0000-000000000071";
const COORDINATOR = "a9999999-0000-0000-0000-000000000072";
const STAFF = "a9999999-0000-0000-0000-000000000073";
const OTHER_STAFF = "a9999999-0000-0000-0000-000000000074";
const BUILDING = "I2 Test Building";
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
  const blocks = sql`select id from venue.unavailability_blocks where venue_id in (${ours})`;
  await sql`delete from venue.outbox where message_key in (select id::text from venue.unavailability_blocks where venue_id in (${ours}))`;
  await sql`delete from venue.outbox where message_key in (select id::text from venue.booking_requests where venue_id in (${ours}))`;
  await sql`delete from venue.block_disruptions where block_id in (${blocks})`;
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

/** A Singapore time on 2 December 2026, or another day that month. */
const at = (hhmm: string, day = "02") => `2026-12-${day}T${hhmm}:00+08:00`;
const utc = (hhmm: string, day = "02") => new Date(at(hhmm, day)).toISOString();

async function newEvent(name = "I2 test event"): Promise<{ id: string; reference: string }> {
  const [row] = await sql<{ id: string; reference: string }[]>`
    insert into event.events (
      reference, owner_id, name, purpose, description, proposed_start_at, proposed_end_at,
      expected_attendance, equipment_required, registration_required, status, submitted_at,
      last_saved_at, created_by, updated_by
    ) values (
      'EVT-' || lpad(nextval('event.event_reference_seq')::text, 6, '0'), ${OWNER}, ${name}, 'I2 test',
      'I2 test', ${at("14:00")}, ${at("18:00")}, 150, false, false, 'APPROVED', now(), now(), ${OWNER}, ${OWNER}
    )
    returning id, reference
  `;
  await sql`insert into event.assignments (event_id, coordinator_id, assignment_rule, created_by, updated_by)
            values (${row!.id}, ${COORDINATOR}, 'TEST', ${COORDINATOR}, ${COORDINATOR})`;
  return row!;
}

const submit = (payload: object) => request(app).post("/api/v1/booking-requests").set(bearer).send(payload);
const approve = (id: string) => request(app).post(`/api/v1/booking-requests/${id}/approve`).set(bearer);
const record = (venueId: string, payload: unknown) =>
  request(app).post(`/api/v1/venues/${venueId}/unavailability`).set(bearer).send(payload as object);
const remove = (venueId: string, blockId: string) => request(app).post(`/api/v1/venues/${venueId}/unavailability/${blockId}/remove`).set(bearer);
const impact = (venueId: string, startsAt: string, endsAt: string) =>
  request(app).get(`/api/v1/venues/${venueId}/unavailability/impact`).query({ startsAt, endsAt }).set(bearer);
const list = (venueId: string) => request(app).get(`/api/v1/venues/${venueId}/unavailability`).set(bearer);
const calendar = (venueId: string, day = "2026-12-02") =>
  request(app).get(`/api/v1/venues/${venueId}/availability`).query({ from: day, to: day }).set(bearer);

const blockBody = (from: string, until: string, overrides: Record<string, unknown> = {}) => ({
  startsAt: at(from),
  endsAt: at(until),
  reasonType: "MAINTENANCE",
  description: "Stage rigging inspection",
  ...overrides,
});

/** The coordinator's request for the venue, Theatre, 14:00–18:00 unless the test says otherwise. */
async function requested(venueId: string, event: { id: string }, overrides: Record<string, unknown> = {}) {
  signedInAs("EVENT_COORDINATOR", COORDINATOR);
  const res = await submit({ eventId: event.id, venueId, startsAt: at("14:00"), endsAt: at("18:00"), layout: "Theatre", expectedAttendance: 150, ...overrides });
  expect(res.status).toBe(201);
  return res.body as { id: string; reference: string };
}

/** A confirmed booking: the request, approved by the venue's staff (M1). */
async function booked(venueId: string, event: { id: string }, overrides: Record<string, unknown> = {}) {
  const made = await requested(venueId, event, overrides);
  signedInAs("VENUE_STAFF", STAFF);
  const res = await approve(made.id);
  expect(res.status).toBe(200);
  return { ...made, bookingId: res.body.bookingId as string };
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
  return { id: row!.id, eventReference: event.reference, reference: `M1-FX-${event.reference}` };
}

const slotFlag = async (id: string) =>
  (await sql<{ requires_reconfirmation: boolean }[]>`select requires_reconfirmation from venue.venue_slots where id = ${id}`)[0]!
    .requires_reconfirmation;
const blockCount = async (venueId: string) =>
  (await sql<{ n: number }[]>`select count(*)::int as n from venue.unavailability_blocks where venue_id = ${venueId}`)[0]!.n;
const outboxOf = (blockId: string, type: string) =>
  sql<{ envelope: { data: Record<string, unknown> } }[]>`
    select envelope from venue.outbox where message_key = ${blockId} and envelope->>'type' = ${type}
    order by created_at
  `;

describe("POST /api/v1/venues/:id/unavailability (I2)", () => {
  it("records the venue, period, reason type and description, Active, with who and when (I2-T1)", async () => {
    const venueId = await newVenue("I2 Auditorium");
    signedInAs("VENUE_STAFF", STAFF);
    const before = Date.now();

    const res = await record(venueId, blockBody("09:00", "13:00", { description: "Annual rigging inspection" }));

    expect(res.status).toBe(201);
    expect(res.body.block).toMatchObject({
      venueId,
      startsAt: utc("09:00"),
      endsAt: utc("13:00"),
      reasonType: "MAINTENANCE",
      description: "Annual rigging inspection",
      status: "ACTIVE",
      createdBy: STAFF,
    });
    expect(Date.parse(res.body.block.createdAt)).toBeGreaterThanOrEqual(before - 5000);
    expect(res.body.disrupted).toEqual([]);
    expect((await list(venueId)).body.items.map((b: { id: string }) => b.id)).toEqual([res.body.block.id]);
  });

  it("refuses a block missing any field but the end, naming each, and creates nothing (I2-T2; the end became optional with I5)", async () => {
    const venueId = await newVenue("I2 Auditorium");
    signedInAs("VENUE_STAFF", STAFF);

    const res = await record(venueId, {});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_FAILED");
    expect(res.body.error.fields.map((f: { field: string }) => f.field)).toEqual(["startsAt", "reasonType", "description"]);
    expect(await blockCount(venueId)).toBe(0);
  });

  it("refuses an end at or before the start with that as the cause, and allows one a minute later (I2-T3)", async () => {
    const venueId = await newVenue("I2 Auditorium");
    signedInAs("VENUE_STAFF", STAFF);

    for (const until of ["13:00", "12:59"]) {
      const res = await record(venueId, blockBody("13:00", until));
      expect(res.status, until).toBe(400);
      expect(res.body.error.fields).toEqual([{ field: "endsAt", message: "The end must be after the start." }]);
    }
    expect(await blockCount(venueId)).toBe(0);
    expect((await record(venueId, blockBody("13:00", "13:01"))).status).toBe(201);
  });

  it("is created over a confirmed booking, flagging it with the block, who and when (I2-T6)", async () => {
    const venueId = await newVenue("I2 Auditorium");
    const event = await newEvent();
    const booking = await booked(venueId, event);
    signedInAs("VENUE_STAFF", STAFF);
    const before = Date.now();

    const res = await record(venueId, blockBody("16:00", "19:00"));

    expect(res.status).toBe(201);
    expect(res.body.disrupted).toEqual([
      {
        kind: "BOOKING",
        reference: booking.reference,
        eventReference: event.reference,
        overlapFrom: utc("16:00"),
        overlapUntil: utc("18:00"),
        returnsEventToPlanning: false,
      },
    ]);
    expect(await slotFlag(booking.bookingId)).toBe(true);
    const [row] = await sql<{ block_id: string; created_by: string; created_at: Date }[]>`
      select block_id, created_by, created_at from venue.block_disruptions where slot_id = ${booking.bookingId}
    `;
    expect(row).toMatchObject({ block_id: res.body.block.id, created_by: STAFF });
    expect(row!.created_at.getTime()).toBeGreaterThanOrEqual(before - 5000);
  });

  it("keeps the disrupted booking, confirmed and blocking its period, and leaves the event untouched (I2-T7)", async () => {
    const venueId = await newVenue("I2 Auditorium");
    const event = await newEvent();
    const booking = await booked(venueId, event);
    const [before] = await sql`select status, version from event.events where id = ${event.id}`;
    signedInAs("VENUE_STAFF", STAFF);

    await record(venueId, blockBody("16:00", "19:00"));

    const [slot] = await sql`select status from venue.venue_slots where id = ${booking.bookingId}`;
    expect(slot).toEqual({ status: "CONFIRMED" });
    const [after] = await sql`select status, version from event.events where id = ${event.id}`;
    expect(after).toEqual(before);
    const committed = (await calendar(venueId)).body.days[0].committed;
    expect(committed).toContainEqual(expect.objectContaining({ kind: "BOOKING", bookingStatus: "CONFIRMED", eventReference: event.reference }));
    expect(committed).toContainEqual(expect.objectContaining({ kind: "UNAVAILABLE", startsAt: utc("16:00"), endsAt: utc("19:00") }));
  });

  it("writes one message per disrupted booking, to its event's assigned coordinator, in the same transaction (I2-T8)", async () => {
    const venueId = await newVenue("I2 Auditorium");
    const event = await newEvent();
    const booking = await booked(venueId, event);
    signedInAs("VENUE_STAFF", STAFF);

    const res = await record(venueId, blockBody("16:00", "19:00"));

    const rows = await outboxOf(res.body.block.id, "venue-booking.booking-disrupted");
    expect(rows).toHaveLength(1);
    expect(rows[0]!.envelope.data).toEqual({
      blockId: res.body.block.id,
      venueId,
      venueName: "I2 Auditorium",
      kind: "BOOKING",
      reference: booking.reference,
      eventId: event.id,
      eventReference: event.reference,
      eventName: "I2 test event",
      coordinatorId: COORDINATOR,
      blockStartsAt: utc("16:00"),
      blockEndsAt: utc("19:00"),
      reasonType: "MAINTENANCE",
      description: "Stage rigging inspection",
      actedBy: STAFF,
      actedAt: res.body.block.createdAt,
    });
  });

  it("flags an overlapping pending request too, and tells its requesting coordinator (I2-T9)", async () => {
    const venueId = await newVenue("I2 Auditorium");
    const event = await newEvent();
    const made = await requested(venueId, event);
    signedInAs("VENUE_STAFF", STAFF);

    const res = await record(venueId, blockBody("16:00", "19:00"));

    expect(res.body.disrupted).toEqual([expect.objectContaining({ kind: "REQUEST", reference: made.reference, overlapFrom: utc("16:00") })]);
    const [message] = await outboxOf(res.body.block.id, "venue-booking.booking-disrupted");
    expect(message!.envelope.data).toMatchObject({ kind: "REQUEST", reference: made.reference, coordinatorId: COORDINATOR });
    signedInAs("EVENT_COORDINATOR", COORDINATOR);
    const listed = await request(app).get("/api/v1/booking-requests").query({ eventId: event.id }).set(bearer);
    expect(listed.body.items[0]).toMatchObject({ status: "PENDING", requiresReconfirmation: true });
  });

  it("fails without flagging anything or writing a message (I2-T12)", async () => {
    const venueId = await newVenue("I2 Auditorium");
    const booking = await booked(venueId, await newEvent());
    signedInAs("VENUE_STAFF", STAFF);

    expect((await record(venueId, blockBody("16:00", "15:00"))).status).toBe(400);

    expect(await slotFlag(booking.bookingId)).toBe(false);
    expect(await blockCount(venueId)).toBe(0);
    const [{ n }] = await sql<{ n: number }[]>`
      select count(*)::int as n from venue.outbox where envelope->>'type' = 'venue-booking.booking-disrupted'
        and envelope->'data'->>'venueId' = ${venueId}
    `;
    expect(n).toBe(0);
  });

  it("lets only the venue's own Venue Staff record a block; nothing changes for anyone else (I2-T13)", async () => {
    const mine = await newVenue("I2 Auditorium");
    const theirs = await newVenue("I2 Other Hall", OTHER_STAFF);

    signedInAs("VENUE_STAFF", STAFF);
    const notMine = await record(theirs, blockBody("09:00", "13:00"));
    expect(notMine.status).toBe(403);
    expect(notMine.body.error).toMatchObject({ code: "ROLE_NOT_AUTHORISED", message: "Only the venue's Venue Staff can record or remove its unavailability." });

    for (const [role, userId] of [["EVENT_COORDINATOR", COORDINATOR], ["EVENT_ORGANISER", OWNER], ["TECH_SUPPORT_STAFF", STAFF]] as const) {
      signedInAs(role, userId);
      expect((await record(mine, blockBody("09:00", "13:00"))).status, role).toBe(403);
    }
    expect(await blockCount(mine)).toBe(0);
    expect(await blockCount(theirs)).toBe(0);
  });

  it("answers 404 for an unknown venue, and is rate limited (until the gateway's limits, ADR-0011)", async () => {
    signedInAs("VENUE_STAFF", STAFF);
    for (const id of [randomUUID(), "not-a-venue"]) {
      const res = await record(id, blockBody("09:00", "13:00"));
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("VENUE_NOT_FOUND");
    }
    expect((await list(randomUUID())).headers["ratelimit-policy"]).toMatch(/q=120; w=60/);
  });

  it("never leaves an unflagged booking under an active block when a block and an approval happen at once (§4.6 rule 1)", async () => {
    for (let round = 0; round < 10; round += 1) {
      await cleanUp();
      const venueId = await newVenue("I2 Auditorium");
      const made = await requested(venueId, await newEvent());
      signedInAs("VENUE_STAFF", STAFF);

      const [approval, block] = await Promise.all([approve(made.id), record(venueId, blockBody("16:00", "19:00"))]);

      expect(block.status).toBe(201);
      if (approval.status === 200) expect(await slotFlag(approval.body.bookingId)).toBe(true);
      else expect(approval.body.error?.code, `${approval.status} ${JSON.stringify(approval.body)}`).toBe("VENUE_UNAVAILABLE");
    }
  });
});

describe("GET /api/v1/venues/:id/unavailability/impact (I2-T4, I2-T5)", () => {
  it("lists each booking a block would disrupt, with references and overlapping period, without recording anything", async () => {
    const venueId = await newVenue("I2 Auditorium");
    const event = await newEvent();
    const booking = await booked(venueId, event);
    signedInAs("VENUE_STAFF", STAFF);

    const res = await impact(venueId, at("16:00"), at("19:00"));

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([
      { kind: "BOOKING", reference: booking.reference, eventReference: event.reference, overlapFrom: utc("16:00"), overlapUntil: utc("18:00"), returnsEventToPlanning: false },
    ]);
    expect((await impact(venueId, at("18:00"), at("19:00"))).body.items).toEqual([]);
    expect(await blockCount(venueId)).toBe(0);
    expect(await slotFlag(booking.bookingId)).toBe(false);
  });

  it("compares by occupied period: a block over only the turnaround disrupts the booking (CR-01)", async () => {
    const venueId = await newVenue("I2 Auditorium");
    const other = await otherBooking(venueId, "10:00", "12:00", 30, 45);
    signedInAs("VENUE_STAFF", STAFF);

    expect((await impact(venueId, at("12:30"), at("13:30"))).body.items).toEqual([
      { kind: "BOOKING", reference: other.reference, eventReference: other.eventReference, overlapFrom: utc("12:30"), overlapUntil: utc("12:45"), returnsEventToPlanning: false },
    ]);
    expect((await impact(venueId, at("12:45"), at("13:30"))).body.items).toEqual([]);
  });

  it("refuses a bad period, and anyone but the venue's staff", async () => {
    const venueId = await newVenue("I2 Auditorium");
    signedInAs("VENUE_STAFF", STAFF);
    const bad = await impact(venueId, at("13:00"), at("12:00"));
    expect(bad.status).toBe(400);
    expect(bad.body.error.fields).toEqual([{ field: "endsAt", message: "The end must be after the start." }]);

    signedInAs("VENUE_STAFF", OTHER_STAFF);
    expect((await impact(venueId, at("12:00"), at("13:00"))).status).toBe(403);
  });
});

describe("a block closes its period (I2-T10)", () => {
  it("takes the venue out of search and refuses a request over it, naming the block; one that only touches it is accepted", async () => {
    const venueId = await newVenue("I2 Auditorium");
    const event = await newEvent();
    signedInAs("VENUE_STAFF", STAFF);
    await record(venueId, blockBody("09:00", "13:00", { startsAt: at("09:00", "09"), endsAt: at("13:00", "09"), description: "Annual rigging inspection" }));

    signedInAs("EVENT_COORDINATOR", COORDINATOR);
    const search = await request(app).get("/api/v1/venues/search").query({ location: BUILDING, from: at("10:00", "09"), to: at("12:00", "09") }).set(bearer);
    expect(search.body.items.map((v: { name: string }) => v.name)).not.toContain("I2 Auditorium");

    const refused = await submit({ eventId: event.id, venueId, startsAt: at("10:00", "09"), endsAt: at("12:00", "09"), layout: "Theatre", expectedAttendance: 150 });
    expect(refused.status).toBe(409);
    expect(refused.body.error).toMatchObject({
      code: "VENUE_UNAVAILABLE",
      message:
        "I2 Auditorium is unavailable for Maintenance, “Annual rigging inspection” (Wednesday 9 December 2026, 09:00–13:00), " +
        "so it can't be requested for this period. Choose another time or venue.",
    });
    const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from venue.booking_requests where event_id = ${event.id}`;
    expect(n).toBe(0);

    const touching = await submit({ eventId: event.id, venueId, startsAt: at("13:00", "09"), endsAt: at("15:00", "09"), layout: "Theatre", expectedAttendance: 150 });
    expect(touching.status).toBe(201);
  });
});

describe("POST /api/v1/venues/:id/unavailability/:blockId/remove (I2-T11)", () => {
  it("records who removed it and when, and clears a booking's flag only once no other block disrupts it, telling the coordinator each time", async () => {
    const venueId = await newVenue("I2 Auditorium");
    const event = await newEvent();
    const booking = await booked(venueId, event);
    signedInAs("VENUE_STAFF", STAFF);
    const a = (await record(venueId, blockBody("15:00", "16:00", { description: "Fire alarm test" }))).body.block;
    const b = (await record(venueId, blockBody("17:00", "19:00"))).body.block;
    const before = Date.now();

    const first = await remove(venueId, a.id);

    expect(first.status).toBe(200);
    expect(first.body.block).toMatchObject({ id: a.id, status: "REMOVED", removedBy: STAFF });
    expect(Date.parse(first.body.block.removedAt)).toBeGreaterThanOrEqual(before - 5000);
    expect(first.body.cleared).toEqual([{ kind: "BOOKING", reference: booking.reference, eventReference: event.reference, stillDisrupted: true }]);
    expect(await slotFlag(booking.bookingId)).toBe(true);
    const [firstMessage] = await outboxOf(a.id, "venue-booking.disruption-cleared");
    expect(firstMessage!.envelope.data).toMatchObject({ kind: "BOOKING", reference: booking.reference, coordinatorId: COORDINATOR, stillDisrupted: true, actedBy: STAFF });

    const second = await remove(venueId, b.id);
    expect(second.body.cleared).toEqual([expect.objectContaining({ stillDisrupted: false })]);
    expect(await slotFlag(booking.bookingId)).toBe(false);
    expect((await outboxOf(b.id, "venue-booking.disruption-cleared"))[0]!.envelope.data).toMatchObject({ stillDisrupted: false });

    expect((await list(venueId)).body.items).toEqual([]);
    const committed = (await calendar(venueId)).body.days[0].committed;
    expect(committed.some((p: { kind: string }) => p.kind === "UNAVAILABLE")).toBe(false);
    expect(committed).toContainEqual(expect.objectContaining({ kind: "BOOKING", bookingStatus: "CONFIRMED" }));
  });

  it("refuses a block already removed, an unknown one, one at another venue, and anyone but the venue's staff (I2-T13)", async () => {
    const venueId = await newVenue("I2 Auditorium");
    const other = await newVenue("I2 Second Room");
    signedInAs("VENUE_STAFF", STAFF);
    const made = (await record(venueId, blockBody("09:00", "13:00"))).body.block;

    signedInAs("EVENT_COORDINATOR", COORDINATOR);
    expect((await remove(venueId, made.id)).status).toBe(403);

    signedInAs("VENUE_STAFF", STAFF);
    for (const [venue, id] of [[venueId, randomUUID()], [other, made.id], [venueId, "not-a-block"]] as const) {
      const res = await remove(venue, id);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("BLOCK_NOT_FOUND");
    }
    expect((await remove(venueId, made.id)).status).toBe(200);
    const again = await remove(venueId, made.id);
    expect(again.status).toBe(409);
    expect(again.body.error).toMatchObject({ code: "BLOCK_ALREADY_REMOVED" });
  });
});
