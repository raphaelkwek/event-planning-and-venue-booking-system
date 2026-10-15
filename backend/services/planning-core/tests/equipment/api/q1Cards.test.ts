import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { EQUIPMENT_LINE_STATUS_LABELS, parseCloudEvent, type EquipmentRequestLineStatus } from "@connectsphere/contracts";
import { notificationsFor } from "../../../../notification/src/domain/recipients.js";
import { testDb } from "../../support/testDb.js";
import {
  actorsWithPrefix,
  cleanLineFixtures,
  createBulkType,
  createEvent,
  createSerializedType,
  insertLineDirect,
  reserveBulkDirect,
  unknownId,
} from "../../support/lineFixtures.js";
import { EVENT_END, EVENT_START } from "../../support/eventDates.js";

// The Q1 cards (tests/Q1): real Express app and migrated Postgres, with JWT verification and the
// identity lookup replaced. Q1-T10's notification half passes the stored message through the
// notification service's recipient rule. Q1-T13 (the race) is in tests/race/invariants.test.ts;
// Q1-T14 is done by hand in the browser.
vi.mock("../../../src/shared/auth/verifyJwt.js", () => ({
  verifyJwt: (req: { auth?: { supabaseUserId?: string } }, _res: unknown, next: () => void) => {
    req.auth = { supabaseUserId: "q1-card-subject" };
    next();
  },
}));
vi.mock("../../../src/modules/equipment/auth/identity.js", async () => {
  const actual = await vi.importActual<typeof import("../../../src/modules/equipment/auth/identity.js")>(
    "../../../src/modules/equipment/auth/identity.js",
  );
  return { ...actual, resolveCurrentUser: vi.fn() };
});

const { resolveCurrentUser } = await import("../../../src/modules/equipment/auth/identity.js");
const { app } = await import("../../../src/app.js");

const sql = testDb();
const A = actorsWithPrefix("0b600000");
const bearer = { Authorization: "Bearer q1-card-token" };
const BASE = "/api/v1/equipment/request-lines";
const SLACK_MS = 2_000;

type Role = "EVENT_COORDINATOR" | "TECH_SUPPORT_STAFF" | "EVENT_ORGANISER" | "VENUE_STAFF" | "ATTENDEE";
function signedInAs(userId: string, role: Role) {
  vi.mocked(resolveCurrentUser).mockResolvedValue({ id: userId, email: "q1@connectsphere.test", role });
}
const asTs = () => signedInAs(A.ts, "TECH_SUPPORT_STAFF");

let event: { id: string; reference: string; name: string };
let chairs: { id: string; name: string };
let projectors: { id: string; name: string };

async function clean() {
  await cleanLineFixtures(sql, [A.org], [A.ts]);
}

beforeAll(clean);
beforeEach(async () => {
  await clean();
  event = await createEvent(sql, { ownerId: A.org, coordinatorId: A.c1, name: "Q1 fixture event" });
  chairs = await createBulkType(sql, A.ts, "Q1 Chairs", 10);
  projectors = await createSerializedType(sql, A.ts, "Q1 Projectors", ["P-01", "P-02", "P-03"]);
  asTs();
});
afterAll(async () => {
  await clean();
  await sql.end();
});

const reserve = (id: string, body: unknown = {}) => request(app).post(`${BASE}/${id}/reservation`).set(bearer).send(body as object);
const line = (typeId: string, quantity: number, changes: Record<string, unknown> = {}) =>
  insertLineDirect(sql, { event, equipmentTypeId: typeId, requestedBy: A.c1, status: "CONFIRMED", quantity, ...changes });
const availability = async (typeId: string, startsAt = EVENT_START, endsAt = EVENT_END) =>
  (
    await request(app)
      .get(`/api/v1/equipment/types/${typeId}/availability`)
      .query({ startsAt, endsAt, requestedQuantity: 1 })
      .set(bearer)
  ).body;
const reservationsFor = (lineId: string) => sql`select * from equipment.reservations where request_line_id = ${lineId}`;
const useUp = (typeId: string, quantity: number, startsAt = EVENT_START, endsAt = EVENT_END) =>
  reserveBulkDirect(sql, { equipmentTypeId: typeId, quantity, startsAt, endsAt, actorUserId: A.ts });
const row = async (id: string) => (await sql`select * from equipment.equipment_request_lines where id = ${id}`)[0];
const history = (id: string) =>
  sql`select * from equipment.request_line_history where line_id = ${id} order by occurred_at, created_at`;
const outboxRows = (id: string) => sql`select * from equipment.outbox where message_key = ${id} order by seq`;

describe("Q1 cards: reserving a line's equipment", () => {
  it("Q1-T1 reserves a Confirmed bulk line and reduces availability by exactly that quantity", async () => {
    const id = await line(chairs.id, 4);
    const before = Date.now();
    const response = await reserve(id);
    const after = Date.now();

    expect(response.status).toBe(201);
    expect(response.body.reservation).toMatchObject({
      eventId: event.id,
      eventReference: event.reference,
      equipmentTypeId: chairs.id,
      kind: "BULK",
      requestedQuantity: 4,
      reservedQuantity: 4,
      startsAt: EVENT_START,
      endsAt: EVENT_END,
      reservedBy: A.ts,
      status: "RESERVED",
    });
    const reservedAt = new Date(response.body.reservation.reservedAt).getTime();
    expect(reservedAt).toBeGreaterThanOrEqual(before - SLACK_MS);
    expect(reservedAt).toBeLessThanOrEqual(after + SLACK_MS);
    expect(response.body.line).toMatchObject({ status: "RESERVED", statusChangedBy: A.ts });

    const opened = await request(app).get(`${BASE}/${id}`).set(bearer);
    expect(opened.body).toMatchObject({ status: "RESERVED", statusChangedBy: A.ts });

    expect((await availability(chairs.id)).availableQuantity).toBe(6);
    const lastHour = new Date(new Date(EVENT_END).getTime() - 3_600_000).toISOString();
    expect((await availability(chairs.id, lastHour, EVENT_END)).availableQuantity).toBe(6);
  });

  it("Q1-T2 reserves a Confirmed serialized line by holding that many units under one reservation", async () => {
    const id = await line(projectors.id, 2);
    const response = await reserve(id);

    expect(response.status).toBe(201);
    expect(response.body.reservation).toMatchObject({ reservedQuantity: 2, kind: "SERIALIZED" });
    const units = await sql`
      select u.label, r.reservation_id
      from equipment.unit_reservations r
      join equipment.equipment_units u on u.id = r.unit_id
      where r.reservation_id = ${response.body.reservation.id}
      order by u.label
    `;
    expect(units.map((unit) => unit.label)).toEqual(["P-01", "P-02"]);
    expect(units.every((unit) => unit.reservation_id === response.body.reservation.id)).toBe(true);
    expect((await availability(projectors.id)).availableQuantity).toBe(1);
  });

  it("Q1-T3 reserves the substitute, not the original, for a Substituted line", async () => {
    const id = await line(projectors.id, 2, { status: "SUBSTITUTED", substitute: { typeId: chairs.id, quantity: 5 } });
    const response = await reserve(id);

    expect(response.status).toBe(201);
    expect(response.body.reservation).toMatchObject({ equipmentTypeId: chairs.id, requestedQuantity: 5, reservedQuantity: 5 });
    const projectorRows = await sql`
      select r.* from equipment.unit_reservations r
      join equipment.equipment_units u on u.id = r.unit_id
      where u.equipment_type_id = ${projectors.id}
    `;
    expect(projectorRows).toHaveLength(0);
    expect(await sql`select 1 from equipment.unit_reservations where reservation_id = ${response.body.reservation.id}`).toHaveLength(0);
  });

  it("Q1-T4 reserves exactly the available quantity and leaves none", async () => {
    await useUp(chairs.id, 7);
    const id = await line(chairs.id, 3);
    const response = await reserve(id);

    expect(response.status).toBe(201);
    expect(response.body.reservation.reservedQuantity).toBe(3);
    expect((await availability(chairs.id)).availableQuantity).toBe(0);
  });

  it("Q1-T5 refuses one more than available, naming the shortfall, and stores nothing", async () => {
    await useUp(chairs.id, 7);
    const id = await line(chairs.id, 4);
    const historyBefore = (await history(id)).length;

    const response = await reserve(id);

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("INSUFFICIENT_EQUIPMENT");
    expect(response.body.error.details).toEqual({ available: 3, shortfall: 1 });
    expect(response.body.error.message).toContain("4 requested, 3 available, 1 short");
    expect(await reservationsFor(id)).toHaveLength(0);
    expect((await availability(chairs.id)).availableQuantity).toBe(3);
    expect((await row(id))!.status).toBe("CONFIRMED");
    expect((await history(id)).length).toBe(historyBefore);
    expect(await outboxRows(id)).toHaveLength(0);
  });

  it("Q1-T6 records a chosen partial reservation with the quantity actually reserved", async () => {
    await useUp(chairs.id, 7);
    const id = await line(chairs.id, 5);
    const response = await reserve(id, { quantity: 3, partial: true });

    expect(response.status).toBe(201);
    expect(response.body.reservation).toMatchObject({ requestedQuantity: 5, reservedQuantity: 3 });
    expect(response.body.line.status).toBe("RESERVED");

    const opened = await request(app).get(`${BASE}/${id}`).set(bearer);
    const entry = opened.body.history.find((item: { action: string }) => item.action === "STATUS_CHANGED");
    expect(entry.details).toMatchObject({ requestedQuantity: 5, reservedQuantity: 3 });
  });

  it("Q1-T7 refuses a lower quantity when partial is not chosen", async () => {
    const id = await line(chairs.id, 5);
    const response = await reserve(id, { quantity: 3 });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("PARTIAL_NOT_CONFIRMED");
    expect(response.body.error.message).toContain("5 were requested");
    expect(response.body.error.message).toContain("partial reservation to reserve 3");
    expect(await reservationsFor(id)).toHaveLength(0);
    expect((await row(id))!.status).toBe("CONFIRMED");
  });

  it("Q1-T8 refuses a quantity above the requested one, zero, or a fraction", async () => {
    const id = await line(chairs.id, 5);
    for (const body of [{ quantity: 6 }, { quantity: 0 }, { quantity: 2.5 }]) {
      const response = await reserve(id, body);
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_FAILED");
      expect(response.body.error.fields.map((entry: { field: string }) => entry.field)).toContain("quantity");
      expect(await reservationsFor(id)).toHaveLength(0);
      expect((await row(id))!.status).toBe("CONFIRMED");
    }
  });

  it("Q1-T9 refuses lines that are not Confirmed or Substituted, naming the status", async () => {
    const statuses: EquipmentRequestLineStatus[] = ["SUBMITTED", "UNDER_REVIEW", "UNAVAILABLE", "RESERVED", "REMOVED"];
    const ids = [];
    for (const status of statuses) ids.push(await line(chairs.id, 4, { status }));
    const before = await Promise.all(ids.map(row));

    for (const [index, status] of statuses.entries()) {
      const response = await reserve(ids[index]!);
      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe("LINE_NOT_RESERVABLE");
      expect(response.body.error.message).toContain(EQUIPMENT_LINE_STATUS_LABELS[status]);
      expect(response.body.error.details).toEqual({ status });
      expect(await reservationsFor(ids[index]!)).toHaveLength(0);
    }
    expect(await Promise.all(ids.map(row))).toEqual(before);
  });

  it("Q1-T10 records the reservation in the history and notifies the assigned coordinator", async () => {
    const id = await line(chairs.id, 4);
    expect(await outboxRows(id)).toHaveLength(0);

    const response = await reserve(id);
    expect(response.status).toBe(201);

    const entries = await history(id);
    const last = entries[entries.length - 1]!;
    expect(last).toMatchObject({ action: "STATUS_CHANGED", previous_status: "CONFIRMED", new_status: "RESERVED", actor_user_id: A.ts });
    expect(last.details).toEqual({
      reservationId: response.body.reservation.id,
      equipmentTypeId: chairs.id,
      equipmentTypeName: chairs.name,
      requestedQuantity: 4,
      reservedQuantity: 4,
    });

    const messages = await outboxRows(id);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ topic: "connectsphere.equipment-request.v1", message_key: id, published_at: null });
    const stored = parseCloudEvent(messages[0]!.envelope);
    expect(stored.type).toBe("equipment-request.line-status-changed");
    expect(stored.data).toMatchObject({ lineId: id, coordinatorId: A.c1, newStatus: "RESERVED" });

    const notifications = notificationsFor(stored);
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({ recipientUserId: A.c1, eventId: event.id, eventReference: event.reference });
    expect(notifications[0]!.message).toContain(event.reference);
  });

  it("Q1-T11 refuses other roles and returns not found for an unknown line", async () => {
    const id = await line(chairs.id, 4);
    const before = await row(id);

    for (const [userId, role] of [
      [A.c1, "EVENT_COORDINATOR"],
      [A.org, "EVENT_ORGANISER"],
      [A.vs, "VENUE_STAFF"],
      [A.att, "ATTENDEE"],
    ] as const) {
      signedInAs(userId, role);
      expect((await reserve(id)).status).toBe(403);
    }
    expect(await row(id)).toEqual(before);
    expect(await reservationsFor(id)).toHaveLength(0);

    asTs();
    const missing = await reserve(unknownId());
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe("EQUIPMENT_LINE_NOT_FOUND");
  });

  it("Q1-T12 does not let a reservation that only touches the period reduce availability", async () => {
    const endsAfter = new Date(new Date(EVENT_END).getTime() + 2 * 3_600_000).toISOString();
    await useUp(chairs.id, 10, EVENT_END, endsAfter);
    const id = await line(chairs.id, 10);
    const response = await reserve(id);

    expect(response.status).toBe(201);
    expect(response.body.reservation.reservedQuantity).toBe(10);
  });
});
