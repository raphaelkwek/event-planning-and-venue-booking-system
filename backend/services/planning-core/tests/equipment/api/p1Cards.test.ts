import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { testDb } from "../../support/testDb.js";

// Independent P1 AC checks after CQ-02: combined peak concurrent use.
// These are real API/database tests with authentication replaced, not sign-in tests.
vi.mock("../../../src/shared/auth/verifyJwt.js", () => ({
  verifyJwt: (req: { auth?: { supabaseUserId?: string } }, _res: unknown, next: () => void) => {
    req.auth = { supabaseUserId: "p1-card-subject" }; next();
  },
}));
vi.mock("../../../src/modules/equipment/auth/identity.js", async () => {
  const actual = await vi.importActual<typeof import("../../../src/modules/equipment/auth/identity.js")>("../../../src/modules/equipment/auth/identity.js");
  return { ...actual, resolveCurrentUser: vi.fn() };
});
const { resolveCurrentUser } = await import("../../../src/modules/equipment/auth/identity.js");
const { app } = await import("../../../src/app.js");
const sql = testDb();
const ACTOR = "ae111111-0000-0000-0000-000000000001";
const bearer = { Authorization: "Bearer p1-card-token" };
const at = (hour: string) => `2026-12-15T${hour}:00.000Z`;

async function clean() {
  const types = sql`select id from equipment.equipment_types where created_by = ${ACTOR}`;
  const units = sql`select id from equipment.equipment_units where equipment_type_id in (${types})`;
  await sql`delete from equipment.unavailability where equipment_type_id in (${types})`;
  await sql`delete from equipment.unit_reservations where unit_id in (${units})`;
  await sql`delete from equipment.bulk_reservations where equipment_type_id in (${types})`;
  await sql`delete from equipment.equipment_units where equipment_type_id in (${types})`;
  await sql`delete from equipment.equipment_types where id in (${types})`;
}
beforeEach(async () => {
  await clean();
  vi.mocked(resolveCurrentUser).mockResolvedValue({ id: ACTOR, email: "p1@connectsphere.test", role: "TECH_SUPPORT_STAFF" } as never);
});
afterAll(async () => { await clean(); await sql.end(); });

async function type(kind = "BULK", total = 10) {
  const [row] = await sql`insert into equipment.equipment_types
    (name, description, kind, total_quantity, created_by, updated_by)
    values ('P1 Acceptance Chairs', 'Independent acceptance fixture', ${kind}, ${kind === "BULK" ? total : null}, ${ACTOR}, ${ACTOR}) returning id`;
  return row!.id as string;
}
async function usage(id: string, input: readonly [string, string, number, string, string?]) {
  const [from, until, quantity, source, status] = input;
  if (source === "reserved") {
    await sql`insert into equipment.bulk_reservations
      (equipment_type_id, event_id, event_reference, quantity, starts_at, ends_at, status, created_by, updated_by)
      values (${id}, ${randomUUID()}, 'EVT-P1-CARD', ${quantity}, ${at(from)}, ${at(until)}, ${status ?? "RESERVED"}, ${ACTOR}, ${ACTOR})`;
  } else {
    await sql`insert into equipment.unavailability
      (equipment_type_id, quantity, starts_at, ends_at, reason, status, created_by, updated_by)
      values (${id}, ${quantity}, ${at(from)}, ${at(until)}, 'P1 fixture maintenance', ${status ?? "ACTIVE"}, ${ACTOR}, ${ACTOR})`;
  }
}
async function check(id: string, requested = 0) {
  const response = await request(app).get(`/api/v1/equipment/types/${id}/availability`).set(bearer)
    .query({ startsAt: at("10:00"), endsAt: at("14:00"), requestedQuantity: requested });
  expect(response.status).toBe(200);
  expect(response.body).toMatchObject({ equipmentTypeId: id, requestedQuantity: requested, startsAt: at("10:00"), endsAt: at("14:00") });
  return response.body;
}
async function snapshot(id: string) {
  const units = sql`select id from equipment.equipment_units where equipment_type_id = ${id}`;
  return {
    types: await sql`select * from equipment.equipment_types where id = ${id}`,
    units: await sql`select * from equipment.equipment_units where equipment_type_id = ${id} order by id`,
    reserved: await sql`select * from equipment.bulk_reservations where equipment_type_id = ${id} order by id`,
    unitReserved: await sql`select * from equipment.unit_reservations where unit_id in (${units}) order by id`,
    unavailable: await sql`select * from equipment.unavailability where equipment_type_id = ${id} order by id`,
  };
}
const scenarios = [
  { card: "P1-T1", name: "numeric total without usage", total: 10, requested: 3, available: 10, shortfall: 0, usages: [] },
  { card: "P1-T2", name: "peak of back-to-back bookings instead of sum", total: 10, requested: 6, available: 5, shortfall: 1, usages: [["10:00", "12:00", 4, "reserved"], ["12:00", "14:00", 5, "reserved"]] },
  { card: "P1-T3", name: "combined peak across separated reservation and maintenance", total: 10, requested: 0, available: 6, shortfall: 0, usages: [["10:00", "11:00", 4, "reserved"], ["12:00", "13:00", 3, "unavailable"]] },
  { card: "P1-T4", name: "simultaneous reservation and maintenance", total: 10, requested: 5, available: 4, shortfall: 1, usages: [["10:00", "12:00", 4, "reserved"], ["11:00", "13:00", 2, "unavailable"]] },
  { card: "P1-T5", name: "usages touching query boundaries excluded", total: 10, requested: 0, available: 10, shortfall: 0, usages: [["09:00", "10:00", 9, "reserved"], ["14:00", "15:00", 9, "unavailable"]] },
  { card: "P1-T6", name: "partial overlaps at both boundaries included", total: 10, requested: 0, available: 5, shortfall: 0, usages: [["09:00", "10:01", 4, "reserved"], ["13:59", "15:00", 5, "unavailable"]] },
  { card: "P1-T7", name: "request just below availability", total: 10, requested: 5, available: 6, shortfall: 0, usages: [["10:00", "12:00", 4, "reserved"]] },
  { card: "P1-T8", name: "request exactly at availability", total: 10, requested: 6, available: 6, shortfall: 0, usages: [["10:00", "12:00", 4, "reserved"]] },
  { card: "P1-T9", name: "request just above availability", total: 10, requested: 7, available: 6, shortfall: 1, usages: [["10:00", "12:00", 4, "reserved"]] },
  { card: "P1-T11", name: "released and removed records ignored", total: 10, requested: 0, available: 10, shortfall: 0, usages: [["10:00", "12:00", 4, "reserved", "RELEASED"], ["11:00", "13:00", 3, "unavailable", "REMOVED"]] },
  { card: "P1-T13", name: "zero inventory reports full shortage", total: 0, requested: 1, available: 0, shortfall: 1, usages: [] },
] as const;

describe("P1 independent acceptance cards (real throwaway Postgres, auth stubbed)", () => {
  for (const scenario of scenarios) {
    it(`${scenario.card} ${scenario.name}`, async () => {
      const id = await type("BULK", scenario.total);
      for (const input of scenario.usages) await usage(id, input);
      const before = await snapshot(id);
      expect(await check(id, scenario.requested)).toMatchObject({ kind: "BULK", totalQuantity: scenario.total, availableQuantity: scenario.available, shortfallQuantity: scenario.shortfall });
      expect(await snapshot(id)).toEqual(before);
    });
  }
  it("P1-T10 excludes a serialized unit once when both reserved and unavailable", async () => {
    const id = await type("SERIALIZED");
    const units = await sql`insert into equipment.equipment_units (equipment_type_id, label, created_by, updated_by)
      values (${id}, 'P1-PROJ-01', ${ACTOR}, ${ACTOR}), (${id}, 'P1-PROJ-02', ${ACTOR}, ${ACTOR}),
             (${id}, 'P1-PROJ-03', ${ACTOR}, ${ACTOR}), (${id}, 'P1-PROJ-04', ${ACTOR}, ${ACTOR}) returning id`;
    await sql`insert into equipment.unit_reservations
      (unit_id, event_id, event_reference, starts_at, ends_at, created_by, updated_by)
      values (${units[0]!.id}, ${randomUUID()}, 'EVT-P1-UNIT', ${at("10:00")}, ${at("12:00")}, ${ACTOR}, ${ACTOR})`;
    await sql`insert into equipment.unavailability
      (equipment_type_id, unit_id, starts_at, ends_at, reason, created_by, updated_by)
      values (${id}, ${units[0]!.id}, ${at("11:00")}, ${at("13:00")}, 'Lamp repair', ${ACTOR}, ${ACTOR})`;
    const before = await snapshot(id);
    expect(await check(id, 4)).toMatchObject({ kind: "SERIALIZED", totalQuantity: 4, availableQuantity: 3, shortfallQuantity: 1 });
    expect(await snapshot(id)).toEqual(before);
  });
  it("P1-T12 repeated success and shortage checks leave all equipment rows unchanged", async () => {
    const id = await type();
    await usage(id, ["10:00", "12:00", 4, "reserved"]);
    await usage(id, ["11:00", "13:00", 2, "unavailable"]);
    const before = await snapshot(id);
    for (const requested of [0, 4, 5, 0, 5]) {
      expect(await check(id, requested)).toMatchObject({ availableQuantity: 4, shortfallQuantity: Math.max(requested - 4, 0) });
    }
    expect(await snapshot(id)).toEqual(before);
  });
  it("P1-T15 invalid period and quantity name the refused field and store nothing", async () => {
    const id = await type();
    const before = await snapshot(id);
    for (const [query, field] of [
      [{ startsAt: at("10:00"), endsAt: at("10:00"), requestedQuantity: "1" }, "endsAt"],
      [{ startsAt: at("14:00"), endsAt: at("10:00"), requestedQuantity: "1" }, "endsAt"],
      [{ startsAt: "invalid", endsAt: at("14:00"), requestedQuantity: "1" }, "startsAt"],
      [{ startsAt: at("10:00"), endsAt: at("14:00"), requestedQuantity: "-1" }, "requestedQuantity"],
      [{ startsAt: at("10:00"), endsAt: at("14:00"), requestedQuantity: "1.5" }, "requestedQuantity"],
    ] as const) {
      const response = await request(app).get(`/api/v1/equipment/types/${id}/availability`).set(bearer).query(query);
      expect(response.status).toBe(400);
      expect(response.body.error).toMatchObject({ code: "VALIDATION_FAILED" });
      expect(response.body.error.fields).toContainEqual(expect.objectContaining({ field }));
      expect(await snapshot(id)).toEqual(before);
    }
  });
  it("P1-T16 non-technical-support roles cannot check quantities or change stock", async () => {
    const id = await type();
    const before = await snapshot(id);
    for (const role of ["EVENT_COORDINATOR", "EVENT_ORGANISER", "VENUE_STAFF", "ATTENDEE"]) {
      vi.mocked(resolveCurrentUser).mockResolvedValue({ id: ACTOR, email: "p1@connectsphere.test", role } as never);
      const response = await request(app).get(`/api/v1/equipment/types/${id}/availability`).set(bearer)
        .query({ startsAt: at("10:00"), endsAt: at("14:00"), requestedQuantity: 1 });
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("ROLE_NOT_AUTHORISED");
      expect(await snapshot(id)).toEqual(before);
    }
  });

});
