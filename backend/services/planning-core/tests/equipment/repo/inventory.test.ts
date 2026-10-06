import { afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { testDb } from "../../support/testDb.js";
import {
  availableUnits,
  lockEquipmentType,
  peakUse,
  reserveBulk,
  reserveUnit,
  type BulkReservationInput,
  type UnitReservationInput,
} from "../../../src/modules/equipment/repo/inventory.js";
import { InsufficientEquipmentError, UnitAlreadyReservedError } from "../../../src/modules/equipment/domain/availability.js";

/**
 * EN-02.2 done-checks (ADR-0006, implementation.md §4.6), against real
 * Postgres. The time-agnostic counter is gone: serialized units carry their own
 * reservations, guarded by a per-unit exclusion constraint, and bulk stock is
 * checked by peak concurrent use under the equipment-type row lock.
 *
 * Every test makes its own equipment type, so none depends on or disturbs another's rows.
 */

const sql = testDb();
const ACTOR = "a4444444-0000-0000-0000-000000000001";

afterAll(async () => {
  await sql.end();
});

/** A time on Monday 2 Nov 2026, Singapore time. */
const at = (hhmm: string) => new Date(`2026-11-02T${hhmm}:00+08:00`);
const period = (from: string, until: string) => ({ startsAt: at(from), endsAt: at(until) });

async function bulkType(totalQuantity: number): Promise<string> {
  const [row] = await sql<{ id: string }[]>`
    insert into equipment.equipment_types (name, kind, total_quantity, created_by, updated_by)
    values (${`EN-02.2 Chairs ${randomUUID().slice(0, 8)}`}, 'BULK', ${totalQuantity}, ${ACTOR}, ${ACTOR})
    returning id
  `;
  return row!.id;
}

async function serializedType(unitLabels: string[]): Promise<{ typeId: string; units: Record<string, string> }> {
  const [type] = await sql<{ id: string }[]>`
    insert into equipment.equipment_types (name, kind, created_by, updated_by)
    values (${`EN-02.2 Projector ${randomUUID().slice(0, 8)}`}, 'SERIALIZED', ${ACTOR}, ${ACTOR})
    returning id
  `;
  const units: Record<string, string> = {};
  for (const label of unitLabels) {
    const [unit] = await sql<{ id: string }[]>`
      insert into equipment.equipment_units (equipment_type_id, label, created_by, updated_by)
      values (${type!.id}, ${label}, ${ACTOR}, ${ACTOR})
      returning id
    `;
    units[label] = unit!.id;
  }
  return { typeId: type!.id, units };
}

function bulk(typeId: string, quantity: number, when = period("10:00", "12:00")): BulkReservationInput {
  return {
    equipmentTypeId: typeId,
    eventId: randomUUID(),
    eventReference: `EVT-${randomUUID().slice(0, 6)}`,
    quantity,
    ...when,
    actorUserId: ACTOR,
  };
}

function unit(unitId: string, when = period("10:00", "12:00")): UnitReservationInput {
  return { unitId, eventId: randomUUID(), eventReference: `EVT-${randomUUID().slice(0, 6)}`, ...when, actorUserId: ACTOR };
}

const inTx = <T>(work: (tx: Parameters<Parameters<typeof sql.begin>[0]>[0]) => Promise<T>) =>
  sql.begin((tx) => work(tx)) as Promise<T>;

async function unitReservationCount(unitId: string): Promise<number> {
  const [row] = await sql<{ n: number }[]>`
    select count(*)::int as n from equipment.unit_reservations where unit_id = ${unitId} and status = 'RESERVED'
  `;
  return row!.n;
}

describe("serialized units: never reserved twice for overlapping periods (Q1)", () => {
  it("refuses a second reservation of the same unit for an overlapping period, and stores nothing", async () => {
    const { units } = await serializedType(["PROJ-01"]);
    await inTx((tx) => reserveUnit(tx, unit(units["PROJ-01"]!)));

    const refused = inTx((tx) => reserveUnit(tx, unit(units["PROJ-01"]!, period("11:00", "13:00"))));

    await expect(refused).rejects.toBeInstanceOf(UnitAlreadyReservedError);
    await expect(refused).rejects.toMatchObject({ unitLabel: "PROJ-01" });
    expect(await unitReservationCount(units["PROJ-01"]!)).toBe(1);
  });

  it("reuses a unit for touching or separate periods", async () => {
    const { units } = await serializedType(["PROJ-01"]);
    await inTx((tx) => reserveUnit(tx, unit(units["PROJ-01"]!, period("10:00", "12:00"))));
    await inTx((tx) => reserveUnit(tx, unit(units["PROJ-01"]!, period("12:00", "14:00"))));
    await inTx((tx) => reserveUnit(tx, unit(units["PROJ-01"]!, period("16:00", "18:00"))));

    expect(await unitReservationCount(units["PROJ-01"]!)).toBe(3);
  });

  it("frees a unit once its reservation is released (Q2)", async () => {
    const { units } = await serializedType(["PROJ-01"]);
    const first = await inTx((tx) => reserveUnit(tx, unit(units["PROJ-01"]!)));
    await sql`update equipment.unit_reservations set status = 'RELEASED' where id = ${first.id}`;

    await inTx((tx) => reserveUnit(tx, unit(units["PROJ-01"]!)));

    expect(await unitReservationCount(units["PROJ-01"]!)).toBe(1);
  });

  it("lets exactly one of two simultaneous reservations of the same unit through", async () => {
    const { units } = await serializedType(["PROJ-01"]);

    const results = await Promise.allSettled([
      inTx((tx) => reserveUnit(tx, unit(units["PROJ-01"]!))),
      inTx((tx) => reserveUnit(tx, unit(units["PROJ-01"]!))),
    ]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const refused = results.find((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(refused?.reason).toBeInstanceOf(UnitAlreadyReservedError);
    expect(await unitReservationCount(units["PROJ-01"]!)).toBe(1);
  });
});

describe("availableUnits: units free for the whole window (P1, Q1)", () => {
  it("leaves out units reserved or unavailable for any part of the window, and keeps ones that only touch it", async () => {
    const { typeId, units } = await serializedType(["PROJ-01", "PROJ-02", "PROJ-03", "PROJ-04"]);
    await inTx((tx) => reserveUnit(tx, unit(units["PROJ-01"]!, period("11:00", "11:30"))));
    await inTx((tx) => reserveUnit(tx, unit(units["PROJ-02"]!, period("12:00", "13:00"))));
    await sql`
      insert into equipment.unavailability (equipment_type_id, unit_id, starts_at, ends_at, reason, created_by, updated_by)
      values (${typeId}, ${units["PROJ-03"]!}, ${at("08:00")}, ${at("10:30")}, 'Lamp replacement', ${ACTOR}, ${ACTOR})
    `;

    const free = await inTx((tx) => availableUnits(tx, typeId, period("10:00", "12:00")));

    expect(free.map((u) => u.label)).toEqual(["PROJ-02", "PROJ-04"]);
  });

  it("ignores released reservations and removed unavailability", async () => {
    const { typeId, units } = await serializedType(["PROJ-01"]);
    const reserved = await inTx((tx) => reserveUnit(tx, unit(units["PROJ-01"]!)));
    await sql`update equipment.unit_reservations set status = 'RELEASED' where id = ${reserved.id}`;
    await sql`
      insert into equipment.unavailability (equipment_type_id, unit_id, starts_at, ends_at, reason, status, created_by, updated_by)
      values (${typeId}, ${units["PROJ-01"]!}, ${at("09:00")}, ${at("13:00")}, 'Repaired early', 'REMOVED', ${ACTOR}, ${ACTOR})
    `;

    const free = await inTx((tx) => availableUnits(tx, typeId, period("10:00", "12:00")));

    expect(free.map((u) => u.label)).toEqual(["PROJ-01"]);
  });
});

describe("bulk stock: never reserved beyond the total at any moment (Q1, P2)", () => {
  it("allows reservations up to the total at their busiest moment, and refuses one more with the shortfall", async () => {
    const typeId = await bulkType(10);
    await inTx((tx) => reserveBulk(tx, bulk(typeId, 6, period("10:00", "12:00"))));
    await inTx((tx) => reserveBulk(tx, bulk(typeId, 4, period("11:00", "13:00"))));

    const refused = inTx((tx) => reserveBulk(tx, bulk(typeId, 1, period("11:30", "12:00"))));

    await expect(refused).rejects.toBeInstanceOf(InsufficientEquipmentError);
    await expect(refused).rejects.toMatchObject({ requested: 1, available: 0, shortfall: 1 });
    expect(await inTx((tx) => peakUse(tx, typeId, period("09:00", "17:00")))).toBe(10);
  });

  it("does not count back-to-back reservations as simultaneous (peak use, CQ-02)", async () => {
    const typeId = await bulkType(5);
    await inTx((tx) => reserveBulk(tx, bulk(typeId, 5, period("10:00", "12:00"))));

    const next = await inTx((tx) => reserveBulk(tx, bulk(typeId, 5, period("12:00", "14:00"))));

    expect(next.quantity).toBe(5);
  });

  it("counts stock recorded as unavailable as in use", async () => {
    const typeId = await bulkType(10);
    await sql`
      insert into equipment.unavailability (equipment_type_id, quantity, starts_at, ends_at, reason, created_by, updated_by)
      values (${typeId}, 3, ${at("09:00")}, ${at("18:00")}, 'Broken legs', ${ACTOR}, ${ACTOR})
    `;

    await expect(inTx((tx) => reserveBulk(tx, bulk(typeId, 8)))).rejects.toMatchObject({ available: 7, shortfall: 1 });
    await expect(inTx((tx) => reserveBulk(tx, bulk(typeId, 7)))).resolves.toMatchObject({ quantity: 7 });
  });

  it("ignores released reservations", async () => {
    const typeId = await bulkType(4);
    const first = await inTx((tx) => reserveBulk(tx, bulk(typeId, 4)));
    await sql`update equipment.bulk_reservations set status = 'RELEASED' where id = ${first.id}`;

    await expect(inTx((tx) => reserveBulk(tx, bulk(typeId, 4)))).resolves.toMatchObject({ quantity: 4 });
  });

  it("lets exactly one of two simultaneous reservations of the last unit through", async () => {
    const typeId = await bulkType(1);

    const results = await Promise.allSettled([
      inTx((tx) => reserveBulk(tx, bulk(typeId, 1))),
      inTx((tx) => reserveBulk(tx, bulk(typeId, 1))),
    ]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const refused = results.find((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(refused?.reason).toBeInstanceOf(InsufficientEquipmentError);
    expect(await inTx((tx) => peakUse(tx, typeId, period("09:00", "17:00")))).toBe(1);
  });

  it("refuses bulk reservations of a serialized type, and of a type that does not exist", async () => {
    const { typeId } = await serializedType(["PROJ-01"]);

    await expect(inTx((tx) => reserveBulk(tx, bulk(typeId, 1)))).rejects.toThrow(/not bulk stock/);
    await expect(inTx((tx) => reserveBulk(tx, bulk(randomUUID(), 1)))).rejects.toThrow(/no such equipment type/i);
  });
});

describe("lockEquipmentType", () => {
  it("returns the type's kind and total, or null when there is no such type", async () => {
    const typeId = await bulkType(12);

    await expect(inTx((tx) => lockEquipmentType(tx, typeId))).resolves.toEqual({ kind: "BULK", totalQuantity: 12 });
    await expect(inTx((tx) => lockEquipmentType(tx, randomUUID()))).resolves.toBeNull();
  });
});

describe("table rules the database enforces", () => {
  it("requires a total for bulk stock and none for a serialized type, never below zero", async () => {
    await expect(
      sql`insert into equipment.equipment_types (name, kind) values ('No total', 'BULK')`,
    ).rejects.toMatchObject({ code: "23514" });
    await expect(
      sql`insert into equipment.equipment_types (name, kind, total_quantity) values ('Has total', 'SERIALIZED', 3)`,
    ).rejects.toMatchObject({ code: "23514" });
    await expect(
      sql`insert into equipment.equipment_types (name, kind, total_quantity) values ('Negative', 'BULK', -1)`,
    ).rejects.toMatchObject({ code: "23514" });
  });

  it("allows units only on a serialized type, and bulk reservations only on bulk stock", async () => {
    const bulkTypeId = await bulkType(5);
    const { typeId: serializedTypeId } = await serializedType([]);

    await expect(
      sql`insert into equipment.equipment_units (equipment_type_id, label) values (${bulkTypeId}, 'CHAIR-1')`,
    ).rejects.toMatchObject({ code: "23503" });
    await expect(
      sql`insert into equipment.bulk_reservations (equipment_type_id, event_id, event_reference, quantity, starts_at, ends_at, status)
          values (${serializedTypeId}, ${randomUUID()}, 'EVT-X', 1, ${at("10:00")}, ${at("11:00")}, 'RESERVED')`,
    ).rejects.toMatchObject({ code: "23503" });
  });

  it("records unavailability as either one unit or a quantity, with a reason, ending after it starts", async () => {
    const typeId = await bulkType(5);
    const insert = (fields: { quantity: number | null; reason: string; from: string; until: string }) => sql`
      insert into equipment.unavailability (equipment_type_id, quantity, starts_at, ends_at, reason)
      values (${typeId}, ${fields.quantity}, ${at(fields.from)}, ${at(fields.until)}, ${fields.reason})
    `;

    await expect(insert({ quantity: null, reason: "Neither", from: "10:00", until: "11:00" })).rejects.toMatchObject({ code: "23514" });
    await expect(insert({ quantity: 2, reason: "  ", from: "10:00", until: "11:00" })).rejects.toMatchObject({ code: "23514" });
    // An end before the start can't form the generated range: Postgres refuses it as a data exception.
    await expect(insert({ quantity: 2, reason: "Backwards", from: "11:00", until: "10:00" })).rejects.toMatchObject({ code: "22000" });
    await expect(insert({ quantity: 2, reason: "No length", from: "10:00", until: "10:00" })).rejects.toMatchObject({ code: "23514" });
    await expect(insert({ quantity: 2, reason: "Cleaning", from: "10:00", until: "11:00" })).resolves.toBeDefined();
  });
});
