import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { testDb } from "../../support/testDb.js";
import {
  actorsWithPrefix,
  cleanLineFixtures,
  createBulkType,
  createEvent,
  createSerializedType,
  insertLineDirect,
  reserveBulkDirect,
} from "../../support/lineFixtures.js";
import { EVENT_END, EVENT_START } from "../../support/eventDates.js";
import { reserveLine } from "../../../src/modules/equipment/repo/reservations.js";
import { InsufficientEquipmentError } from "../../../src/modules/equipment/domain/availability.js";

const sql = testDb();
const A = actorsWithPrefix("0b500000");
const TS = { userId: A.ts, role: "TECH_SUPPORT_STAFF" as const };
let event: { id: string; reference: string; name: string };
let chairs: { id: string };
let projectors: { id: string };

const clean = () => cleanLineFixtures(sql, [A.org], [A.ts]);
beforeEach(async () => {
  await clean();
  event = await createEvent(sql, { ownerId: A.org, coordinatorId: A.c1, name: "Q1 repo event" });
  chairs = await createBulkType(sql, A.ts, "Q1R Chairs", 10);
  projectors = await createSerializedType(sql, A.ts, "Q1R Projectors", ["P-01", "P-02", "P-03"]);
});
afterAll(async () => {
  await clean();
  await sql.end();
});

const confirmed = (typeId: string, quantity: number) =>
  insertLineDirect(sql, { event, equipmentTypeId: typeId, requestedBy: A.c1, status: "CONFIRMED", quantity });
const reserve = (lineId: string, body = { quantity: null as number | null, partial: false }) =>
  sql.begin((tx) => reserveLine(tx, lineId, body, TS));

describe("reserveLine (Q1)", () => {
  it("reserves bulk stock under one reservation and marks the line Reserved", async () => {
    const id = await confirmed(chairs.id, 4);
    const outcome = await reserve(id);

    expect(outcome).toMatchObject({ ok: true, reservation: { kind: "BULK", requestedQuantity: 4, reservedQuantity: 4 } });
    const [bulk] = await sql`select quantity, reservation_id from equipment.bulk_reservations where equipment_type_id = ${chairs.id}`;
    expect(bulk).toMatchObject({ quantity: 4, reservation_id: outcome.ok ? outcome.reservation.id : "" });
    expect((await sql`select status from equipment.equipment_request_lines where id = ${id}`)[0]!.status).toBe("RESERVED");
  });

  it("reserves serialized units in label order under one reservation", async () => {
    const outcome = await reserve(await confirmed(projectors.id, 2));
    const units = await sql`
      select u.label from equipment.unit_reservations r join equipment.equipment_units u on u.id = r.unit_id
      where r.reservation_id = ${outcome.ok ? outcome.reservation.id : null} order by u.label
    `;
    expect(units.map((u) => u.label)).toEqual(["P-01", "P-02"]);
  });

  it("throws the shortfall and writes nothing when serialized stock runs out", async () => {
    const id = await confirmed(projectors.id, 4);
    await expect(reserve(id)).rejects.toMatchObject({ requested: 4, available: 3, shortfall: 1 });
    expect((await sql`select count(*)::int as n from equipment.reservations where request_line_id = ${id}`)[0]!.n).toBe(0);
    expect((await sql`select count(*)::int as n from equipment.unit_reservations where unit_id in (select id from equipment.equipment_units where equipment_type_id = ${projectors.id})`)[0]!.n).toBe(0);
  });

  it("throws the shortfall and writes nothing when bulk stock runs out", async () => {
    await reserveBulkDirect(sql, { equipmentTypeId: chairs.id, quantity: 7, startsAt: EVENT_START, endsAt: EVENT_END, actorUserId: A.ts });
    const id = await confirmed(chairs.id, 4);
    await expect(reserve(id)).rejects.toBeInstanceOf(InsufficientEquipmentError);
    expect((await sql`select status from equipment.equipment_request_lines where id = ${id}`)[0]!.status).toBe("CONFIRMED");
  });

  it("refuses a line that is not reservable, naming its status", async () => {
    const id = await insertLineDirect(sql, { event, equipmentTypeId: chairs.id, requestedBy: A.c1, status: "UNDER_REVIEW" });
    expect(await reserve(id)).toEqual({ ok: false, code: "LINE_NOT_RESERVABLE", status: "UNDER_REVIEW" });
  });

  it("reports a line that does not exist", async () => {
    expect(await reserve("00000000-0000-4000-8000-0000000000ff")).toEqual({ ok: false, code: "GONE" });
  });

  it("refuses a lower quantity without partial, and accepts it with partial", async () => {
    const id = await confirmed(chairs.id, 5);
    expect(await reserve(id, { quantity: 3, partial: false })).toMatchObject({ ok: false, code: "PARTIAL_NOT_CONFIRMED" });
    expect(await reserve(id, { quantity: 3, partial: true })).toMatchObject({
      ok: true,
      reservation: { requestedQuantity: 5, reservedQuantity: 3 },
    });
  });

  it("refuses a quantity above the requested one on the field", async () => {
    expect(await reserve(await confirmed(chairs.id, 5), { quantity: 6, partial: true })).toMatchObject({
      ok: false,
      code: "VALIDATION_FAILED",
    });
  });
});
