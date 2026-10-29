import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { EVENT_STATUS_LABELS, KAFKA_TOPICS, parseCloudEvent, type EventStatus } from "@connectsphere/contracts";
import { notificationsFor } from "../../../../notification/src/domain/recipients.js";
import { testDb } from "../../support/testDb.js";
import { actorsWithPrefix, cleanLineFixtures, createBulkType, insertLineDirect } from "../../support/lineFixtures.js";
import { seedEvent } from "../../support/seedEvent.js";
import { EVENT_END, EVENT_START } from "../../support/eventDates.js";

// The F3 cards (tests/F3): real Express app and migrated Postgres, with JWT verification and each
// module's identity lookup replaced. FX-F3's reservation is made through Q1's real route and its
// change request through S1's; F3-T7 passes the stored message through the notification service's rule.
vi.mock("../../../src/shared/auth/verifyJwt.js", () => ({
  verifyJwt: (req: { auth?: { supabaseUserId?: string } }, _res: unknown, next: () => void) => {
    req.auth = { supabaseUserId: "f3-card-subject" };
    next();
  },
}));
vi.mock("../../../src/modules/change/auth/identity.js", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  resolveCurrentUser: vi.fn(),
}));
vi.mock("../../../src/modules/equipment/auth/identity.js", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  resolveCurrentUser: vi.fn(),
}));
vi.mock("../../../src/modules/venue/auth/identity.js", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  resolveCurrentUser: vi.fn(),
}));
vi.mock("../../../src/modules/event/auth/identity.js", async () => {
  const actual = await vi.importActual<typeof import("../../../src/modules/event/auth/identity.js")>(
    "../../../src/modules/event/auth/identity.js",
  );
  return { ...actual, resolveCurrentUser: vi.fn(), resolveEventsScope: vi.fn() };
});

const { resolveCurrentUser: resolveChangeUser } = await import("../../../src/modules/change/auth/identity.js");
const { resolveCurrentUser: resolveEquipmentUser } = await import("../../../src/modules/equipment/auth/identity.js");
const { resolveCurrentUser: resolveVenueUser } = await import("../../../src/modules/venue/auth/identity.js");
const { resolveCurrentUser: resolveEventUser, resolveEventsScope } = await import("../../../src/modules/event/auth/identity.js");
const { app } = await import("../../../src/app.js");

const sql = testDb();
const A = { ...actorsWithPrefix("0f300000"), org2: "0f300000-0000-4000-8000-000000000007" };
const bearer = { Authorization: "Bearer f3-card-token" };

type Role = "EVENT_COORDINATOR" | "TECH_SUPPORT_STAFF" | "EVENT_ORGANISER" | "VENUE_STAFF";
function signedInAs(userId: string, role: Role) {
  const user = { id: userId, email: "f3@connectsphere.test", role };
  for (const resolve of [resolveChangeUser, resolveEquipmentUser, resolveVenueUser, resolveEventUser]) {
    vi.mocked(resolve).mockResolvedValue(user);
  }
  vi.mocked(resolveEventsScope).mockResolvedValue(
    role === "EVENT_ORGANISER" ? { scopeType: "OWNED_BY_USER", userId } : { scopeType: "ALL" },
  );
}
const asOrg = () => signedInAs(A.org, "EVENT_ORGANISER");
const asC1 = () => signedInAs(A.c1, "EVENT_COORDINATOR");

const cancel = (eventId: string, body: unknown = { reason: "The speaker withdrew." }) =>
  request(app).post(`/api/v1/events/${eventId}/cancellation`).set(bearer).send(body as object);

// ---------------------------------------------------------------------------------------------
// FX-F3 (tests/F3/README.md)
// ---------------------------------------------------------------------------------------------

async function newVenue(name: string) {
  const [row] = await sql<{ id: string }[]>`
    insert into venue.venues (name, building, max_capacity, layouts, operating_hours, created_by, updated_by)
    values (${name}, 'F3 Test Building', 200, ${sql.json([{ name: "Theatre", capacity: 200 }])}, ${sql.json({})}, ${A.vs}, ${A.vs})
    returning id
  `;
  await sql`insert into venue.venue_staff (venue_id, user_id, created_by, updated_by) values (${row!.id}, ${A.vs}, ${A.vs}, ${A.vs})`;
  return { id: row!.id, name };
}

/** An event owned by O and assigned to C, in `status`, with nothing booked or reserved. */
async function bareEvent(status: EventStatus, name = "F3 fixture event") {
  const id = await seedEvent(sql, { ownerId: A.org, status, endsAt: new Date(EVENT_END), name });
  await sql`update event.events set equipment_required = true where id = ${id}`;
  await sql`insert into event.assignments (event_id, coordinator_id, assignment_rule) values (${id}, ${A.c1}, 'TEST_FIXTURE')`;
  const [row] = await sql<{ reference: string }[]>`select reference from event.events where id = ${id}`;
  return { id, reference: row!.reference, name };
}

/** E in Planning with B1 confirmed at V1, R1 reserved by T through Q1, a second Confirmed line L2, and O's pending CR. */
async function fixture() {
  const event = await bareEvent("PLANNING");
  const tag = randomUUID().slice(0, 8);
  const v1 = await newVenue(`F3 Hall ${tag}`);
  const reference = `BKR-${String(Math.floor(Math.random() * 900_000) + 100_000)}`;
  const [b1] = await sql<{ id: string }[]>`
    insert into venue.venue_slots (venue_id, event_id, reference, starts_at, ends_at, status, created_by, updated_by)
    values (${v1.id}, ${event.id}, ${reference}, ${EVENT_START}, ${EVENT_END}, 'CONFIRMED', ${A.vs}, ${A.vs})
    returning id
  `;
  const chairs = await createBulkType(sql, A.ts, `F3 Chairs ${tag}`, 10);
  const l1 = await insertLineDirect(sql, { event, equipmentTypeId: chairs.id, requestedBy: A.c1, status: "CONFIRMED", quantity: 5 });
  const l2 = await insertLineDirect(sql, { event, equipmentTypeId: chairs.id, requestedBy: A.c1, status: "CONFIRMED", quantity: 2 });
  signedInAs(A.ts, "TECH_SUPPORT_STAFF");
  expect((await request(app).post(`/api/v1/equipment/request-lines/${l1}/reservation`).set(bearer).send({})).status).toBe(201);

  asOrg();
  const raised = await request(app)
    .post(`/api/v1/events/${event.id}/change-requests`)
    .set(bearer)
    .send({ reason: "More guests", changes: { expectedAttendance: 160 } });
  expect(raised.status).toBe(201);
  return { event, v1, b1: { id: b1!.id, reference }, chairs, l1, l2, cr: raised.body.id as string };
}

/** Everything a refusal must leave as it was: the event, its history, slots, lines, reservations, requests and messages. */
async function state(eventId: string) {
  const [event] = await sql`
    select status, version, cancellation_reason, cancelled_by, cancelled_at from event.events where id = ${eventId}
  `;
  const [history] = await sql`select count(*)::int as n from event.event_history where event_id = ${eventId}`;
  const slots = await sql`select id, status from venue.venue_slots where event_id = ${eventId} order by id`;
  const lines = await sql`select id, status from equipment.equipment_request_lines where event_id = ${eventId} order by id`;
  const reservations = await sql`select id, status from equipment.reservations where event_id = ${eventId} order by id`;
  const requests = await sql`select id, status, closed_reason from change.change_requests where event_id = ${eventId} order by id`;
  const [outbox] = await sql`select count(*)::int as n from event.outbox where message_key = ${eventId}`;
  return { event, history: history!.n, slots, lines, reservations, requests, outbox: outbox!.n };
}

async function clean() {
  const events = sql`select id from event.events where owner_id in ${sql([A.org, A.org2])}`;
  const requests = sql`select id from change.change_requests where event_id in (${events})`;
  await sql`delete from change.outbox where message_key in (select id::text from (${events}) e)`;
  await sql`delete from change.change_request_fields where request_id in (${requests})`;
  await sql`delete from change.change_requests where event_id in (${events})`;
  const venues = sql`select id from venue.venues where created_by = ${A.vs}`;
  await sql`delete from venue.holds where venue_id in (${venues})`;
  await sql`delete from venue.booking_requests where venue_id in (${venues})`;
  await sql`delete from venue.venue_slots where venue_id in (${venues})`;
  await sql`delete from venue.venue_staff where venue_id in (${venues})`;
  await sql`delete from venue.venues where created_by = ${A.vs}`;
  await cleanLineFixtures(sql, [A.org, A.org2], [A.ts]);
}

beforeAll(clean);
beforeEach(async () => {
  await clean();
  asOrg();
});
afterAll(async () => {
  await clean();
  await sql.end();
});

// ---------------------------------------------------------------------------------------------

describe("F3 cards (tests/F3)", () => {
  it("F3-T1 the owner cancels with a reason: Cancelled, with the reason, user and time recorded, and a history entry", async () => {
    const { event } = await fixture();
    const response = await cancel(event.id, { reason: "  The speaker withdrew.  " });

    expect(response.status).toBe(200);
    expect(response.body.event).toMatchObject({
      id: event.id,
      reference: event.reference,
      status: "CANCELLED",
      previousStatus: "PLANNING",
      cancellationReason: "The speaker withdrew.",
      cancelledBy: A.org,
    });
    const stored = (await state(event.id)).event!;
    expect(stored).toMatchObject({ status: "CANCELLED", cancellation_reason: "The speaker withdrew.", cancelled_by: A.org });
    expect((stored.cancelled_at as Date).toISOString()).toBe(response.body.event.cancelledAt);

    const [entry] = await sql`
      select previous_status, new_status, actor_user_id, actor_role, triggering_action from event.event_history
      where event_id = ${event.id} and entry_type = 'STATUS_CHANGE' order by occurred_at desc limit 1
    `;
    expect(entry).toEqual({
      previous_status: "PLANNING",
      new_status: "CANCELLED",
      actor_user_id: A.org,
      actor_role: "EVENT_ORGANISER",
      triggering_action: "CANCEL",
    });
  });

  it("F3-T2 the assigned coordinator may cancel; another coordinator gets 403 and another organiser 404, changing nothing", async () => {
    const { event } = await fixture();
    const before = await state(event.id);

    signedInAs(A.c2, "EVENT_COORDINATOR");
    const unassigned = await cancel(event.id);
    expect(unassigned.status).toBe(403);
    expect(unassigned.body.error).toMatchObject({
      code: "ROLE_NOT_AUTHORISED",
      message: "Only the event's owner or its assigned coordinator can cancel it.",
    });
    signedInAs(A.org2, "EVENT_ORGANISER");
    const stranger = await cancel(event.id);
    expect(stranger.status).toBe(404);
    expect(stranger.body.error.code).toBe("EVENT_NOT_FOUND");
    signedInAs(A.ts, "TECH_SUPPORT_STAFF");
    expect((await cancel(event.id)).status).toBe(403);
    expect(await state(event.id)).toEqual(before);

    asC1();
    const assigned = await cancel(event.id);
    expect(assigned.status).toBe(200);
    expect(assigned.body.event).toMatchObject({ status: "CANCELLED", cancelledBy: A.c1 });
  });

  it("F3-T3 cancels from any status before Completed, Rejected or Cancelled, and refuses those three, changing nothing", async () => {
    const allowed: EventStatus[] = ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "AWAITING_CLARIFICATION", "APPROVED", "PLANNING", "SAFETY_REVIEW", "CONFIRMED"];
    for (const status of allowed) {
      const event = await bareEvent(status, `F3-T3 ${status}`);
      const response = await cancel(event.id);
      expect(response.status, status).toBe(200);
      expect(response.body.event, status).toMatchObject({ status: "CANCELLED", previousStatus: status });
    }

    const cancelled = await bareEvent("PLANNING", "F3-T3 already cancelled");
    expect((await cancel(cancelled.id)).status).toBe(200);
    const refused: EventStatus[] = ["COMPLETED", "REJECTED"];
    const ids = [...(await Promise.all(refused.map((status) => bareEvent(status, `F3-T3 ${status}`)))).map((e) => e.id), cancelled.id];
    for (const [index, id] of ids.entries()) {
      const status = [...refused, "CANCELLED" as const][index]!;
      const before = await state(id);
      const response = await cancel(id);
      expect(response.status, status).toBe(409);
      expect(response.body.error, status).toMatchObject({
        code: "STATUS_TRANSITION_NOT_PERMITTED",
        message: `This event is ${EVENT_STATUS_LABELS[status]} and cannot move to Cancelled.`,
      });
      expect(await state(id), status).toEqual(before);
    }
  });

  it("F3-T4 without a reason, or with a blank one, nothing changes", async () => {
    const { event } = await fixture();
    const before = await state(event.id);
    for (const body of [{}, { reason: "" }, { reason: "   " }]) {
      const response = await cancel(event.id, body);
      expect(response.status).toBe(400);
      expect(response.body.error).toMatchObject({
        code: "VALIDATION_FAILED",
        fields: [{ field: "reason", message: "Give a reason for cancelling the event." }],
      });
    }
    expect(await state(event.id)).toEqual(before);
    expect(before.event!.status).toBe("PLANNING");
  });

  it("F3-T5 the cancelled event stays visible to the owner and the coordinator, with its reason and date", async () => {
    const { event } = await fixture();
    const cancelled = await cancel(event.id);
    expect(cancelled.status).toBe(200);
    for (const signIn of [asOrg, asC1]) {
      signIn();
      const response = await request(app).get(`/api/v1/events/${event.id}`).set(bearer);
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: "CANCELLED",
        cancellationReason: "The speaker withdrew.",
        cancelledBy: A.org,
        cancelledAt: cancelled.body.event.cancelledAt,
      });
    }
  });

  it("F3-T6 a cancelled event refuses an edit, a change request, a venue request, a hold, equipment lines and a reservation", async () => {
    const { event, v1, chairs, l2 } = await fixture();
    expect((await cancel(event.id)).status).toBe(200);
    const before = await state(event.id);

    const version = (before.event!.version as number).toString();
    const edit = await request(app).patch(`/api/v1/events/${event.id}`).set(bearer).set("If-Match", `"${version}"`).send({ purpose: "Too late" });
    expect(edit.status).toBe(409);
    expect(edit.body.error.code).toBe("EVENT_NOT_EDITABLE");

    const change = await request(app)
      .post(`/api/v1/events/${event.id}/change-requests`)
      .set(bearer)
      .send({ reason: "x", changes: { expectedAttendance: 170 } });
    expect(change.status).toBe(409);
    expect(change.body.error.code).toBe("EVENT_NOT_CHANGEABLE");

    asC1();
    const period = { startsAt: EVENT_START, endsAt: EVENT_END };
    const venueRequest = await request(app)
      .post("/api/v1/booking-requests")
      .set(bearer)
      .send({ eventId: event.id, venueId: v1.id, ...period, layout: "Theatre", expectedAttendance: 150, facilities: [], accessibilityFeatures: [] });
    expect(venueRequest.status).toBe(409);
    expect(venueRequest.body.error.code).toBe("EVENT_NOT_BOOKABLE");

    const hold = await request(app).post("/api/v1/holds").set(bearer).send({ eventId: event.id, venueId: v1.id, ...period, reminderLeadMinutes: 1440 });
    expect(hold.status).toBe(409);
    expect(hold.body.error.code).toBe("EVENT_NOT_HOLDABLE");

    const lines = await request(app)
      .post("/api/v1/equipment/request-lines")
      .set(bearer)
      .send({ eventId: event.id, lines: [{ equipmentTypeId: chairs.id, quantity: 1, notes: "" }] });
    expect(lines.status).toBe(409);
    expect(lines.body.error).toMatchObject({
      code: "EVENT_CANCELLED",
      message: "This event has been cancelled, so no equipment can be requested or reserved for it.",
    });

    signedInAs(A.ts, "TECH_SUPPORT_STAFF");
    const reservation = await request(app).post(`/api/v1/equipment/request-lines/${l2}/reservation`).set(bearer).send({});
    expect(reservation.status).toBe(409);
    expect(reservation.body.error.code).toBe("EVENT_CANCELLED");

    expect(await state(event.id)).toEqual(before);
  });

  it("F3-T7 one event.cancelled message; the owner, the coordinator, the venue's staff and the reserver each get one notice", async () => {
    const { event, b1, v1 } = await fixture();
    expect((await cancel(event.id)).status).toBe(200);

    const rows = await sql`
      select topic, envelope from event.outbox
      where message_key = ${event.id} and envelope->>'type' = 'event.cancelled' order by seq
    `;
    expect(rows).toHaveLength(1);
    expect(rows[0]!.topic).toBe(KAFKA_TOPICS.event);
    const message = parseCloudEvent(rows[0]!.envelope);
    expect(message.data).toMatchObject({
      eventId: event.id,
      ownerId: A.org,
      assignedCoordinatorId: A.c1,
      reason: "The speaker withdrew.",
      cancelledBy: A.org,
      bookings: [{ reference: b1.reference, venueName: v1.name, staffIds: [A.vs] }],
      reservations: [{ reservedQuantity: 5, reservedBy: A.ts }],
    });

    const notices = notificationsFor({ id: message.id, type: message.type, time: message.time, subject: event.id, data: message.data as Record<string, unknown> });
    expect(notices.map((notice) => notice.recipientUserId)).toEqual([A.org, A.c1, A.vs, A.ts]);
  });

  it("F3-T8 the pending change request is Closed because the event was cancelled, and can no longer be decided", async () => {
    const { event, cr } = await fixture();
    const response = await cancel(event.id);
    expect(response.status).toBe(200);
    expect(response.body.closedChangeRequest).toMatchObject({
      id: cr,
      status: "CLOSED",
      closedReason: "The event was cancelled.",
      decidedBy: A.org,
      rejectionReason: null,
    });

    asC1();
    const decision = await request(app).post(`/api/v1/change-requests/${cr}/decision`).set(bearer).send({ decision: "APPROVE" });
    expect(decision.status).toBe(409);
    expect(decision.body.error).toMatchObject({
      code: "CHANGE_REQUEST_ALREADY_DECIDED",
      message: `This change request was closed on ${response.body.closedChangeRequest.decidedAt} because the event was cancelled.`,
      details: { status: "CLOSED" },
    });
  });
});
