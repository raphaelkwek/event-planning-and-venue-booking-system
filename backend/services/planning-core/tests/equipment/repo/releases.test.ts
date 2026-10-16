import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { testDb } from "../../support/testDb.js";
import {
  actorsWithPrefix,
  cleanLineFixtures,
  createBulkType,
  createEvent,
  createSerializedType,
  insertLineDirect,
} from "../../support/lineFixtures.js";
import { reserveLine } from "../../../src/modules/equipment/repo/reservations.js";
import { releaseEventReservations, releaseLine, releaseReservation } from "../../../src/modules/equipment/repo/releases.js";

const sql = testDb();
const A = actorsWithPrefix("0b700000");
const TS = { userId: A.ts, role: "TECH_SUPPORT_STAFF" as const };
let event: { id: string; reference: string; name: string };
let chairs: { id: string };
let projectors: { id: string };

const clean = () => cleanLineFixtures(sql, [A.org], [A.ts]);
beforeEach(async () => {
  await clean();
  event = await createEvent(sql, { ownerId: A.org, coordinatorId: A.c1, name: "Q2 repo event" });
  chairs = await createBulkType(sql, A.ts, "Q2R Chairs", 10);
  projectors = await createSerializedType(sql, A.ts, "Q2R Projectors", ["P-01", "P-02", "P-03"]);
});
afterAll(async () => {
  await clean();
  await sql.end();
});

async function reserved(typeId: string, quantity: number, changes: Record<string, unknown> = {}) {
  const id = await insertLineDirect(sql, { event, equipmentTypeId: typeId, requestedBy: A.c1, status: "CONFIRMED", quantity, ...changes });
  const outcome = await sql.begin((tx) => reserveLine(tx, id, { quantity: null, partial: false }, TS));
  if (!outcome.ok) throw new Error(`fixture reserve failed: ${outcome.code}`);
  return { lineId: id, reservationId: outcome.reservation.id };
}
const release = (lineId: string, reason = "Not needed") => sql.begin((tx) => releaseLine(tx, lineId, reason, TS));

describe("releaseLine (Q2)", () => {
  it("releases bulk stock, keeps the record, and puts the line back to Confirmed", async () => {
    const { lineId, reservationId } = await reserved(chairs.id, 4);
    const outcome = await release(lineId, "Event moved");

    expect(outcome).toMatchObject({
      ok: true,
      reservation: { id: reservationId, status: "RELEASED", releasedBy: A.ts, releaseReason: "Event moved" },
      line: { status: "CONFIRMED", reservation: null },
    });
    const [bulk] = await sql`select status from equipment.bulk_reservations where reservation_id = ${reservationId}`;
    expect(bulk!.status).toBe("RELEASED");
    const [history] = await sql`
      select previous_status, new_status, details from equipment.request_line_history
      where line_id = ${lineId} order by occurred_at desc, created_at desc limit 1`;
    expect(history).toMatchObject({ previous_status: "RESERVED", new_status: "CONFIRMED", details: { reservationId, released: true, reason: "Event moved" } });
  });

  it("releases every unit of a serialized reservation", async () => {
    const { lineId, reservationId } = await reserved(projectors.id, 2);
    await release(lineId);
    const units = await sql`select status from equipment.unit_reservations where reservation_id = ${reservationId}`;
    expect(units.map((u) => u.status)).toEqual(["RELEASED", "RELEASED"]);
  });

  it("puts a Substituted line back to Substituted", async () => {
    const { lineId } = await reserved(projectors.id, 2, { status: "SUBSTITUTED", substitute: { typeId: chairs.id, quantity: 5 } });
    expect(await release(lineId)).toMatchObject({ ok: true, line: { status: "SUBSTITUTED", substituteQuantity: 5 } });
  });

  it("refuses a line that is not Reserved and changes nothing", async () => {
    const id = await insertLineDirect(sql, { event, equipmentTypeId: chairs.id, requestedBy: A.c1, status: "CONFIRMED" });
    expect(await release(id)).toEqual({ ok: false, code: "LINE_NOT_RELEASABLE", status: "CONFIRMED" });
  });

  it("reports a line that does not exist", async () => {
    expect(await release("00000000-0000-4000-8000-0000000000ff")).toEqual({ ok: false, code: "GONE" });
  });

  it("a second release is refused and keeps the first release's timestamp", async () => {
    const { lineId, reservationId } = await reserved(chairs.id, 4);
    await release(lineId, "First");
    const [before] = await sql`select released_at, release_reason from equipment.reservations where id = ${reservationId}`;
    expect(await release(lineId, "Second")).toMatchObject({ ok: false, code: "LINE_NOT_RELEASABLE" });
    const [after] = await sql`select released_at, release_reason from equipment.reservations where id = ${reservationId}`;
    expect(after).toEqual(before);
  });
});

describe("releaseReservation (Q2)", () => {
  it("returns ALREADY_RELEASED for a released reservation and writes nothing", async () => {
    const { lineId, reservationId } = await reserved(chairs.id, 4);
    await release(lineId, "First");
    const [before] = await sql`select * from equipment.reservations where id = ${reservationId}`;
    const outcome = await sql.begin((tx) => releaseReservation(tx, reservationId, TS, "Again"));
    expect(outcome).toEqual({ ok: false, code: "ALREADY_RELEASED" });
    const [after] = await sql`select * from equipment.reservations where id = ${reservationId}`;
    expect(after).toEqual(before);
  });
});

describe("releaseEventReservations (Q2, for F4)", () => {
  it("releases every active reservation of the event and leaves other lines alone", async () => {
    const a = await reserved(chairs.id, 4);
    const b = await reserved(projectors.id, 1);
    const confirmed = await insertLineDirect(sql, { event, equipmentTypeId: chairs.id, requestedBy: A.c1, status: "CONFIRMED" });

    const released = await sql.begin((tx) => releaseEventReservations(tx, event.id, TS, "Event cancelled"));

    expect(released.map((r) => r.reservation.id).sort()).toEqual([a.reservationId, b.reservationId].sort());
    const rows = await sql`select status, release_reason from equipment.reservations where id in ${sql([a.reservationId, b.reservationId])}`;
    expect(rows.every((r) => r.status === "RELEASED" && r.release_reason === "Event cancelled")).toBe(true);
    expect((await sql`select status from equipment.equipment_request_lines where id = ${confirmed}`)[0]!.status).toBe("CONFIRMED");
  });
});
