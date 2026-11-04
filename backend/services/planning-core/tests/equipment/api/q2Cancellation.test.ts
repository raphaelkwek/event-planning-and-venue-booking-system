import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { parseCloudEvent } from "@connectsphere/contracts";
import { notificationsFor } from "../../../../notification/src/domain/recipients.js";
import { testDb } from "../../support/testDb.js";
import { actorsWithPrefix, cleanLineFixtures, createBulkType, createEvent, createSerializedType, insertLineDirect } from "../../support/lineFixtures.js";
import { EVENT_END, EVENT_START } from "../../support/eventDates.js";

// Q2-T12 (tests/Q2): F4's cancellation releases every Reserved line of the event. Real Express app and
// migrated Postgres, with JWT verification and each module's identity lookup replaced, as in
// tests/change/api/f4Cards.test.ts, since the cancellation route reaches the change, event, venue and
// equipment modules. FX-Q2's event and types, with two lines reserved through Q1's real route.
vi.mock("../../../src/shared/auth/verifyJwt.js", () => ({
  verifyJwt: (req: { auth?: { supabaseUserId?: string } }, _res: unknown, next: () => void) => {
    req.auth = { supabaseUserId: "q2-t12-subject" };
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
const A = actorsWithPrefix("0b812000");
const bearer = { Authorization: "Bearer q2-t12-token" };
const BASE = "/api/v1/equipment/request-lines";
/** What F4 records on every release it makes (F4-T5). */
const F4_REASON = "event cancelled";

type Role = "EVENT_COORDINATOR" | "TECH_SUPPORT_STAFF" | "EVENT_ORGANISER";
function signedInAs(userId: string, role: Role) {
  const user = { id: userId, email: "q2-t12@connectsphere.test", role };
  for (const resolve of [resolveChangeUser, resolveEquipmentUser, resolveVenueUser, resolveEventUser]) {
    vi.mocked(resolve).mockResolvedValue(user);
  }
  vi.mocked(resolveEventsScope).mockResolvedValue(role === "EVENT_ORGANISER" ? { scopeType: "OWNED_BY_USER", userId } : { scopeType: "ALL" });
}

async function clean() {
  await cleanLineFixtures(sql, [A.org], [A.ts]);
}

beforeAll(clean);
beforeEach(clean);
afterAll(async () => {
  await clean();
  await sql.end();
});

/** Technical Support reserve the line in full through Q1's route. */
async function reserve(lineId: string) {
  signedInAs(A.ts, "TECH_SUPPORT_STAFF");
  const response = await request(app).post(`${BASE}/${lineId}/reservation`).set(bearer).send({});
  expect(response.status).toBe(201);
  return response.body.reservation as { id: string };
}

async function available(typeId: string) {
  signedInAs(A.ts, "TECH_SUPPORT_STAFF");
  const response = await request(app)
    .get(`/api/v1/equipment/types/${typeId}/availability`)
    .query({ startsAt: EVENT_START, endsAt: EVENT_END, requestedQuantity: 1 })
    .set(bearer);
  expect(response.status).toBe(200);
  return response.body.availableQuantity as number;
}

describe("Q2 cards: an event cancellation releases the reservations", () => {
  it("Q2-T12 F4's cancellation releases every Reserved line, recording the cancelling user and F4's reason, restores availability and tells the coordinator", async () => {
    // FX-Q2: E1 Approved, owned by ORG and assigned to C1; CHAIRS (bulk, 10) and PROJECTORS (P-01 to P-03).
    const event = await createEvent(sql, { ownerId: A.org, coordinatorId: A.c1, name: "Q2-T12 fixture event" });
    const chairs = await createBulkType(sql, A.ts, "Q2-T12 Chairs", 10);
    const projectors = await createSerializedType(sql, A.ts, "Q2-T12 Projectors", ["P-01", "P-02", "P-03"]);
    const chairsLine = await insertLineDirect(sql, { event, equipmentTypeId: chairs.id, requestedBy: A.c1, status: "CONFIRMED", quantity: 4 });
    const projectorsLine = await insertLineDirect(sql, { event, equipmentTypeId: projectors.id, requestedBy: A.c1, status: "CONFIRMED", quantity: 2 });
    const reservations = [await reserve(chairsLine), await reserve(projectorsLine)];
    expect([await available(chairs.id), await available(projectors.id)]).toEqual([6, 1]);

    // Step 1: the owner cancels E1 through F4.
    signedInAs(A.org, "EVENT_ORGANISER");
    const reason = "The speaker withdrew.";
    const cancelled = await request(app).post(`/api/v1/events/${event.id}/cancellation`).set(bearer).send({ reason });
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.released.reservations.map((r: { reservationId: string }) => r.reservationId).sort()).toEqual(
      reservations.map((r) => r.id).sort(),
    );

    // Step 2: every reservation of E1 is Released by the cancelling user with F4's reason, and kept.
    const stored = await sql<{ id: string; status: string; released_by: string | null; released_at: Date | null; release_reason: string | null }[]>`
      select id, status, released_by, released_at, release_reason from equipment.reservations where event_id = ${event.id} order by id
    `;
    expect(stored.map((r) => r.id).sort()).toEqual(reservations.map((r) => r.id).sort());
    for (const reservation of stored) {
      expect(reservation).toMatchObject({ status: "RELEASED", released_by: A.org, release_reason: F4_REASON });
      expect(reservation.released_at).toBeInstanceOf(Date);
    }
    // The stock rows they grouped: the chairs' bulk row and the two projector units.
    const bulk = await sql<{ status: string }[]>`select status from equipment.bulk_reservations where reservation_id = ${reservations[0]!.id}`;
    const units = await sql<{ status: string }[]>`select status from equipment.unit_reservations where reservation_id = ${reservations[1]!.id}`;
    expect(bulk.length).toBeGreaterThan(0);
    expect(units).toHaveLength(2);
    expect([...bulk, ...units].every((row) => row.status === "RELEASED")).toBe(true);
    // Their lines are no longer Reserved: each went back to Confirmed, the release recorded in its history.
    for (const line of [chairsLine, projectorsLine]) {
      const [row] = await sql<{ status: string }[]>`select status from equipment.equipment_request_lines where id = ${line}`;
      expect(row!.status).toBe("CONFIRMED");
      const history = await sql<{ action: string; previous_status: string; new_status: string; actor_user_id: string; details: Record<string, unknown> }[]>`
        select action, previous_status, new_status, actor_user_id, details from equipment.request_line_history
        where line_id = ${line} order by occurred_at, created_at
      `;
      expect(history.at(-1)).toMatchObject({
        action: "STATUS_CHANGED",
        previous_status: "RESERVED",
        new_status: "CONFIRMED",
        actor_user_id: A.org,
        details: { released: true, reason: F4_REASON },
      });
    }

    // Step 3: the stock is available for E1's window again, and C1 is told of the cancellation.
    expect([await available(chairs.id), await available(projectors.id)]).toEqual([10, 3]);
    const messages = await sql<{ envelope: unknown }[]>`
      select envelope from event.outbox where message_key = ${event.id} and envelope->>'type' = 'event.cancelled'
    `;
    expect(messages).toHaveLength(1);
    const message = parseCloudEvent(messages[0]!.envelope);
    const notices = notificationsFor({ id: message.id, type: message.type, time: message.time, subject: event.id, data: message.data as Record<string, unknown> });
    const toCoordinator = notices.filter((notice) => notice.recipientUserId === A.c1);
    expect(toCoordinator).toHaveLength(1);
    expect(toCoordinator[0]).toMatchObject({ eventId: event.id, eventReference: event.reference });
    expect(toCoordinator[0]!.message).toBe(`The event ${event.reference} “${event.name}” has been cancelled. Reason: ${reason}`);
    // Whoever reserved the equipment is told what of theirs was released.
    expect(notices.find((notice) => notice.recipientUserId === A.ts)?.message).toContain(
      `The equipment you reserved has been released: ${chairs.name} × 4, ${projectors.name} × 2.`,
    );
  });
});
