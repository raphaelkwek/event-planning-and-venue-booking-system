import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { KAFKA_TOPICS, parseCloudEvent, type EventStatus } from "@connectsphere/contracts";
import { notificationsFor } from "../../../../notification/src/domain/recipients.js";
import { testDb } from "../../support/testDb.js";
import { actorsWithPrefix, cleanLineFixtures, createBulkType, insertLineDirect } from "../../support/lineFixtures.js";
import { seedEvent, setStatusDirect } from "../../support/seedEvent.js";
import { EVENT_END, EVENT_START } from "../../support/eventDates.js";
import { disruptedBy, flagDisruptions, insertBlock } from "../../../src/modules/venue/repo/unavailability.js";

// The F5 cards (tests/F5): real Express app and migrated Postgres, with JWT verification and the
// identity lookups replaced. FX-F5's reservation is made through Q1's real route, and F5-T17's
// release through Q2's. F5-T18 makes the venue or equipment module's read fail; F5-T19 passes the
// stored message through the notification service's recipient rule.
vi.mock("../../../src/shared/auth/verifyJwt.js", () => ({
  verifyJwt: (req: { auth?: { supabaseUserId?: string } }, _res: unknown, next: () => void) => {
    req.auth = { supabaseUserId: "f5-card-subject" };
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
vi.mock("../../../src/modules/venue/index.js", async () => {
  const actual = await vi.importActual<typeof import("../../../src/modules/venue/index.js")>("../../../src/modules/venue/index.js");
  return { ...actual, venueArrangementsForEvent: vi.fn(actual.venueArrangementsForEvent) };
});
vi.mock("../../../src/modules/equipment/index.js", async () => {
  const actual = await vi.importActual<typeof import("../../../src/modules/equipment/index.js")>(
    "../../../src/modules/equipment/index.js",
  );
  return { ...actual, equipmentArrangementsForEvent: vi.fn(actual.equipmentArrangementsForEvent) };
});

const { resolveCurrentUser: resolveChangeUser } = await import("../../../src/modules/change/auth/identity.js");
const { resolveCurrentUser: resolveEquipmentUser } = await import("../../../src/modules/equipment/auth/identity.js");
const { venueArrangementsForEvent } = await import("../../../src/modules/venue/index.js");
const { equipmentArrangementsForEvent } = await import("../../../src/modules/equipment/index.js");
const { app } = await import("../../../src/app.js");

const sql = testDb();
const A = { ...actorsWithPrefix("0f500000"), vs2: "0f500000-0000-4000-8000-000000000007" };
const bearer = { Authorization: "Bearer f5-card-token" };

type Role = "EVENT_COORDINATOR" | "TECH_SUPPORT_STAFF" | "EVENT_ORGANISER" | "VENUE_STAFF" | "ATTENDEE";
function signedInAs(userId: string, role: Role) {
  const user = { id: userId, email: "f5@connectsphere.test", role };
  vi.mocked(resolveChangeUser).mockResolvedValue(user);
  vi.mocked(resolveEquipmentUser).mockResolvedValue(user);
}
const asC1 = () => signedInAs(A.c1, "EVENT_COORDINATOR");
const asTs = () => signedInAs(A.ts, "TECH_SUPPORT_STAFF");

const confirm = (eventId: string) => request(app).post(`/api/v1/events/${eventId}/confirmation`).set(bearer).send();

// ---------------------------------------------------------------------------------------------
// FX-F5 (tests/F5/README.md)
// ---------------------------------------------------------------------------------------------

interface Fixture {
  event: { id: string; reference: string; name: string };
  v1: { id: string; name: string };
  v2: { id: string; name: string };
  chairs: { id: string; name: string };
  b1: { id: string; reference: string } | null;
  l1: string | null;
}

async function newVenue(name: string, staffId: string) {
  const [row] = await sql<{ id: string }[]>`
    insert into venue.venues (name, building, max_capacity, layouts, operating_hours, created_by, updated_by)
    values (${name}, 'F5 Test Building', 200, ${sql.json([{ name: "Theatre", capacity: 200 }])}, ${sql.json({})}, ${A.vs}, ${A.vs})
    returning id
  `;
  await sql`insert into venue.venue_staff (venue_id, user_id, created_by, updated_by) values (${row!.id}, ${staffId}, ${A.vs}, ${A.vs})`;
  return { id: row!.id, name };
}

const bookingReference = () => `BKR-${String(Math.floor(Math.random() * 900_000) + 100_000)}`;

async function slot(venueId: string, eventId: string, status: "HELD" | "CONFIRMED") {
  const reference = status === "HELD" ? `HLD-${randomUUID().slice(0, 8)}` : bookingReference();
  const [row] = await sql<{ id: string }[]>`
    insert into venue.venue_slots (venue_id, event_id, reference, starts_at, ends_at, status, created_by, updated_by)
    values (${venueId}, ${eventId}, ${reference}, ${EVENT_START}, ${EVENT_END}, ${status}, ${A.vs}, ${A.vs})
    returning id
  `;
  return { id: row!.id, reference };
}

async function pendingRequest(venueId: string, eventId: string) {
  const [row] = await sql<{ id: string; reference: string }[]>`
    insert into venue.booking_requests (
      event_id, venue_id, starts_at, ends_at, layout, expected_attendance, event_starts_at, event_ends_at,
      event_attendance, differs_from_event, requested_by, created_by, updated_by
    ) values (
      ${eventId}, ${venueId}, ${EVENT_START}, ${EVENT_END}, 'Theatre', 150, ${EVENT_START}, ${EVENT_END}, 150, false,
      ${A.c1}, ${A.c1}, ${A.c1}
    )
    returning id, reference
  `;
  return row!;
}

/** TS reserves the line through Q1's route: in full, or `quantity` as a confirmed partial reservation. */
async function reserve(lineId: string, quantity?: number) {
  asTs();
  const body = quantity === undefined ? {} : { quantity, partial: true };
  const response = await request(app).post(`/api/v1/equipment/request-lines/${lineId}/reservation`).set(bearer).send(body);
  expect(response.status).toBe(201);
  asC1();
}

async function fixture(options: {
  status?: EventStatus;
  equipmentRequired?: boolean;
  booking?: "CONFIRMED" | "HELD" | "NONE";
  line?: "FULL" | "PARTIAL" | "CONFIRMED" | "NONE";
} = {}): Promise<Fixture> {
  const name = "F5 fixture event";
  const id = await seedEvent(sql, { ownerId: A.org, status: options.status ?? "APPROVED", endsAt: new Date(EVENT_END), name });
  await sql`update event.events set equipment_required = ${options.equipmentRequired ?? true} where id = ${id}`;
  await sql`insert into event.assignments (event_id, coordinator_id, assignment_rule) values (${id}, ${A.c1}, 'TEST_FIXTURE')`;
  const [row] = await sql<{ reference: string }[]>`select reference from event.events where id = ${id}`;
  const event = { id, reference: row!.reference, name };

  const tag = randomUUID().slice(0, 8);
  const v1 = await newVenue(`F5 Hall ${tag}`, A.vs);
  const v2 = await newVenue(`F5 Breakout Room ${tag}`, A.vs2);
  const chairs = await createBulkType(sql, A.ts, `F5 Chairs ${tag}`, 10);

  const booking = options.booking ?? "CONFIRMED";
  const b1 = booking === "NONE" ? null : await slot(v1.id, id, booking);

  const lineKind = options.line ?? "FULL";
  let l1: string | null = null;
  if (lineKind !== "NONE") {
    l1 = await insertLineDirect(sql, { event, equipmentTypeId: chairs.id, requestedBy: A.c1, status: "CONFIRMED", quantity: 5 });
    if (lineKind === "FULL") await reserve(l1);
    if (lineKind === "PARTIAL") await reserve(l1, 4);
  }
  asC1();
  return { event, v1, v2, chairs, b1, l1 };
}

/** Everything a refusal must leave as it was (AC10): status, history, slots, requests, lines, reservations, outbox. */
async function state(eventId: string) {
  const [event] = await sql`select status, version from event.events where id = ${eventId}`;
  const [history] = await sql`select count(*)::int as n from event.event_history where event_id = ${eventId}`;
  const slots = await sql`select id, status, requires_reconfirmation from venue.venue_slots where event_id = ${eventId} order by id`;
  const requests = await sql`select id, status from venue.booking_requests where event_id = ${eventId} order by id`;
  const lines = await sql`select id, status from equipment.equipment_request_lines where event_id = ${eventId} order by id`;
  const reservations = await sql`
    select id, status, reserved_quantity from equipment.reservations where event_id = ${eventId} order by id
  `;
  const [outbox] = await sql`select count(*)::int as n from event.outbox where message_key = ${eventId}`;
  return { event, history: history!.n, slots, requests, lines, reservations, outbox: outbox!.n };
}

async function refusedLeavingNothing(eventId: string, status: number, code: string) {
  const before = await state(eventId);
  const response = await confirm(eventId);
  expect(response.status).toBe(status);
  expect(response.body.error.code).toBe(code);
  expect(await state(eventId)).toEqual(before);
  return response;
}

async function latestHistory(eventId: string) {
  const [row] = await sql`
    select previous_status, new_status, actor_user_id, actor_role, triggering_action, occurred_at
    from event.event_history where event_id = ${eventId} and entry_type = 'STATUS_CHANGE'
    order by occurred_at desc limit 1
  `;
  return row!;
}

async function clean() {
  const venues = sql`select id from venue.venues where created_by = ${A.vs}`;
  await sql`delete from venue.block_disruptions where block_id in (select id from venue.unavailability_blocks where venue_id in (${venues}))`;
  await sql`delete from venue.unavailability_blocks where venue_id in (${venues})`;
  await sql`delete from venue.booking_requests where venue_id in (${venues})`;
  await sql`delete from venue.venue_slots where venue_id in (${venues})`;
  await sql`delete from venue.venue_staff where venue_id in (${venues})`;
  await sql`delete from venue.venues where created_by = ${A.vs}`;
  await cleanLineFixtures(sql, [A.org], [A.ts]);
}

beforeAll(clean);
beforeEach(async () => {
  await clean();
  vi.mocked(venueArrangementsForEvent).mockClear();
  vi.mocked(equipmentArrangementsForEvent).mockClear();
  asC1();
});
afterAll(async () => {
  await clean();
  await sql.end();
});

// ---------------------------------------------------------------------------------------------

describe("F5 cards (tests/F5)", () => {
  it("F5-T1 the assigned coordinator confirms an Approved event into Safety Review, with a history entry", async () => {
    const { event, b1 } = await fixture();
    const response = await confirm(event.id);

    expect(response.status).toBe(200);
    expect(response.body.event).toMatchObject({ id: event.id, status: "SAFETY_REVIEW", previousStatus: "APPROVED", confirmedBy: A.c1 });
    expect(Date.parse(response.body.event.confirmedAt)).not.toBeNaN();
    const after = await state(event.id);
    expect(after.event!.status).toBe("SAFETY_REVIEW");
    const entry = await latestHistory(event.id);
    expect(entry).toMatchObject({
      previous_status: "APPROVED",
      new_status: "SAFETY_REVIEW",
      actor_user_id: A.c1,
      actor_role: "EVENT_COORDINATOR",
      triggering_action: "CONFIRM_ARRANGEMENTS",
    });
    expect((entry.occurred_at as Date).toISOString()).toBe(response.body.event.confirmedAt);
    expect(after.slots).toEqual([{ id: b1!.id, status: "CONFIRMED", requires_reconfirmation: false }]);
    expect(after.reservations).toEqual([expect.objectContaining({ status: "RESERVED", reserved_quantity: 5 })]);
  });

  it("F5-T2 confirms from Planning too", async () => {
    const { event } = await fixture({ status: "PLANNING" });
    const response = await confirm(event.id);
    expect(response.status).toBe(200);
    expect(response.body.event.previousStatus).toBe("PLANNING");
    expect(await latestHistory(event.id)).toMatchObject({ previous_status: "PLANNING", new_status: "SAFETY_REVIEW", triggering_action: "CONFIRM_ARRANGEMENTS" });
  });

  it("F5-T3 an event marked as needing no equipment is complete without any line", async () => {
    const { event } = await fixture({ equipmentRequired: false, line: "NONE" });
    const response = await confirm(event.id);
    expect(response.status).toBe(200);
    expect(response.body.event.status).toBe("SAFETY_REVIEW");
  });

  it("F5-T4 every status but Approved and Planning is refused, naming it and Safety Review", async () => {
    // A Draft is private to its organiser (C1, A3): a coordinator gets 404 for it, never a 409
    // that would reveal it exists. E1 assigns a coordinator only on submission, so a Draft has none.
    await fixture();
    const [draft] = await sql<{ id: string }[]>`select id from event.events where owner_id = ${A.org}`;
    await sql`update event.events set status = 'DRAFT' where id = ${draft!.id}`;
    const hidden = await refusedLeavingNothing(draft!.id, 404, "EVENT_NOT_FOUND");
    expect(hidden.body.error.message).toBe("No event with that reference is available to you.");

    const labels: [EventStatus, string][] = [
      ["SUBMITTED", "Submitted"],
      ["UNDER_REVIEW", "Under Review"],
      ["AWAITING_CLARIFICATION", "Awaiting Clarification"],
      ["SAFETY_REVIEW", "Safety Review"],
      ["CONFIRMED", "Confirmed"],
      ["COMPLETED", "Completed"],
      ["CANCELLED", "Cancelled"],
      ["REJECTED", "Rejected"],
    ];
    for (const [status, label] of labels) {
      await clean();
      // Built Approved, so Q1's route can reserve the line, then moved to the status under test
      // directly: most of these statuses can't be reached through a story yet, or not from Approved.
      const { event } = await fixture();
      await setStatusDirect(sql, event.id, status);
      const response = await refusedLeavingNothing(event.id, 409, "STATUS_TRANSITION_NOT_PERMITTED");
      expect(response.body.error.message).toBe(`This event is ${label} and cannot move to Safety Review.`);
    }
  });

  it("F5-T5 only the assigned coordinator can confirm; an unknown event is not revealed", async () => {
    const { event } = await fixture();
    signedInAs(A.c2, "EVENT_COORDINATOR");
    const notAssigned = await refusedLeavingNothing(event.id, 403, "ROLE_NOT_AUTHORISED");
    expect(notAssigned.body.error.message).toBe("Only the event's assigned coordinator can confirm its arrangements.");
    for (const [userId, role] of [
      [A.org, "EVENT_ORGANISER"],
      [A.vs, "VENUE_STAFF"],
      [A.ts, "TECH_SUPPORT_STAFF"],
      [A.att, "ATTENDEE"],
    ] as const) {
      signedInAs(userId, role);
      await refusedLeavingNothing(event.id, 403, "ROLE_NOT_AUTHORISED");
    }
    asC1();
    const unknown = await confirm(randomUUID());
    expect(unknown.status).toBe(404);
    expect(unknown.body.error.code).toBe("EVENT_NOT_FOUND");
    expect((await confirm("not-a-uuid")).status).toBe(404);
  });

  it("F5-T6 no venue booking at all is refused, naming the venue as outstanding", async () => {
    const { event } = await fixture({ booking: "NONE" });
    const response = await refusedLeavingNothing(event.id, 422, "ARRANGEMENTS_NOT_READY");
    expect(response.body.error.message).toBe("This event can't be confirmed yet. Venue: no venue booking is confirmed.");
    expect(response.body.error.details).toEqual({ venue: [{ kind: "NO_CONFIRMED_BOOKING" }], equipment: [], flags: [] });
  });

  it("F5-T7 a tentative hold alone is not sufficient", async () => {
    const { event, b1, v1 } = await fixture({ booking: "HELD" });
    const response = await refusedLeavingNothing(event.id, 422, "ARRANGEMENTS_NOT_READY");
    expect(response.body.error.message).toBe(
      `This event can't be confirmed yet. Venue: no venue booking is confirmed; hold ${b1!.reference} at ${v1.name} is only a tentative hold.`,
    );
    expect((await state(event.id)).slots).toEqual([{ id: b1!.id, status: "HELD", requires_reconfirmation: false }]);
  });

  it("F5-T8 one confirmed booking is not enough while another is pending (L4, CQ-05 as AC2 reads)", async () => {
    const { event, b1, v2 } = await fixture();
    const r2 = await pendingRequest(v2.id, event.id);
    const response = await refusedLeavingNothing(event.id, 422, "ARRANGEMENTS_NOT_READY");
    expect(response.body.error.message).toBe(
      `This event can't be confirmed yet. Venue: booking request ${r2.reference} at ${v2.name} is still pending.`,
    );
    expect(response.body.error.message).not.toContain(b1!.reference);
    expect((await state(event.id)).requests).toEqual([{ id: r2.id, status: "PENDING" }]);
  });

  it("F5-T9 two confirmed bookings at two venues pass (L4)", async () => {
    const { event, b1, v2 } = await fixture();
    const b2 = await slot(v2.id, event.id, "CONFIRMED");
    const response = await confirm(event.id);
    expect(response.status).toBe(200);
    expect((await state(event.id)).slots).toEqual(
      [b1!.id, b2.id].sort().map((id) => ({ id, status: "CONFIRMED", requires_reconfirmation: false })),
    );
  });

  it("F5-T10 a line reserved 4 of 5 is not reserved in full (just below)", async () => {
    const { event, l1, chairs } = await fixture({ line: "PARTIAL" });
    const response = await refusedLeavingNothing(event.id, 422, "ARRANGEMENTS_NOT_READY");
    expect(response.body.error.message).toBe(`This event can't be confirmed yet. Equipment: ${chairs.name} × 5 has 4 of 5 reserved.`);
    expect(response.body.error.details.equipment).toEqual([
      { kind: "LINE", lineId: l1, equipmentTypeName: chairs.name, quantity: 5, status: "RESERVED", requestedQuantity: 5, reservedQuantity: 4 },
    ]);
    expect((await state(event.id)).reservations).toEqual([expect.objectContaining({ status: "RESERVED", reserved_quantity: 4 })]);
  });

  it("F5-T11 a line reserved exactly 5 of 5 is reserved in full (exactly at)", async () => {
    const { event } = await fixture({ line: "FULL" });
    const response = await confirm(event.id);
    expect(response.status).toBe(200);
  });

  it("F5-T12 every line not reserved in full is named, and a line reserved in full is not", async () => {
    const { event, chairs } = await fixture();
    const l2 = await insertLineDirect(sql, { event, equipmentTypeId: chairs.id, requestedBy: A.c1, status: "SUBMITTED", quantity: 2 });
    const l3 = await insertLineDirect(sql, { event, equipmentTypeId: chairs.id, requestedBy: A.c1, status: "CONFIRMED", quantity: 3 });
    const response = await refusedLeavingNothing(event.id, 422, "ARRANGEMENTS_NOT_READY");
    expect(response.body.error.message).toBe(
      `This event can't be confirmed yet. Equipment: ${chairs.name} × 2 is Submitted; ${chairs.name} × 3 is Confirmed.`,
    );
    expect(response.body.error.details.equipment.map((item: { lineId: string }) => item.lineId)).toEqual([l2, l3]);
  });

  it("F5-T13 equipment required with no line at all is not complete", async () => {
    const { event } = await fixture({ line: "NONE" });
    const response = await refusedLeavingNothing(event.id, 422, "ARRANGEMENTS_NOT_READY");
    expect(response.body.error.message).toBe(
      "This event can't be confirmed yet. Equipment: no equipment has been requested, and the event is not marked as needing none.",
    );
  });

  it("F5-T14 both arrangements outstanding are named in one refusal", async () => {
    const { event, chairs } = await fixture({ booking: "NONE", line: "CONFIRMED" });
    const response = await refusedLeavingNothing(event.id, 422, "ARRANGEMENTS_NOT_READY");
    expect(response.body.error.message).toBe(
      `This event can't be confirmed yet. Venue: no venue booking is confirmed. Equipment: ${chairs.name} × 5 is Confirmed.`,
    );
  });

  it("F5-T15 a booking flagged Requires Reconfirmation (I2) is refused, naming the flag", async () => {
    const { event, b1, v1 } = await fixture();
    await sql.begin(async (tx) => {
      const block = await insertBlock(tx, {
        venueId: v1.id,
        startsAt: new Date(EVENT_START),
        endsAt: new Date(EVENT_END),
        reasonType: "MAINTENANCE",
        description: "Stage rigging inspection",
        actorUserId: A.vs,
      });
      await flagDisruptions(tx, block.id, await disruptedBy(tx, v1.id, new Date(EVENT_START), new Date(EVENT_END)), A.vs);
    });
    const response = await refusedLeavingNothing(event.id, 422, "ARRANGEMENTS_NOT_READY");
    expect(response.body.error.message).toBe(
      `This event can't be confirmed yet. Outstanding flags: booking ${b1!.reference} at ${v1.name} requires reconfirmation.`,
    );
    expect(response.body.error.details.flags).toEqual([
      { arrangement: "BOOKING", reference: b1!.reference, name: v1.name, flag: "REQUIRES_RECONFIRMATION" },
    ]);
    expect((await state(event.id)).slots).toEqual([{ id: b1!.id, status: "CONFIRMED", requires_reconfirmation: true }]);
  });

  it.skip("F5-T16 a booking flagged unsuitable (S3) is refused — Blocked: S3 stores no unsuitable flag yet", () => {});

  it("F5-T17 readiness is read live: a reservation released just before is seen", async () => {
    const { event, l1, chairs } = await fixture();
    asTs();
    const released = await request(app)
      .post(`/api/v1/equipment/request-lines/${l1}/release`)
      .set(bearer)
      .send({ reason: "Chairs needed elsewhere" });
    expect(released.status).toBe(200);
    asC1();
    const response = await refusedLeavingNothing(event.id, 422, "ARRANGEMENTS_NOT_READY");
    expect(response.body.error.message).toBe(`This event can't be confirmed yet. Equipment: ${chairs.name} × 5 is Confirmed.`);
    expect((await state(event.id)).event!.status).toBe("APPROVED");
  });

  it("F5-T18 if the venue or equipment records cannot be read, the refusal is 503 and nothing changes", async () => {
    const { event } = await fixture();
    const message =
      "The venue and equipment arrangements could not be checked, so the event was not confirmed. Nothing was changed. Try again.";

    vi.mocked(venueArrangementsForEvent).mockRejectedValueOnce(new Error("canceling statement due to statement timeout"));
    const venueDown = await refusedLeavingNothing(event.id, 503, "ARRANGEMENTS_UNAVAILABLE");
    expect(venueDown.body.error.message).toBe(message);

    vi.mocked(equipmentArrangementsForEvent).mockRejectedValueOnce(new Error("Connection terminated unexpectedly"));
    const equipmentDown = await refusedLeavingNothing(event.id, 503, "ARRANGEMENTS_UNAVAILABLE");
    expect(equipmentDown.body.error.message).toBe(message);

    // The same fixture confirms once the reads work again: nothing was left half-done.
    expect((await confirm(event.id)).status).toBe(200);
  });

  it("F5-T19 the organiser, each booked venue's staff and the reserver are each notified once", async () => {
    const { event, b1, v1, v2, chairs } = await fixture();
    const b2 = await slot(v2.id, event.id, "CONFIRMED");
    expect((await confirm(event.id)).status).toBe(200);

    // EN-11 also writes an event.status-changed message for the move to Safety Review, so count F5's own.
    const rows = await sql`
      select topic, message_key, envelope from event.outbox
      where message_key = ${event.id} and envelope->>'type' = 'event.arrangements-confirmed' order by seq
    `;
    expect(rows).toHaveLength(1);
    expect(rows[0]!.topic).toBe(KAFKA_TOPICS.event);
    const message = parseCloudEvent(rows[0]!.envelope);
    expect(message.type).toBe("event.arrangements-confirmed");
    expect(message.subject).toBe(event.id);

    const notifications = notificationsFor(message);
    const byRecipient = new Map(notifications.map((n) => [n.recipientUserId, n.message]));
    expect([...byRecipient.keys()].sort()).toEqual([A.org, A.vs, A.vs2, A.ts].sort());
    expect(notifications).toHaveLength(4);
    expect(byRecipient.get(A.org)).toContain("Safety Review");
    expect(byRecipient.get(A.vs)).toContain(b1!.reference);
    expect(byRecipient.get(A.vs)).toContain(v1.name);
    expect(byRecipient.get(A.vs2)).toContain(b2.reference);
    expect(byRecipient.get(A.vs2)).toContain(v2.name);
    expect(byRecipient.get(A.ts)).toContain(`${chairs.name} × 5`);
    expect(byRecipient.has(A.c2)).toBe(false);
    expect(byRecipient.has(A.att)).toBe(false);
  });

  it("F5-T20 a refused confirmation changes no status, booking or reservation, however often it is sent", async () => {
    const { event } = await fixture({ booking: "HELD", line: "PARTIAL" });
    const before = await state(event.id);
    expect((await confirm(event.id)).status).toBe(422);
    expect((await confirm(event.id)).status).toBe(422);
    expect(await state(event.id)).toEqual(before);
  });
});
