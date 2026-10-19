import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { parseCloudEvent } from "@connectsphere/contracts";
import { notificationsFor } from "../../../../notification/src/domain/recipients.js";
import { testDb } from "../../support/testDb.js";
import { actorsWithPrefix, cleanLineFixtures, createEvent, createTypes, insertLineDirect } from "../../support/lineFixtures.js";

// The O2 cards (tests/O2): real Express app and migrated Postgres, with JWT verification and the
// identity lookup replaced. The notification half of O2-T9 passes the stored message through the
// notification service's recipient rule, the function that turns a message into a notification.
vi.mock("../../../src/shared/auth/verifyJwt.js", () => ({
  verifyJwt: (req: { auth?: { supabaseUserId?: string } }, _res: unknown, next: () => void) => {
    req.auth = { supabaseUserId: "o2-card-subject" };
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
const A = actorsWithPrefix("0b200000");
const bearer = { Authorization: "Bearer o2-card-token" };
const BASE = "/api/v1/equipment/request-lines";
const SLACK_MS = 2_000;

type Role = "EVENT_COORDINATOR" | "TECH_SUPPORT_STAFF" | "EVENT_ORGANISER" | "VENUE_STAFF" | "ATTENDEE";
function signedInAs(userId: string, role: Role) {
  vi.mocked(resolveCurrentUser).mockResolvedValue({ id: userId, email: "o2@connectsphere.test", role });
}
const asTs = () => signedInAs(A.ts, "TECH_SUPPORT_STAFF");
const asC1 = () => signedInAs(A.c1, "EVENT_COORDINATOR");

let event: { id: string; reference: string; name: string };
let chairs: { id: string; name: string };
let projectors: { id: string; name: string };

async function clean() {
  await cleanLineFixtures(sql, [A.org], [A.ts]);
}

beforeAll(clean);
beforeEach(async () => {
  await clean();
  event = await createEvent(sql, { ownerId: A.org, coordinatorId: A.c1, name: "O2 fixture event" });
  ({ chairs, projectors } = await createTypes(sql, A.ts, "O2"));
  asTs();
});
afterAll(async () => {
  await clean();
  await sql.end();
});

const submitted = (changes: Record<string, unknown> = {}) =>
  insertLineDirect(sql, { event, equipmentTypeId: chairs.id, requestedBy: A.c1, ...changes });
const change = (id: string, body: unknown) => request(app).post(`${BASE}/${id}/status`).set(bearer).send(body as object);
const row = async (id: string) => (await sql`select * from equipment.equipment_request_lines where id = ${id}`)[0];
const history = async (id: string) =>
  sql`select * from equipment.request_line_history where line_id = ${id} order by occurred_at, created_at`;
const outboxRows = (id: string) => sql`select * from equipment.outbox where message_key = ${id} order by seq`;
const reservationCount = async () =>
  Number((await sql`select count(*) from equipment.bulk_reservations where equipment_type_id in (${chairs.id}, ${projectors.id})`)[0]!.count) +
  Number(
    (await sql`
      select count(*) from equipment.unit_reservations r
      join equipment.equipment_units u on u.id = r.unit_id
      where u.equipment_type_id in (${chairs.id}, ${projectors.id})
    `)[0]!.count,
  );

describe("O2 cards: updating a line's status", () => {
  it("O2-T1 sets a line Under Review and records who and when", async () => {
    const id = await submitted();
    const before = Date.now();
    const response = await change(id, { status: "UNDER_REVIEW" });
    const after = Date.now();

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: "UNDER_REVIEW", statusChangedBy: A.ts });
    expect(new Date(response.body.statusChangedAt).getTime()).toBeGreaterThanOrEqual(before - SLACK_MS);
    expect(new Date(response.body.statusChangedAt).getTime()).toBeLessThanOrEqual(after + SLACK_MS);

    const opened = await request(app).get(`${BASE}/${id}`).set(bearer);
    const entry = opened.body.history.find((item: { action: string }) => item.action === "STATUS_CHANGED");
    expect(entry).toMatchObject({ previousStatus: "SUBMITTED", newStatus: "UNDER_REVIEW", actorUserId: A.ts, actorRole: "TECH_SUPPORT_STAFF" });
  });

  it("O2-T2 confirms a line without reserving anything", async () => {
    const id = await submitted({ status: "UNDER_REVIEW" });
    const reservationsBefore = await reservationCount();
    const before = Date.now();
    const response = await change(id, { status: "CONFIRMED" });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: "CONFIRMED", statusChangedBy: A.ts });
    expect(new Date(response.body.statusChangedAt).getTime()).toBeGreaterThanOrEqual(before - SLACK_MS);
    expect(await reservationCount()).toBe(reservationsBefore);
  });

  it("O2-T3 sets a line Unavailable with a reason and reserves nothing", async () => {
    const id = await submitted();
    const reservationsBefore = await reservationCount();
    const response = await change(id, { status: "UNAVAILABLE", reason: "All chairs are out at another event that week" });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: "UNAVAILABLE",
      unavailableReason: "All chairs are out at another event that week",
      statusChangedBy: A.ts,
    });
    const entries = await history(id);
    expect(entries[entries.length - 1]!.details).toMatchObject({ reason: "All chairs are out at another event that week" });
    expect(await reservationCount()).toBe(reservationsBefore);
  });

  it("O2-T4 refuses Unavailable without a reason and leaves the line unchanged", async () => {
    const id = await submitted({ status: "UNDER_REVIEW", notes: "Rows of 10" });
    const before = await row(id);
    const historyBefore = (await history(id)).length;
    const reservationsBefore = await reservationCount();

    for (const body of [{ status: "UNAVAILABLE" }, { status: "UNAVAILABLE", reason: "" }, { status: "UNAVAILABLE", reason: "   " }]) {
      const response = await change(id, body);
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_FAILED");
      expect(response.body.error.fields.map((entry: { field: string }) => entry.field)).toEqual(["reason"]);
      expect(await row(id)).toEqual(before);
      expect((await history(id)).length).toBe(historyBefore);
    }
    expect((await row(id))!.status).toBe("UNDER_REVIEW");
    expect((await row(id))!.notes).toBe("Rows of 10");
    expect(await reservationCount()).toBe(reservationsBefore);
  });

  it("O2-T5 accepts a one-character reason", async () => {
    const response = await change(await submitted(), { status: "UNAVAILABLE", reason: "x" });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: "UNAVAILABLE", unavailableReason: "x" });
  });

  it("O2-T6 records the substitute beside the original instead of overwriting it", async () => {
    const id = await submitted();
    const response = await change(id, { status: "SUBSTITUTED", substituteEquipmentTypeId: projectors.id, substituteQuantity: 3 });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: "SUBSTITUTED",
      equipmentTypeId: chairs.id,
      equipmentTypeName: chairs.name,
      quantity: 40,
      substituteEquipmentTypeId: projectors.id,
      substituteEquipmentTypeName: projectors.name,
      substituteQuantity: 3,
    });
    const opened = await request(app).get(`${BASE}/${id}`).set(bearer);
    const entry = opened.body.history[opened.body.history.length - 1];
    expect(entry).toMatchObject({ action: "STATUS_CHANGED", equipmentTypeName: chairs.name, quantity: 40 });
    expect(entry.details).toMatchObject({ substituteEquipmentTypeName: projectors.name, substituteQuantity: 3 });
  });

  it("O2-T7 refuses a substitution without a valid substitute and changes nothing", async () => {
    const id = await submitted();
    const before = await row(id);
    const historyBefore = (await history(id)).length;
    const type = projectors.id;
    const invalid: [string, Record<string, unknown>, string][] = [
      ["a", {}, "substituteEquipmentTypeId"],
      ["b", { substituteEquipmentTypeId: type }, "substituteQuantity"],
      ["c", { substituteQuantity: 2 }, "substituteEquipmentTypeId"],
      ["d", { substituteEquipmentTypeId: type, substituteQuantity: 0 }, "substituteQuantity"],
      ["e", { substituteEquipmentTypeId: type, substituteQuantity: -1 }, "substituteQuantity"],
      ["f", { substituteEquipmentTypeId: type, substituteQuantity: 1.5 }, "substituteQuantity"],
    ];
    for (const [name, body, field] of invalid) {
      const response = await change(id, { status: "SUBSTITUTED", ...body });
      expect(response.status, name).toBe(400);
      expect(response.body.error.fields.map((entry: { field: string }) => entry.field)).toContain(field);
    }
    const unknown = await change(id, {
      status: "SUBSTITUTED",
      substituteEquipmentTypeId: "11111111-1111-4111-8111-111111111111",
      substituteQuantity: 2,
    });
    expect(unknown.status).toBe(404);
    expect(unknown.body.error.code).toBe("EQUIPMENT_TYPE_NOT_FOUND");

    expect(await row(id)).toEqual(before);
    expect((await row(id))!.substitute_equipment_type_id).toBeNull();
    expect((await history(id)).length).toBe(historyBefore);
  });

  it("O2-T8 accepts a substitute quantity of 1", async () => {
    const response = await change(await submitted(), { status: "SUBSTITUTED", substituteEquipmentTypeId: projectors.id, substituteQuantity: 1 });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: "SUBSTITUTED", substituteQuantity: 1, quantity: 40 });
  });

  it("O2-T9 writes a message that notifies the assigned coordinator of the change", async () => {
    const id = await submitted();
    expect(await outboxRows(id)).toHaveLength(0);

    const response = await change(id, { status: "CONFIRMED" });
    expect(response.status).toBe(200);

    const messages = await outboxRows(id);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ topic: "connectsphere.equipment-request.v1", message_key: id, published_at: null });
    const stored = parseCloudEvent(messages[0]!.envelope);
    expect(stored.type).toBe("equipment-request.line-status-changed");
    expect(stored.subject).toBe(id);
    expect(stored.data).toMatchObject({
      eventId: event.id,
      eventReference: event.reference,
      eventName: event.name,
      lineId: id,
      coordinatorId: A.c1,
      equipmentTypeName: chairs.name,
      quantity: 40,
      previousStatus: "SUBMITTED",
      newStatus: "CONFIRMED",
      changedBy: A.ts,
    });
    expect(stored.data).not.toHaveProperty("released");

    const notifications = notificationsFor(stored);
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({ recipientUserId: A.c1, eventId: event.id, eventReference: event.reference });
    expect(notifications[0]!.message).toContain(event.reference);
    expect(notifications[0]!.message).toContain(chairs.name);
    expect(notifications[0]!.message).toContain("Confirmed");
  });

  it("O2-T10 leaves the line, its notes, the reservation and the messages unchanged when a change fails", async () => {
    const id = await submitted({ status: "UNDER_REVIEW", notes: "Rows of 10" });
    await sql`
      insert into equipment.bulk_reservations
        (equipment_type_id, event_id, event_reference, quantity, starts_at, ends_at, status, created_by, updated_by)
      values (${chairs.id}, ${event.id}, ${event.reference}, 40, now() + interval '30 days', now() + interval '31 days', 'RESERVED', ${A.ts}, ${A.ts})
    `;
    const lineBefore = await row(id);
    const reservationBefore = await sql`select * from equipment.bulk_reservations where equipment_type_id = ${chairs.id}`;
    const historyBefore = (await history(id)).length;

    const response = await change(id, { status: "UNAVAILABLE" });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_FAILED");

    expect(await row(id)).toEqual(lineBefore);
    expect(await sql`select * from equipment.bulk_reservations where equipment_type_id = ${chairs.id}`).toEqual(reservationBefore);
    expect((await history(id)).length).toBe(historyBefore);
    expect(await outboxRows(id)).toHaveLength(0);
  });

  it("O2-T11 refuses every role except Technical Support", async () => {
    const id = await submitted();
    const before = await row(id);
    const roles: [string, Role][] = [
      [A.c1, "EVENT_COORDINATOR"],
      [A.c2, "EVENT_COORDINATOR"],
      [A.org, "EVENT_ORGANISER"],
      [A.vs, "VENUE_STAFF"],
      [A.att, "ATTENDEE"],
    ];
    for (const [userId, role] of roles) {
      signedInAs(userId, role);
      const response = await change(id, { status: "CONFIRMED" });
      expect(response.status, userId).toBe(403);
      expect(response.body.error.code).toBe("ROLE_NOT_AUTHORISED");
    }
    expect(await row(id)).toEqual(before);
    expect(await history(id)).toHaveLength(0);
    expect(await outboxRows(id)).toHaveLength(0);
  });

  it("O2-T12 refuses statuses that O2 cannot set", async () => {
    const id = await submitted();
    for (const body of [{ status: "RESERVED" }, { status: "SUBMITTED" }, { status: "REMOVED" }, { status: "DONE" }, {}]) {
      const response = await change(id, body);
      expect(response.status).toBe(400);
      expect(response.body.error.fields.map((entry: { field: string }) => entry.field)).toEqual(["status"]);
    }
    expect((await row(id))!.status).toBe("SUBMITTED");
    expect(await reservationCount()).toBe(0);
  });

  it("O2-T13 refuses to change a Reserved or Removed line", async () => {
    const reserved = await submitted({ status: "RESERVED" });
    const removed = await submitted({ status: "REMOVED" });
    for (const [id, status] of [[reserved, "RESERVED"], [removed, "REMOVED"]] as const) {
      const before = await row(id);
      const response = await change(id, { status: "CONFIRMED" });
      expect(response.status, status).toBe(409);
      expect(response.body.error.code).toBe("STATUS_TRANSITION_NOT_PERMITTED");
      expect(response.body.error.message).toContain(status === "RESERVED" ? "Reserved" : "Removed");
      expect(await row(id)).toEqual(before);
    }
  });

  it("O2-T14 refuses a line that does not exist", async () => {
    const response = await change("33333333-3333-4333-8333-333333333333", { status: "CONFIRMED" });
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("EQUIPMENT_LINE_NOT_FOUND");
  });

  it("O2-T15 records who and when for every successive change, in order", async () => {
    const id = await submitted();
    for (const body of [
      { status: "UNDER_REVIEW" },
      { status: "CONFIRMED" },
      { status: "UNAVAILABLE", reason: "Chairs withdrawn from service" },
    ]) {
      expect((await change(id, body)).status).toBe(200);
    }
    const opened = await request(app).get(`${BASE}/${id}`).set(bearer);
    const changes = opened.body.history.filter((entry: { action: string }) => entry.action === "STATUS_CHANGED");
    expect(changes.map((entry: { previousStatus: string; newStatus: string }) => [entry.previousStatus, entry.newStatus])).toEqual([
      ["SUBMITTED", "UNDER_REVIEW"],
      ["UNDER_REVIEW", "CONFIRMED"],
      ["CONFIRMED", "UNAVAILABLE"],
    ]);
    const times = changes.map((entry: { occurredAt: string }) => new Date(entry.occurredAt).getTime());
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    expect(changes.every((entry: { actorUserId: string }) => entry.actorUserId === A.ts)).toBe(true);
    expect(opened.body.status).toBe("UNAVAILABLE");
  });

  it("O2-T16 shows the coordinator and Technical Support the updated status", async () => {
    const second = await createEvent(sql, { ownerId: A.org, coordinatorId: A.c1, name: "O2 second event" });
    const chairsLine = await submitted();
    await submitted({ equipmentTypeId: projectors.id, quantity: 2 });
    await insertLineDirect(sql, { event: second, equipmentTypeId: chairs.id, requestedBy: A.c1 });

    expect((await change(chairsLine, { status: "CONFIRMED" })).status).toBe(200);

    asC1();
    const coordinatorView = await request(app).get(`${BASE}?eventId=${event.id}`).set(bearer);
    expect(coordinatorView.status).toBe(200);
    expect(coordinatorView.body.items.map((item: { equipmentTypeId: string; status: string }) => [item.equipmentTypeId, item.status])).toEqual([
      [chairs.id, "CONFIRMED"],
      [projectors.id, "SUBMITTED"],
    ]);

    asTs();
    const ours = (items: { eventId: string }[]) => items.filter((item) => [event.id, second.id].includes(item.eventId));
    const submittedOnly = await request(app).get(`${BASE}?status=SUBMITTED`).set(bearer);
    expect(ours(submittedOnly.body.items)).toHaveLength(2);
    expect(ours(submittedOnly.body.items).every((item) => (item as unknown as { status: string }).status === "SUBMITTED")).toBe(true);
    const everything = await request(app).get(BASE).set(bearer);
    const all = ours(everything.body.items) as unknown as { eventId: string; eventReference: string }[];
    expect(all).toHaveLength(3);
    expect(new Set(all.map((item) => item.eventReference))).toEqual(new Set([event.reference, second.reference]));
  });
});
