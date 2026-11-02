import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { parseCloudEvent, type EventStatus } from "@connectsphere/contracts";
import { notificationsFor } from "../../../../notification/src/domain/recipients.js";
import { testDb } from "../../support/testDb.js";
import { actorsWithPrefix, cleanLineFixtures, createBulkType, insertLineDirect } from "../../support/lineFixtures.js";
import { seedEvent } from "../../support/seedEvent.js";
import { EVENT_END, EVENT_START } from "../../support/eventDates.js";

// The U1 cards (tests/U1): real Express app and migrated Postgres, with JWT verification and the
// identity lookups replaced. FX-U1's reservation is made through Q1's real route, an event reaches
// Safety Review through F5's real route where a card says so, and U1-T12 passes the stored message
// through the notification service's recipient rule. U1-T16 is the browser walk-through, by hand.
vi.mock("../../../src/shared/auth/verifyJwt.js", () => ({
  verifyJwt: (req: { auth?: { supabaseUserId?: string } }, _res: unknown, next: () => void) => {
    req.auth = { supabaseUserId: "u1-card-subject" };
    next();
  },
}));
vi.mock("../../../src/modules/change/auth/identity.js", async () => {
  const actual = await vi.importActual<typeof import("../../../src/modules/change/auth/identity.js")>(
    "../../../src/modules/change/auth/identity.js",
  );
  return { ...actual, resolveCurrentUser: vi.fn() };
});
vi.mock("../../../src/modules/equipment/auth/identity.js", async () => {
  const actual = await vi.importActual<typeof import("../../../src/modules/equipment/auth/identity.js")>(
    "../../../src/modules/equipment/auth/identity.js",
  );
  return { ...actual, resolveCurrentUser: vi.fn() };
});

const { resolveCurrentUser: resolveChangeUser } = await import("../../../src/modules/change/auth/identity.js");
const { resolveCurrentUser: resolveEquipmentUser } = await import("../../../src/modules/equipment/auth/identity.js");
const { app } = await import("../../../src/app.js");

const sql = testDb();
const base = actorsWithPrefix("0f1a0000");
const A = { ...base, so: "0f1a0000-0000-4000-8000-000000000007", lead: "0f1a0000-0000-4000-8000-000000000008" };
const bearer = { Authorization: "Bearer u1-card-token" };

type Role = "EVENT_COORDINATOR" | "TECH_SUPPORT_STAFF" | "EVENT_ORGANISER" | "VENUE_STAFF" | "ATTENDEE" | "SAFETY_OFFICER" | "EVENT_COORDINATOR_LEAD";
function signedInAs(userId: string, role: Role) {
  const user = { id: userId, email: "u1@connectsphere.test", role };
  vi.mocked(resolveChangeUser).mockResolvedValue(user);
  vi.mocked(resolveEquipmentUser).mockResolvedValue(user);
}
const asC1 = () => signedInAs(A.c1, "EVENT_COORDINATOR");
const asSo = () => signedInAs(A.so, "SAFETY_OFFICER");
const asTs = () => signedInAs(A.ts, "TECH_SUPPORT_STAFF");

const OTHER_ROLES: [string, string, Role][] = [
  ["C1", A.c1, "EVENT_COORDINATOR"],
  ["C2", A.c2, "EVENT_COORDINATOR"],
  ["ORG", A.org, "EVENT_ORGANISER"],
  ["VS", A.vs, "VENUE_STAFF"],
  ["TS", A.ts, "TECH_SUPPORT_STAFF"],
  ["ATT", A.att, "ATTENDEE"],
  ["LEAD", A.lead, "EVENT_COORDINATOR_LEAD"],
];

const confirm = (id: string) => request(app).post(`/api/v1/events/${id}/confirmation`).set(bearer).send();
const markConfirmed = (id: string) => request(app).post(`/api/v1/events/${id}/mark-confirmed`).set(bearer).send();
const decide = (id: string, body: Record<string, unknown>) => request(app).post(`/api/v1/events/${id}/safety-decision`).set(bearer).send(body);
const queue = () => request(app).get("/api/v1/safety-reviews").set(bearer);
const review = (id: string) => request(app).get(`/api/v1/events/${id}/safety-review`).set(bearer);

// ---------------------------------------------------------------------------------------------
// FX-U1 (tests/U1/README.md)
// ---------------------------------------------------------------------------------------------

interface Fixture {
  event: { id: string; reference: string; name: string };
  venue: { id: string; name: string };
  b1: { id: string; reference: string };
  r1: { id: string; lineId: string; typeName: string };
}

async function newVenue(name: string) {
  const [row] = await sql<{ id: string }[]>`
    insert into venue.venues (name, building, max_capacity, layouts, operating_hours, created_by, updated_by)
    values (${name}, 'U1 Test Building', 200,
            ${sql.json([{ name: "Theatre", capacity: 150 }, { name: "Banquet", capacity: 80 }])}, ${sql.json({})}, ${A.vs}, ${A.vs})
    returning id
  `;
  await sql`insert into venue.venue_staff (venue_id, user_id, created_by, updated_by) values (${row!.id}, ${A.vs}, ${A.vs}, ${A.vs})`;
  return { id: row!.id, name };
}

/** A confirmed slot, with the approved request that booked it in the Theatre layout. */
async function confirmedBooking(venueId: string, eventId: string) {
  const reference = `BKR-${String(Math.floor(Math.random() * 900_000) + 100_000)}`;
  const [slot] = await sql<{ id: string }[]>`
    insert into venue.venue_slots (venue_id, event_id, reference, starts_at, ends_at, status, created_by, updated_by)
    values (${venueId}, ${eventId}, ${reference}, ${EVENT_START}, ${EVENT_END}, 'CONFIRMED', ${A.vs}, ${A.vs})
    returning id
  `;
  await sql`
    insert into venue.booking_requests (
      event_id, venue_id, starts_at, ends_at, layout, expected_attendance, event_starts_at, event_ends_at,
      event_attendance, differs_from_event, status, requested_by, decided_by, decided_at, booking_id, created_by, updated_by
    ) values (
      ${eventId}, ${venueId}, ${EVENT_START}, ${EVENT_END}, 'Theatre', 120, ${EVENT_START}, ${EVENT_END},
      120, false, 'APPROVED', ${A.c1}, ${A.vs}, now(), ${slot!.id}, ${A.c1}, ${A.c1}
    )
  `;
  return { id: slot!.id, reference };
}

/** The history entry F5 would have written, for an event seeded straight into Safety Review. */
async function enterSafetyReview(eventId: string) {
  await sql`
    insert into event.event_history (event_id, entry_type, previous_status, new_status, actor_user_id, actor_role, triggering_action, created_by, updated_by)
    values (${eventId}, 'STATUS_CHANGE', 'APPROVED', 'SAFETY_REVIEW', ${A.c1}, 'EVENT_COORDINATOR', 'CONFIRM_ARRANGEMENTS', ${A.c1}, ${A.c1})
  `;
}

async function fixture(options: { status?: EventStatus } = {}): Promise<Fixture> {
  const status = options.status ?? "SAFETY_REVIEW";
  const name = "U1 fixture event";
  const id = await seedEvent(sql, { ownerId: A.org, status, endsAt: new Date(EVENT_END), name });
  await sql`
    update event.events set equipment_required = true, expected_attendance = 120,
      accessibility_needs = 'Step-free access to the main hall' where id = ${id}
  `;
  await sql`insert into event.assignments (event_id, coordinator_id, assignment_rule) values (${id}, ${A.c1}, 'TEST_FIXTURE')`;
  const [row] = await sql<{ reference: string }[]>`select reference from event.events where id = ${id}`;
  const event = { id, reference: row!.reference, name };

  const tag = randomUUID().slice(0, 8);
  const venue = await newVenue(`U1 Hall ${tag}`);
  const b1 = await confirmedBooking(venue.id, id);
  const typeName = `U1 Chairs ${tag}`;
  const chairs = await createBulkType(sql, A.ts, typeName, 10);
  const lineId = await insertLineDirect(sql, {
    event,
    equipmentTypeId: chairs.id,
    requestedBy: A.c1,
    status: "CONFIRMED",
    quantity: 5,
    notes: "Rows along the north wall",
  });
  asTs();
  const reserved = await request(app).post(`/api/v1/equipment/request-lines/${lineId}/reservation`).set(bearer).send({});
  expect(reserved.status).toBe(201);
  const [reservation] = await sql<{ id: string }[]>`select id from equipment.reservations where request_line_id = ${lineId}`;

  if (status === "SAFETY_REVIEW") await enterSafetyReview(id);
  return { event, venue, b1, r1: { id: reservation!.id, lineId, typeName } };
}

/** Everything a refusal must leave as it was: status, history, decisions, flags, slots, reservations, outbox. */
async function state(eventId: string) {
  const [event] = await sql`select status, version from event.events where id = ${eventId}`;
  const [history] = await sql`select count(*)::int as n from event.event_history where event_id = ${eventId}`;
  const [decisions] = await sql`select count(*)::int as n from event.safety_decisions where event_id = ${eventId}`;
  const slots = await sql`select id, status, requires_reconfirmation, period_mismatch, unsuitable from venue.venue_slots where event_id = ${eventId} order by id`;
  const venueFlags = await sql`select id from venue.arrangement_flags where event_id = ${eventId} order by id`;
  const reservations = await sql`select id, status, flagged_for_review from equipment.reservations where event_id = ${eventId} order by id`;
  const equipmentFlags = await sql`select id from equipment.reservation_flags where event_id = ${eventId} order by id`;
  const [outbox] = await sql`select count(*)::int as n from event.outbox where message_key = ${eventId}`;
  return { event, history: history!.n, decisions: decisions!.n, slots, venueFlags, reservations, equipmentFlags, outbox: outbox!.n };
}

async function latestHistory(eventId: string) {
  const [row] = await sql`
    select previous_status, new_status, actor_user_id, actor_role, triggering_action
    from event.event_history where event_id = ${eventId} and entry_type = 'STATUS_CHANGE'
    order by occurred_at desc, created_at desc limit 1
  `;
  return row!;
}

async function messagesOf(eventId: string, type: string) {
  const rows = await sql<{ envelope: unknown }[]>`
    select envelope from event.outbox where message_key = ${eventId} and envelope->>'type' = ${type} order by seq
  `;
  return rows.map((row) => parseCloudEvent(row.envelope));
}

async function clean() {
  const venues = sql`select id from venue.venues where created_by = ${A.vs}`;
  await sql`delete from venue.arrangement_flags where event_id in (select id from event.events where owner_id = ${A.org})`;
  await sql`delete from venue.booking_requests where venue_id in (${venues})`;
  await sql`delete from venue.venue_slots where venue_id in (${venues})`;
  await sql`delete from venue.venue_staff where venue_id in (${venues})`;
  await sql`delete from venue.venues where created_by = ${A.vs}`;
  await cleanLineFixtures(sql, [A.org], [A.ts]);
}

beforeAll(clean);
beforeEach(async () => {
  await clean();
  asC1();
});
afterAll(async () => {
  await clean();
  await sql.end();
});

// ---------------------------------------------------------------------------------------------

describe("U1 cards (tests/U1)", () => {
  it("U1-T1 an event that reaches Safety Review appears in the Safety Officer's queue", async () => {
    const { event } = await fixture({ status: "APPROVED" });
    const planning = await seedEvent(sql, { ownerId: A.org, status: "PLANNING", endsAt: new Date(EVENT_END) });
    const confirmedEvent = await seedEvent(sql, { ownerId: A.org, status: "CONFIRMED", endsAt: new Date(EVENT_END) });

    asC1();
    expect((await confirm(event.id)).status).toBe(200);

    asSo();
    const listed = await queue();
    expect(listed.status).toBe(200);
    const ids = listed.body.events.map((entry: { id: string }) => entry.id);
    expect(ids).toContain(event.id);
    expect(ids).not.toContain(planning);
    expect(ids).not.toContain(confirmedEvent);
    expect(listed.body.events.find((entry: { id: string }) => entry.id === event.id)).toMatchObject({
      reference: event.reference,
      name: event.name,
      expectedAttendance: 150,
      assignedCoordinatorId: A.c1,
      decision: null,
    });

    const notInReview = await review(planning);
    expect(notInReview.status).toBe(409);
    expect(notInReview.body.error.code).toBe("STATUS_TRANSITION_NOT_PERMITTED");
    expect(notInReview.body.error.message).toContain("Planning");
  });

  it("U1-T2 an event cannot become Confirmed until the Safety Officer approves", async () => {
    const { event } = await fixture();
    const before = await state(event.id);
    asC1();
    const response = await markConfirmed(event.id);
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("SAFETY_CHECK_NOT_PASSED");
    expect(await state(event.id)).toEqual(before);
  });

  it("U1-T3 the review shows the factors the Safety Officer weighs", async () => {
    const { event, venue, b1, r1 } = await fixture();
    asSo();
    const response = await review(event.id);
    expect(response.status).toBe(200);
    expect(response.body.event).toMatchObject({ id: event.id, status: "SAFETY_REVIEW", assignedCoordinatorId: A.c1 });
    expect(response.body.factors.expectedAttendance).toBe(120);
    expect(response.body.factors.accessibilityNeeds).toBe("Step-free access to the main hall");
    expect(response.body.factors.venues).toEqual([
      {
        bookingId: b1.id,
        reference: b1.reference,
        status: "CONFIRMED",
        venueName: venue.name,
        startsAt: EVENT_START,
        endsAt: EVENT_END,
        layout: "Theatre",
        layoutCapacity: 150,
        venueMaxCapacity: 200,
        layouts: [
          { name: "Theatre", capacity: 150 },
          { name: "Banquet", capacity: 80 },
        ],
      },
    ]);
    expect(response.body.factors.equipment).toEqual([
      {
        lineId: r1.lineId,
        equipmentTypeName: r1.typeName,
        quantity: 5,
        reservationId: r1.id,
        reservedQuantity: 5,
        placementNotes: "Rows along the north wall",
      },
    ]);
    expect(response.body.flags).toEqual([]);
    expect(response.body.decision).toBeNull();
  });

  it("U1-T4 approve records the check as passed and the event stays in Safety Review", async () => {
    const { event } = await fixture();
    asSo();
    const response = await decide(event.id, { decision: "APPROVE", reason: "Exits and crowd movement checked on site" });
    expect(response.status).toBe(201);
    expect(response.body.event).toMatchObject({ id: event.id, status: "SAFETY_REVIEW", previousStatus: "SAFETY_REVIEW" });
    expect(response.body.decision).toMatchObject({ decision: "APPROVE", reason: "Exits and crowd movement checked on site", decidedBy: A.so });

    const rows = await sql`select decision, reason, decided_by, decided_at from event.safety_decisions where event_id = ${event.id}`;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ decision: "APPROVE", reason: "Exits and crowd movement checked on site", decided_by: A.so });
    expect((rows[0]!.decided_at as Date).toISOString()).toBe(response.body.decision.decidedAt);
    expect((await state(event.id)).event!.status).toBe("SAFETY_REVIEW");
    expect(await latestHistory(event.id)).toMatchObject({
      previous_status: "SAFETY_REVIEW",
      new_status: "SAFETY_REVIEW",
      actor_user_id: A.so,
      actor_role: "SAFETY_OFFICER",
      triggering_action: "APPROVE_SAFETY",
    });

    const queued = (await queue()).body.events.find((entry: { id: string }) => entry.id === event.id);
    expect(queued.decision).toBe("APPROVE");
  });

  it("U1-T5 the assigned coordinator marks an approved event Confirmed", async () => {
    const { event } = await fixture();
    asSo();
    expect((await decide(event.id, { decision: "APPROVE" })).status).toBe(201);

    asC1();
    const response = await markConfirmed(event.id);
    expect(response.status).toBe(200);
    expect(response.body.event).toMatchObject({ id: event.id, status: "CONFIRMED", previousStatus: "SAFETY_REVIEW" });
    expect((await state(event.id)).event!.status).toBe("CONFIRMED");
    expect(await latestHistory(event.id)).toMatchObject({
      previous_status: "SAFETY_REVIEW",
      new_status: "CONFIRMED",
      actor_user_id: A.c1,
      actor_role: "EVENT_COORDINATOR",
      triggering_action: "MARK_CONFIRMED",
    });
    const changed = await messagesOf(event.id, "event.status-changed");
    expect(changed.at(-1)!.data).toMatchObject({ previousStatus: "SAFETY_REVIEW", newStatus: "CONFIRMED", action: "MARK_CONFIRMED" });
  });

  it("U1-T6 only the assigned coordinator may mark an approved event Confirmed", async () => {
    const { event } = await fixture();
    asSo();
    expect((await decide(event.id, { decision: "APPROVE" })).status).toBe(201);
    const before = await state(event.id);

    for (const [name, userId, role] of OTHER_ROLES.filter(([name]) => name !== "C1")) {
      signedInAs(userId, role);
      const response = await markConfirmed(event.id);
      expect([name, response.status, response.body.error.code]).toEqual([name, 403, "ROLE_NOT_AUTHORISED"]);
    }
    asSo();
    const asOfficer = await markConfirmed(event.id);
    expect([asOfficer.status, asOfficer.body.error.code]).toEqual([403, "ROLE_NOT_AUTHORISED"]);
    expect(await state(event.id)).toEqual(before);
  });

  it("U1-T7 request changes returns the event to Planning and flags the named arrangements", async () => {
    const { event, b1, r1 } = await fixture();
    asSo();
    const reason = "Move the chairs away from the east exit";
    const response = await decide(event.id, { decision: "REQUEST_CHANGES", reason, flagBookingIds: [b1.id], flagReservationIds: [r1.id] });
    expect(response.status).toBe(201);
    expect(response.body.event).toMatchObject({ status: "PLANNING", previousStatus: "SAFETY_REVIEW" });
    expect(response.body.decision.flagged).toEqual({ bookings: [b1.id], reservations: [r1.id] });

    const after = await state(event.id);
    expect(after.event!.status).toBe("PLANNING");
    expect(after.slots).toEqual([expect.objectContaining({ id: b1.id, status: "CONFIRMED", period_mismatch: true })]);
    expect(after.reservations).toEqual([expect.objectContaining({ id: r1.id, status: "RESERVED", flagged_for_review: true })]);
    expect(await latestHistory(event.id)).toMatchObject({ previous_status: "SAFETY_REVIEW", new_status: "PLANNING", triggering_action: "REQUEST_SAFETY_CHANGES" });

    // S3's flag list shows them, with the officer's reason.
    signedInAs(A.c1, "EVENT_COORDINATOR");
    const flags = await request(app).get(`/api/v1/events/${event.id}/arrangement-flags`).set(bearer);
    expect(flags.status).toBe(200);
    expect(flags.body.flags).toEqual([
      expect.objectContaining({ arrangement: "BOOKING", id: b1.id, flag: "REQUIRES_RECONFIRMATION", reason: `Safety review: ${reason}` }),
      expect.objectContaining({ arrangement: "EQUIPMENT", id: r1.id, flag: "FLAGGED_FOR_REVIEW", reason: `Safety review: ${reason}` }),
    ]);
  });

  it("U1-T8 requesting changes or rejecting without a reason is refused", async () => {
    const { event } = await fixture();
    const before = await state(event.id);
    asSo();
    for (const body of [
      { decision: "REQUEST_CHANGES" },
      { decision: "REQUEST_CHANGES", reason: "   " },
      { decision: "REJECT" },
    ]) {
      const response = await decide(event.id, body);
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_FAILED");
      expect(response.body.error.fields).toEqual([expect.objectContaining({ field: "reason" })]);
    }
    expect(await state(event.id)).toEqual(before);
  });

  it("U1-T9 reject returns the event to Planning as a rejection of the arrangement as a whole", async () => {
    const { event, b1, r1 } = await fixture();
    asSo();
    const response = await decide(event.id, { decision: "REJECT", reason: "The venue cannot hold this crowd safely" });
    expect(response.status).toBe(201);
    expect(response.body.event).toMatchObject({ status: "PLANNING", previousStatus: "SAFETY_REVIEW" });
    expect(response.body.decision).toMatchObject({ decision: "REJECT", flagged: { bookings: [], reservations: [] } });

    const after = await state(event.id);
    expect(after.event!.status).toBe("PLANNING");
    expect(after.slots).toEqual([expect.objectContaining({ id: b1.id, status: "CONFIRMED", period_mismatch: false, unsuitable: false })]);
    expect(after.reservations).toEqual([expect.objectContaining({ id: r1.id, status: "RESERVED", flagged_for_review: false })]);
    expect(after.venueFlags).toEqual([]);
    expect(after.equipmentFlags).toEqual([]);
    expect(await latestHistory(event.id)).toMatchObject({ new_status: "PLANNING", triggering_action: "REJECT_SAFETY_ARRANGEMENT" });
  });

  it("U1-T10 after rework the event passes confirmation and the safety check again", async () => {
    const { event, b1, r1 } = await fixture();
    asSo();
    expect((await decide(event.id, { decision: "REQUEST_CHANGES", reason: "Rework", flagBookingIds: [b1.id], flagReservationIds: [r1.id] })).status).toBe(201);

    asC1();
    const blocked = await confirm(event.id);
    expect(blocked.status).toBe(422);
    expect(blocked.body.error.code).toBe("ARRANGEMENTS_NOT_READY");

    await sql`update venue.venue_slots set period_mismatch = false where id = ${b1.id}`;
    await sql`update equipment.reservations set flagged_for_review = false where id = ${r1.id}`;
    expect((await confirm(event.id)).status).toBe(200);

    asSo();
    const queued = (await queue()).body.events.find((entry: { id: string }) => entry.id === event.id);
    expect(queued).toMatchObject({ decision: null });

    // The earlier request for changes does not count as a decision on this review.
    asC1();
    const early = await markConfirmed(event.id);
    expect([early.status, early.body.error.code]).toEqual([409, "SAFETY_CHECK_NOT_PASSED"]);
    asSo();
    expect((await decide(event.id, { decision: "APPROVE" })).status).toBe(201);
    asC1();
    expect((await markConfirmed(event.id)).status).toBe(200);
    expect(await sql`select decision from event.safety_decisions where event_id = ${event.id} order by decided_at`).toEqual([
      expect.objectContaining({ decision: "REQUEST_CHANGES" }),
      expect.objectContaining({ decision: "APPROVE" }),
    ]);
  });

  it("U1-T11 events confirmed before the feature are not reviewed", async () => {
    const id = await seedEvent(sql, { ownerId: A.org, status: "CONFIRMED", endsAt: new Date(EVENT_END), name: "Confirmed before U1" });
    await sql`insert into event.assignments (event_id, coordinator_id, assignment_rule) values (${id}, ${A.c1}, 'TEST_FIXTURE')`;
    const before = await state(id);

    asSo();
    expect((await queue()).body.events.map((entry: { id: string }) => entry.id)).not.toContain(id);
    const decision = await decide(id, { decision: "APPROVE" });
    expect([decision.status, decision.body.error.code]).toEqual([409, "STATUS_TRANSITION_NOT_PERMITTED"]);
    expect(decision.body.error.message).toContain("Confirmed");

    asC1();
    const marked = await markConfirmed(id);
    expect([marked.status, marked.body.error.code]).toEqual([409, "STATUS_TRANSITION_NOT_PERMITTED"]);
    expect(await state(id)).toEqual(before);
  });

  it("U1-T12 every decision records the officer, time, decision and reason, writes history and notifies", async () => {
    const { event, b1 } = await fixture();
    asSo();
    const response = await decide(event.id, { decision: "REQUEST_CHANGES", reason: "Widen the aisle", flagBookingIds: [b1.id] });
    expect(response.status).toBe(201);

    const [row] = await sql`select decision, reason, decided_by, decided_at from event.safety_decisions where event_id = ${event.id}`;
    expect(row).toMatchObject({ decision: "REQUEST_CHANGES", reason: "Widen the aisle", decided_by: A.so });
    expect((row!.decided_at as Date).toISOString()).toBe(response.body.decision.decidedAt);
    expect(await latestHistory(event.id)).toMatchObject({ actor_user_id: A.so, actor_role: "SAFETY_OFFICER", triggering_action: "REQUEST_SAFETY_CHANGES" });
    expect(await messagesOf(event.id, "event.status-changed")).toHaveLength(1);

    const [message, ...rest] = await messagesOf(event.id, "event.safety-decision-recorded");
    expect(rest).toHaveLength(0);
    expect(message!.data).toMatchObject({
      eventId: event.id,
      ownerId: A.org,
      coordinatorId: A.c1,
      decision: "REQUEST_CHANGES",
      reason: "Widen the aisle",
      decidedBy: A.so,
      flaggedBookingReferences: [b1.reference],
    });
    const notices = notificationsFor({ id: message!.id, type: message!.type, time: message!.time, subject: message!.subject!, data: message!.data as Record<string, unknown> });
    expect(notices.map((notice) => notice.recipientUserId).sort()).toEqual([A.c1, A.org].sort());
    for (const notice of notices) {
      expect(notice.message).toContain("Widen the aisle");
      expect(notice.message).toContain(b1.reference);
    }
  });

  it("U1-T13 only the Safety Officer may record a decision", async () => {
    const { event } = await fixture();
    const before = await state(event.id);
    for (const [name, userId, role] of OTHER_ROLES) {
      signedInAs(userId, role);
      for (const response of [await decide(event.id, { decision: "APPROVE" }), await queue(), await review(event.id)]) {
        expect([name, response.status, response.body.error.code]).toEqual([name, 403, "ROLE_NOT_AUTHORISED"]);
      }
    }
    expect(await state(event.id)).toEqual(before);
  });

  it("U1-T14 approval is refused while arrangement flags are outstanding", async () => {
    const { event, r1 } = await fixture();
    await sql`update equipment.reservations set flagged_for_review = true where id = ${r1.id}`;
    await sql`
      insert into equipment.reservation_flags (reservation_id, event_id, change_request_id, flag, reason, details)
      values (${r1.id}, ${event.id}, ${randomUUID()}, 'FLAGGED_FOR_REVIEW', 'The change moved the event', ${sql.json({})})
    `;
    const before = await state(event.id);

    asSo();
    const approval = await decide(event.id, { decision: "APPROVE" });
    expect(approval.status).toBe(409);
    expect(approval.body.error.code).toBe("ARRANGEMENT_FLAGS_OUTSTANDING");
    expect(approval.body.error.message).toContain(r1.typeName);
    expect(approval.body.error.details.flags).toEqual([{ what: "equipment", name: r1.typeName, flag: "FLAGGED_FOR_REVIEW" }]);
    expect(await state(event.id)).toEqual(before);

    expect((await decide(event.id, { decision: "REQUEST_CHANGES", reason: "Resolve the flag first" })).status).toBe(201);
  });

  it("U1-T15 one decision is recorded for each review", async () => {
    const { event } = await fixture();
    asSo();
    expect((await decide(event.id, { decision: "APPROVE" })).status).toBe(201);
    const before = await state(event.id);

    const second = await decide(event.id, { decision: "REQUEST_CHANGES", reason: "Changed my mind" });
    expect([second.status, second.body.error.code]).toEqual([409, "SAFETY_DECISION_ALREADY_RECORDED"]);
    expect(await state(event.id)).toEqual(before);
    expect(before.decisions).toBe(1);
  });
});
