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
  unknownId,
} from "../../support/lineFixtures.js";
import { EVENT_END, EVENT_START } from "../../support/eventDates.js";

// The Q2 cards (tests/Q2): real Express app and migrated Postgres, with JWT verification and the
// identity lookup replaced. FX-Q2 is FX-Q1's event and types plus L1, a Confirmed CHAIRS x 4 line
// reserved through the real reservation route. Q2-T9 passes the stored message through the
// notification service's recipient rule. Q2-T6 (the race) is in tests/race/invariants.test.ts, Q2-T12
// waits for F4 (Not Executed), and Q2-T13 is done by hand in the browser.
vi.mock("../../../src/shared/auth/verifyJwt.js", () => ({
  verifyJwt: (req: { auth?: { supabaseUserId?: string } }, _res: unknown, next: () => void) => {
    req.auth = { supabaseUserId: "q2-card-subject" };
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
const A = actorsWithPrefix("0b800000");
const bearer = { Authorization: "Bearer q2-card-token" };
const BASE = "/api/v1/equipment/request-lines";
const SLACK_MS = 2_000;

type Role = "EVENT_COORDINATOR" | "TECH_SUPPORT_STAFF" | "EVENT_ORGANISER" | "VENUE_STAFF" | "ATTENDEE";
function signedInAs(userId: string, role: Role) {
  vi.mocked(resolveCurrentUser).mockResolvedValue({ id: userId, email: "q2@connectsphere.test", role });
}
const asTs = () => signedInAs(A.ts, "TECH_SUPPORT_STAFF");
const asC1 = () => signedInAs(A.c1, "EVENT_COORDINATOR");

let event: { id: string; reference: string; name: string };
let chairs: { id: string; name: string };
let projectors: { id: string; name: string };
let l1: string;
let l1Reservation: Record<string, unknown>;

async function clean() {
  await cleanLineFixtures(sql, [A.org], [A.ts]);
}

beforeAll(clean);
beforeEach(async () => {
  await clean();
  event = await createEvent(sql, { ownerId: A.org, coordinatorId: A.c1, name: "Q2 fixture event" });
  chairs = await createBulkType(sql, A.ts, "Q2 Chairs", 10);
  projectors = await createSerializedType(sql, A.ts, "Q2 Projectors", ["P-01", "P-02", "P-03"]);
  asTs();
  l1 = await line(chairs.id, 4);
  const reserved = await reserve(l1);
  expect(reserved.status).toBe(201);
  l1Reservation = reserved.body.reservation;
});
afterAll(async () => {
  await clean();
  await sql.end();
});

const reserve = (id: string, body: unknown = {}) => request(app).post(`${BASE}/${id}/reservation`).set(bearer).send(body as object);
const releaseReq = (id: string, body: unknown = { reason: "Not needed" }) =>
  request(app).post(`${BASE}/${id}/release`).set(bearer).send(body as object);
const removeReq = (id: string) => request(app).post(`${BASE}/${id}/removal`).set(bearer).send({});
const line = (typeId: string, quantity: number, changes: Record<string, unknown> = {}) =>
  insertLineDirect(sql, { event, equipmentTypeId: typeId, requestedBy: A.c1, status: "CONFIRMED", quantity, ...changes });
const availability = async (typeId: string, startsAt = EVENT_START, endsAt = EVENT_END) =>
  (
    await request(app)
      .get(`/api/v1/equipment/types/${typeId}/availability`)
      .query({ startsAt, endsAt, requestedQuantity: 1 })
      .set(bearer)
  ).body;
const reservationsFor = (lineId: string) =>
  sql`select * from equipment.reservations where request_line_id = ${lineId} order by reserved_at, id`;
const reservationRow = async (id: string) => (await sql`select * from equipment.reservations where id = ${id}`)[0];
const row = async (id: string) => (await sql`select * from equipment.equipment_request_lines where id = ${id}`)[0];
const history = (id: string) =>
  sql`select * from equipment.request_line_history where line_id = ${id} order by occurred_at, created_at`;
const releaseEntries = async (id: string) =>
  (await history(id)).filter((entry) => (entry.details as { released?: unknown } | null)?.released === true);
const outboxRows = (id: string) => sql`select * from equipment.outbox where message_key = ${id} order by seq`;
const releaseMessages = (id: string) =>
  sql`select * from equipment.outbox where message_key = ${id} and envelope->'data'->>'released' = 'true' order by seq`;

describe("Q2 cards: releasing a reservation", () => {
  it("Q2-T1 releases with a reason, keeps the reservation, returns the line to Confirmed and restores availability", async () => {
    const reason = "Event moved to a smaller room";
    const before = Date.now();
    const response = await releaseReq(l1, { reason });
    const after = Date.now();

    expect(response.status).toBe(200);
    expect(response.body.reservation).toMatchObject({
      id: l1Reservation.id,
      requestedQuantity: 4,
      reservedQuantity: 4,
      reservedBy: A.ts,
      status: "RELEASED",
      releasedBy: A.ts,
      releaseReason: reason,
    });
    const releasedAt = new Date(response.body.reservation.releasedAt).getTime();
    expect(releasedAt).toBeGreaterThanOrEqual(before - SLACK_MS);
    expect(releasedAt).toBeLessThanOrEqual(after + SLACK_MS);

    const opened = await request(app).get(`${BASE}/${l1}`).set(bearer);
    expect(opened.body).toMatchObject({ status: "CONFIRMED", statusChangedBy: A.ts });

    const stored = await reservationRow(l1Reservation.id as string);
    expect(stored).toMatchObject({ status: "RELEASED", released_by: A.ts, release_reason: reason });
    expect(stored!.released_at).not.toBeNull();
    expect((await availability(chairs.id)).availableQuantity).toBe(10);
  });

  it("Q2-T2 sets both unit reservations of a serialized line to Released so the units are available again", async () => {
    const id = await line(projectors.id, 2);
    const reserved = await reserve(id);
    expect(reserved.status).toBe(201);
    expect((await availability(projectors.id)).availableQuantity).toBe(1);

    const response = await releaseReq(id);

    expect(response.status).toBe(200);
    const units = await sql`select status from equipment.unit_reservations where reservation_id = ${reserved.body.reservation.id}`;
    expect(units).toHaveLength(2);
    expect(units.every((unit) => unit.status === "RELEASED")).toBe(true);
    expect((await availability(projectors.id)).availableQuantity).toBe(3);
  });

  it("Q2-T3 sends a released Substituted line back to Substituted with its substitute unchanged", async () => {
    const id = await line(projectors.id, 2, { status: "SUBSTITUTED", substitute: { typeId: chairs.id, quantity: 5 } });
    expect((await reserve(id)).status).toBe(201);
    expect((await availability(chairs.id)).availableQuantity).toBe(1);

    const response = await releaseReq(id);

    expect(response.status).toBe(200);
    const opened = await request(app).get(`${BASE}/${id}`).set(bearer);
    expect(opened.body).toMatchObject({
      status: "SUBSTITUTED",
      substituteEquipmentTypeId: chairs.id,
      substituteQuantity: 5,
    });
    expect(response.body.line).toMatchObject({ status: "SUBSTITUTED", substituteEquipmentTypeId: chairs.id, substituteQuantity: 5 });
    expect((await availability(chairs.id)).availableQuantity).toBe(6);
  });

  it("Q2-T4 refuses a missing, empty or whitespace-only reason with a field error and changes nothing", async () => {
    const historyBefore = (await history(l1)).length;

    for (const body of [{}, { reason: "" }, { reason: "   " }]) {
      const response = await releaseReq(l1, body);
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_FAILED");
      expect(response.body.error.fields.map((entry: { field: string }) => entry.field)).toContain("reason");
    }

    const opened = await request(app).get(`${BASE}/${l1}`).set(bearer);
    expect(opened.body.status).toBe("RESERVED");
    expect(await reservationRow(l1Reservation.id as string)).toMatchObject({
      status: "RESERVED",
      released_by: null,
      released_at: null,
      release_reason: null,
    });
    expect((await availability(chairs.id)).availableQuantity).toBe(6);
    expect((await history(l1)).length).toBe(historyBefore);
  });

  it("Q2-T5 refuses a second release and leaves the first one's timestamp, reason, availability and history alone", async () => {
    expect((await releaseReq(l1, { reason: "First" })).status).toBe(200);
    const first = await reservationRow(l1Reservation.id as string);
    expect(first!.released_at).not.toBeNull();

    const response = await releaseReq(l1, { reason: "Again" });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("LINE_NOT_RELEASABLE");
    expect(response.body.error.message).toContain(EQUIPMENT_LINE_STATUS_LABELS.CONFIRMED);
    const second = await reservationRow(l1Reservation.id as string);
    expect(second!.released_at).toEqual(first!.released_at);
    expect(second!.release_reason).toBe(first!.release_reason);
    expect(second!.release_reason).toBe("First");
    expect((await availability(chairs.id)).availableQuantity).toBe(10);
    expect(await releaseEntries(l1)).toHaveLength(1);
  });

  it("Q2-T7 refuses every status other than Reserved, naming it, and changes nothing", async () => {
    const statuses: EquipmentRequestLineStatus[] = ["SUBMITTED", "UNDER_REVIEW", "CONFIRMED", "UNAVAILABLE", "SUBSTITUTED", "REMOVED"];
    const ids = [];
    for (const status of statuses) {
      ids.push(
        await line(chairs.id, 2, status === "SUBSTITUTED" ? { status, substitute: { typeId: chairs.id, quantity: 1 } } : { status }),
      );
    }
    const linesBefore = await Promise.all(ids.map(row));
    const reservationsBefore = await sql`select * from equipment.reservations order by id`;
    const remaining = (await availability(chairs.id)).availableQuantity;
    expect(remaining).toBe(6);

    for (const [index, status] of statuses.entries()) {
      const response = await releaseReq(ids[index]!, { reason: "x" });
      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe("LINE_NOT_RELEASABLE");
      expect(response.body.error.message).toContain(EQUIPMENT_LINE_STATUS_LABELS[status]);
      expect(response.body.error.details).toEqual({ status });
      expect((await availability(chairs.id)).availableQuantity).toBe(remaining);
    }
    expect(await Promise.all(ids.map(row))).toEqual(linesBefore);
    expect(await sql`select * from equipment.reservations order by id`).toEqual(reservationsBefore);
  });

  it("Q2-T8 lets the coordinator remove a Reserved line, releasing its reservation in the same step", async () => {
    asC1();
    const response = await removeReq(l1);

    expect(response.status).toBe(200);
    asTs();
    const opened = await request(app).get(`${BASE}/${l1}`).set(bearer);
    expect(opened.body.status).toBe("REMOVED");
    expect(await reservationRow(l1Reservation.id as string)).toMatchObject({
      status: "RELEASED",
      released_by: A.c1,
      release_reason: "Request line removed",
    });
    expect((await availability(chairs.id)).availableQuantity).toBe(10);
    const entries = await history(l1);
    const last = entries[entries.length - 1]!;
    expect(last).toMatchObject({ action: "REMOVED", actor_user_id: A.c1 });
    expect(last.details).toEqual({ reservationId: l1Reservation.id, released: true, reason: "Request line removed" });
  });

  it("Q2-T9 notifies the coordinator of Technical Support's release, worded as a release with the reason", async () => {
    const reason = "Event moved to a smaller room";
    expect((await releaseReq(l1, { reason })).status).toBe(200);

    const messages = await releaseMessages(l1);
    expect(messages).toHaveLength(1);
    const stored = parseCloudEvent(messages[0]!.envelope);
    expect(stored.type).toBe("equipment-request.line-status-changed");
    expect(stored.data).toMatchObject({ lineId: l1, coordinatorId: A.c1, released: true, reason });

    const notifications = notificationsFor(stored);
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({ recipientUserId: A.c1, eventId: event.id });
    for (const part of [event.reference, "Q2 Chairs", "released", reason]) expect(notifications[0]!.message).toContain(part);
  });

  it("Q2-T9 notifies the coordinator of their own removal of a Reserved line the same way", async () => {
    asC1();
    expect((await removeReq(l1)).status).toBe(200);

    const messages = await releaseMessages(l1);
    expect(messages).toHaveLength(1);
    const stored = parseCloudEvent(messages[0]!.envelope);
    expect(stored.type).toBe("equipment-request.line-status-changed");
    expect(stored.data).toMatchObject({ lineId: l1, coordinatorId: A.c1, released: true, reason: "Request line removed" });

    const notifications = notificationsFor(stored);
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({ recipientUserId: A.c1, eventId: event.id });
    for (const part of [event.reference, "Q2 Chairs", "released", "Request line removed"]) {
      expect(notifications[0]!.message).toContain(part);
    }
  });

  it("Q2-T10 refuses other roles, leaving the line alone, and returns not found for an unknown line", async () => {
    const before = await row(l1);
    const reservationBefore = await reservationRow(l1Reservation.id as string);

    for (const [userId, role] of [
      [A.c1, "EVENT_COORDINATOR"],
      [A.org, "EVENT_ORGANISER"],
      [A.vs, "VENUE_STAFF"],
      [A.att, "ATTENDEE"],
    ] as const) {
      signedInAs(userId, role);
      expect((await releaseReq(l1, { reason: "x" })).status).toBe(403);
      expect(await row(l1)).toEqual(before);
    }
    expect(await reservationRow(l1Reservation.id as string)).toEqual(reservationBefore);

    asTs();
    const missing = await releaseReq(unknownId(), { reason: "x" });
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe("EQUIPMENT_LINE_NOT_FOUND");
  });

  it("Q2-T11 lets a released line be reserved again and keeps the released reservation", async () => {
    expect((await releaseReq(l1)).status).toBe(200);

    const again = await reserve(l1, {});

    expect(again.status).toBe(201);
    expect(again.body.reservation.id).not.toBe(l1Reservation.id);
    expect(again.body.reservation).toMatchObject({ reservedQuantity: 4, requestedQuantity: 4, status: "RESERVED" });
    const stored = await reservationsFor(l1);
    expect(stored).toHaveLength(2);
    expect(stored.find((entry) => entry.id === l1Reservation.id)).toMatchObject({ status: "RELEASED" });
  });
});

describe("release route", () => {
  it("answers 404 EQUIPMENT_LINE_NOT_FOUND for an id that is not a UUID", async () => {
    const response = await releaseReq("not-a-uuid");
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("EQUIPMENT_LINE_NOT_FOUND");
  });

  it("releases for an event with no assigned coordinator and writes no outbox message", async () => {
    const unassigned = await createEvent(sql, { ownerId: A.org, coordinatorId: null, name: "Q2 unassigned event" });
    const id = await insertLineDirect(sql, {
      event: unassigned,
      equipmentTypeId: chairs.id,
      requestedBy: A.c1,
      status: "CONFIRMED",
      quantity: 2,
    });
    expect((await reserve(id)).status).toBe(201);

    const response = await releaseReq(id);

    expect(response.status).toBe(200);
    expect(response.body.line.status).toBe("CONFIRMED");
    expect(await outboxRows(id)).toHaveLength(0);
  });
});
