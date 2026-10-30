import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { testDb } from "../../support/testDb.js";
import { actorsWithPrefix, cleanLineFixtures, createBulkType, insertLineDirect } from "../../support/lineFixtures.js";
import { seedEvent } from "../../support/seedEvent.js";
import { EVENT_END, EVENT_START } from "../../support/eventDates.js";

// The F4 cards (tests/F4): real Express app and migrated Postgres, with JWT verification and each
// module's identity lookup replaced. FX-F4's reservations are made through Q1's real route. F4-T4
// makes the equipment module's release fail inside the cancellation.
vi.mock("../../../src/shared/auth/verifyJwt.js", () => ({
  verifyJwt: (req: { auth?: { supabaseUserId?: string } }, _res: unknown, next: () => void) => {
    req.auth = { supabaseUserId: "f4-card-subject" };
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
vi.mock("../../../src/modules/equipment/index.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/modules/equipment/index.js")>();
  return { ...actual, releaseEventReservations: vi.fn(actual.releaseEventReservations) };
});
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
const { releaseEventReservations } = await import("../../../src/modules/equipment/index.js");
const { releaseVenueArrangementsForEvent } = await import("../../../src/modules/venue/index.js");
const { app } = await import("../../../src/app.js");

const sql = testDb();
const A = { ...actorsWithPrefix("0f400000"), org2: "0f400000-0000-4000-8000-000000000007" };
const bearer = { Authorization: "Bearer f4-card-token" };

type Role = "EVENT_COORDINATOR" | "TECH_SUPPORT_STAFF" | "EVENT_ORGANISER" | "VENUE_STAFF";
function signedInAs(userId: string, role: Role) {
  const user = { id: userId, email: "f4@connectsphere.test", role };
  for (const resolve of [resolveChangeUser, resolveEquipmentUser, resolveVenueUser, resolveEventUser]) {
    vi.mocked(resolve).mockResolvedValue(user);
  }
  vi.mocked(resolveEventsScope).mockResolvedValue(
    role === "EVENT_ORGANISER" ? { scopeType: "OWNED_BY_USER", userId } : { scopeType: "ALL" },
  );
}
const asOrg = () => signedInAs(A.org, "EVENT_ORGANISER");

const cancel = (eventId: string, body: unknown = { reason: "The speaker withdrew." }) =>
  request(app).post(`/api/v1/events/${eventId}/cancellation`).set(bearer).send(body as object);

// ---------------------------------------------------------------------------------------------
// FX-F4 (tests/F4/README.md)
// ---------------------------------------------------------------------------------------------

const day = EVENT_START.slice(0, 10);
const at = (time: string) => `${day}T${time}:00.000Z`;
const ref = (prefix: string) => `${prefix}-${randomUUID().slice(0, 8)}`;

async function newVenue(name: string) {
  const [row] = await sql<{ id: string }[]>`
    insert into venue.venues (name, building, max_capacity, layouts, operating_hours, created_by, updated_by)
    values (${name}, 'F4 Test Building', 200, ${sql.json([{ name: "Theatre", capacity: 200 }])}, ${sql.json({})}, ${A.vs}, ${A.vs})
    returning id
  `;
  await sql`insert into venue.venue_staff (venue_id, user_id, created_by, updated_by) values (${row!.id}, ${A.vs}, ${A.vs}, ${A.vs})`;
  return { id: row!.id, name };
}

async function slot(venueId: string, eventId: string, status: "HELD" | "CONFIRMED", reference: string, startsAt = EVENT_START, endsAt = EVENT_END) {
  const [row] = await sql<{ id: string }[]>`
    insert into venue.venue_slots (venue_id, event_id, reference, starts_at, ends_at, status, created_by, updated_by)
    values (${venueId}, ${eventId}, ${reference}, ${startsAt}, ${endsAt}, ${status}, ${A.vs}, ${A.vs})
    returning id
  `;
  return row!.id;
}

/** TS reserves the line in full through Q1's route. */
async function reserve(lineId: string) {
  signedInAs(A.ts, "TECH_SUPPORT_STAFF");
  expect((await request(app).post(`/api/v1/equipment/request-lines/${lineId}/reservation`).set(bearer).send({})).status).toBe(201);
}

/** E in Planning with B1 confirmed at V1, hold H placed at V2, P pending at V1 for 19:00–21:00, and R1 (5) and R2 (3) reserved by T. */
async function fixture() {
  const id = await seedEvent(sql, { ownerId: A.org, status: "PLANNING", endsAt: new Date(EVENT_END), name: "F4 fixture event" });
  await sql`update event.events set equipment_required = true where id = ${id}`;
  await sql`insert into event.assignments (event_id, coordinator_id, assignment_rule) values (${id}, ${A.c1}, 'TEST_FIXTURE')`;
  const [row] = await sql<{ reference: string }[]>`select reference from event.events where id = ${id}`;
  const event = { id, reference: row!.reference, name: "F4 fixture event" };

  const tag = randomUUID().slice(0, 8);
  const v1 = await newVenue(`F4 Hall ${tag}`);
  const v2 = await newVenue(`F4 Breakout Room ${tag}`);
  const b1 = { reference: ref("BKR"), id: "" };
  b1.id = await slot(v1.id, event.id, "CONFIRMED", b1.reference);

  const h = { reference: ref("HLD"), id: "", slotId: "" };
  h.slotId = await slot(v2.id, event.id, "HELD", h.reference);
  const [hold] = await sql<{ id: string }[]>`
    insert into venue.holds (reference, event_id, venue_id, starts_at, ends_at, reminder_lead_minutes, status, requested_by,
                             slot_id, placed_by, placed_at, expires_at, created_by, updated_by)
    values (${h.reference}, ${event.id}, ${v2.id}, ${EVENT_START}, ${EVENT_END}, 1440, 'HELD', ${A.c1},
            ${h.slotId}, ${A.vs}, now(), now() + interval '7 days', ${A.c1}, ${A.c1})
    returning id
  `;
  h.id = hold!.id;

  const [p] = await sql<{ id: string; reference: string }[]>`
    insert into venue.booking_requests (
      event_id, venue_id, starts_at, ends_at, layout, expected_attendance, event_starts_at, event_ends_at,
      event_attendance, differs_from_event, requested_by, created_by, updated_by
    ) values (
      ${event.id}, ${v1.id}, ${at("19:00")}, ${at("21:00")}, 'Theatre', 150, ${EVENT_START}, ${EVENT_END}, 150, true,
      ${A.c1}, ${A.c1}, ${A.c1}
    )
    returning id, reference
  `;

  const chairs = await createBulkType(sql, A.ts, `F4 Chairs ${tag}`, 10);
  const l1 = await insertLineDirect(sql, { event, equipmentTypeId: chairs.id, requestedBy: A.c1, status: "CONFIRMED", quantity: 5 });
  const l2 = await insertLineDirect(sql, { event, equipmentTypeId: chairs.id, requestedBy: A.c1, status: "CONFIRMED", quantity: 3 });
  await reserve(l1);
  await reserve(l2);
  asOrg();
  return { event, v1, v2, b1, h, p: p!, chairs, l1, l2 };
}

/** Every row a cancellation may change, so a failed or repeated one can be compared with what was there before. */
async function state(eventId: string) {
  const [event] = await sql`select status, version, cancellation_reason from event.events where id = ${eventId}`;
  const [history] = await sql`select count(*)::int as n from event.event_history where event_id = ${eventId}`;
  const slots = await sql`select id, status, release_reason, updated_by, updated_at from venue.venue_slots where event_id = ${eventId} order by id`;
  const holds = await sql`select id, status, released_by, released_at from venue.holds where event_id = ${eventId} order by id`;
  const requests = await sql`select id, status, withdrawn_by, withdrawn_at from venue.booking_requests where event_id = ${eventId} order by id`;
  const lines = await sql`select id, status from equipment.equipment_request_lines where event_id = ${eventId} order by id`;
  const reservations = await sql`
    select id, status, reserved_quantity, released_by, released_at, release_reason from equipment.reservations
    where event_id = ${eventId} order by id
  `;
  const bulk = await sql`
    select b.status from equipment.bulk_reservations b join equipment.reservations r on r.id = b.reservation_id
    where r.event_id = ${eventId} order by b.id
  `;
  const [outbox] = await sql`select count(*)::int as n from event.outbox where message_key = ${eventId}`;
  return { event, history: history!.n, slots, holds, requests, lines, reservations, bulk, outbox: outbox!.n };
}

async function clean() {
  const events = sql`select id from event.events where owner_id in ${sql([A.org, A.org2])}`;
  const venues = sql`select id from venue.venues where created_by = ${A.vs}`;
  await sql`delete from venue.holds where venue_id in (${venues})`;
  await sql`delete from venue.booking_requests where venue_id in (${venues})`;
  await sql`delete from venue.venue_slots where venue_id in (${venues})`;
  await sql`delete from venue.venue_staff where venue_id in (${venues})`;
  await sql`delete from venue.venues where created_by = ${A.vs}`;
  await sql`delete from change.outbox where message_key in (select id::text from (${events}) e)`;
  await cleanLineFixtures(sql, [A.org, A.org2], [A.ts]);
}

beforeAll(clean);
beforeEach(async () => {
  await clean();
  vi.mocked(releaseEventReservations).mockClear();
  asOrg();
});
afterAll(async () => {
  await clean();
  await sql.end();
});

// ---------------------------------------------------------------------------------------------

describe("F4 cards (tests/F4)", () => {
  it("F4-T1 cancelling releases the confirmed booking and the hold, and withdraws the pending request", async () => {
    const { event, b1, h, p } = await fixture();
    const response = await cancel(event.id);

    expect(response.status).toBe(200);
    expect(response.body.released).toMatchObject({ bookings: [b1.reference], holds: [h.reference], requests: [p.reference] });
    const after = await state(event.id);
    expect(after.slots.map((s) => [s.id, s.status])).toEqual(
      [[b1.id, "RELEASED"], [h.slotId, "RELEASED"]].sort((a, b) => a[0]!.localeCompare(b[0]!)),
    );
    expect(after.holds).toEqual([expect.objectContaining({ id: h.id, status: "RELEASED", released_by: A.org })]);
    expect(after.requests).toEqual([expect.objectContaining({ id: p.id, status: "WITHDRAWN", withdrawn_by: A.org })]);
  });

  it("F4-T2 the venue's period is free again: I1's calendar no longer shows it, and a new booking for it can be stored", async () => {
    const { event, v1 } = await fixture();
    signedInAs(A.vs, "VENUE_STAFF");
    const next = new Date(Date.parse(`${day}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
    const references = async () => {
      const calendar = await request(app).get(`/api/v1/venues/${v1.id}/availability`).query({ from: day, to: next }).set(bearer);
      expect(calendar.status).toBe(200);
      return (calendar.body.days as { committed: { kind: string; eventReference?: string }[] }[]).flatMap((d) =>
        d.committed.filter((c) => c.kind === "BOOKING").map((c) => c.eventReference),
      );
    };
    expect(await references()).toContain(event.reference);

    asOrg();
    expect((await cancel(event.id)).status).toBe(200);
    signedInAs(A.vs, "VENUE_STAFF");
    expect(await references()).not.toContain(event.reference);

    const other = await seedEvent(sql, { ownerId: A.org2, status: "PLANNING", endsAt: new Date(EVENT_END), name: "F4-T2 next event" });
    await expect(slot(v1.id, other, "CONFIRMED", ref("BKR"))).resolves.toBeTruthy();
  });

  it("F4-T3 both reservations are released, and the whole stock is available for the period again", async () => {
    const { event, chairs } = await fixture();
    const available = async () => {
      signedInAs(A.ts, "TECH_SUPPORT_STAFF");
      const response = await request(app)
        .get(`/api/v1/equipment/types/${chairs.id}/availability`)
        .query({ startsAt: EVENT_START, endsAt: EVENT_END, requestedQuantity: "1" })
        .set(bearer);
      expect(response.status).toBe(200);
      asOrg();
      return response.body.availableQuantity as number;
    };
    expect(await available()).toBe(2);

    const response = await cancel(event.id);
    expect(response.status).toBe(200);
    expect(response.body.released.reservations.map((r: { reservedQuantity: number }) => r.reservedQuantity).sort()).toEqual([3, 5]);
    const after = await state(event.id);
    expect(after.reservations.map((r) => r.status)).toEqual(["RELEASED", "RELEASED"]);
    expect(after.bulk.every((b) => b.status === "RELEASED")).toBe(true);
    expect(await available()).toBe(10);
  });

  it("F4-T4 if a release fails, nothing is cancelled or released and the user is told", async () => {
    const { event } = await fixture();
    const [cr] = await sql<{ id: string }[]>`
      insert into change.change_requests (event_id, event_reference, requested_by, reason, created_by, updated_by)
      values (${event.id}, ${event.reference}, ${A.org}, 'More guests', ${A.org}, ${A.org})
      returning id
    `;
    const before = await state(event.id);
    vi.mocked(releaseEventReservations).mockRejectedValueOnce(new Error("the equipment release failed"));

    const response = await cancel(event.id);
    expect(response.status).toBe(500);
    expect(response.body.error).toMatchObject({
      code: "CANCELLATION_FAILED",
      message: "The event was not cancelled: something went wrong, so nothing was changed. Try again, or contact support if it keeps happening.",
    });
    expect(await state(event.id)).toEqual(before);
    expect(before.event!.status).toBe("PLANNING");
    const [request_] = await sql`select status from change.change_requests where id = ${cr!.id}`;
    expect(request_!.status).toBe("PENDING");
    await sql`delete from change.change_requests where id = ${cr!.id}`;
  });

  it("F4-T5 each released record is kept, with the reason, the user and the time", async () => {
    const { event, b1, h } = await fixture();
    const response = await cancel(event.id);
    expect(response.status).toBe(200);
    const after = await state(event.id);

    const booking = after.slots.find((s) => s.id === b1.id)!;
    expect(booking).toMatchObject({ status: "RELEASED", release_reason: "event cancelled", updated_by: A.org });
    expect(booking.updated_at).toBeInstanceOf(Date);
    expect(after.holds[0]).toMatchObject({ id: h.id, status: "RELEASED", released_by: A.org });
    expect(after.holds[0]!.released_at).toBeInstanceOf(Date);
    for (const reservation of after.reservations) {
      expect(reservation).toMatchObject({ status: "RELEASED", release_reason: "event cancelled", released_by: A.org });
      expect(reservation.released_at).toBeInstanceOf(Date);
    }
    expect(after.slots).toHaveLength(2);
    expect(after.reservations).toHaveLength(2);
  });

  it("F4-T6 releasing again changes nothing, and a second cancellation is refused with nothing changed", async () => {
    const { event } = await fixture();
    expect((await cancel(event.id)).status).toBe(200);
    const once = await state(event.id);

    const again = await sql.begin(async (tx) => ({
      venue: await releaseVenueArrangementsForEvent(tx, event.id, A.c1),
      equipment: await releaseEventReservations(tx, event.id, { userId: A.c1, role: "EVENT_COORDINATOR" }, "event cancelled"),
    }));
    expect(again).toEqual({ venue: { bookings: [], holds: [], requests: [] }, equipment: [] });
    expect(await state(event.id)).toEqual(once);

    const second = await cancel(event.id);
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe("STATUS_TRANSITION_NOT_PERMITTED");
    expect(await state(event.id)).toEqual(once);
  });

  it("F4-T7 no registration is released and no attendee is told, since there is no registration service yet", async () => {
    const { event } = await fixture();
    const response = await cancel(event.id);
    expect(response.status).toBe(200);
    expect(response.body.released.registrations).toBe(0);
  });
});
