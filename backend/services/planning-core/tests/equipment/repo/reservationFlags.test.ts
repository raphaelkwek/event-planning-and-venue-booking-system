import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { testDb } from "../../support/testDb.js";
import {
  actorsWithPrefix,
  cleanLineFixtures,
  createBulkType,
  createEvent,
  insertLineDirect,
} from "../../support/lineFixtures.js";
import { EVENT_END, EVENT_START } from "../../support/eventDates.js";
import { reserveLine } from "../../../src/modules/equipment/repo/reservations.js";
import { releaseLine } from "../../../src/modules/equipment/repo/releases.js";
import {
  flagReservations,
  outstandingReservationFlags,
  reservationsForImpact,
} from "../../../src/modules/equipment/repo/reservationFlags.js";
import { equipmentArrangementsForEvent } from "../../../src/modules/equipment/repo/eventArrangements.js";

/**
 * S3 against real Postgres: the reservations an approved change is assessed
 * against, the Flagged for review flags it stores on them, and the flags still
 * outstanding (AC8), which F5 also reads (AC9).
 */

const sql = testDb();
const A = actorsWithPrefix("0b730000");
const TS = { userId: A.ts, role: "TECH_SUPPORT_STAFF" as const };
let event: { id: string; reference: string; name: string };
let chairs: { id: string; name: string };
let tables: { id: string; name: string };

const clean = () => cleanLineFixtures(sql, [A.org], [A.ts]);
beforeEach(async () => {
  await clean();
  event = await createEvent(sql, { ownerId: A.org, coordinatorId: A.c1, name: "S3 repo event" });
  chairs = await createBulkType(sql, A.ts, "S3R Chairs", 20);
  tables = await createBulkType(sql, A.ts, "S3R Tables", 20);
});
afterAll(async () => {
  try {
    await clean();
  } finally {
    await sql.end();
  }
});

async function reserved(typeId: string, quantity: number, on = event) {
  const lineId = await insertLineDirect(sql, { event: on, equipmentTypeId: typeId, requestedBy: A.c1, status: "CONFIRMED", quantity });
  const outcome = await sql.begin((tx) => reserveLine(tx, lineId, { quantity: null, partial: false }, TS));
  if (!outcome.ok) throw new Error(`fixture reserve failed: ${outcome.code}`);
  return { lineId, reservationId: outcome.reservation.id };
}

const flag = (reservationId: string, reason = "The event moved.") => ({
  reservationId,
  flag: "FLAGGED_FOR_REVIEW" as const,
  reason,
  details: { bookedStartsAt: EVENT_START },
});

describe("reservationsForImpact (S3)", () => {
  it("reads the event's active reservations with their type, line, quantity, period and who reserved them", async () => {
    const a = await reserved(chairs.id, 4);
    const other = await createEvent(sql, { ownerId: A.org, coordinatorId: A.c1, name: "S3 repo other event" });
    await reserved(chairs.id, 2, other);

    expect(await sql.begin((tx) => reservationsForImpact(tx, event.id))).toEqual([
      {
        id: a.reservationId,
        lineId: a.lineId,
        equipmentTypeName: chairs.name,
        reservedQuantity: 4,
        startsAt: new Date(EVENT_START).toISOString(),
        endsAt: new Date(EVENT_END).toISOString(),
        reservedBy: A.ts,
      },
    ]);
  });

  it("leaves out released reservations", async () => {
    const a = await reserved(chairs.id, 4);
    const b = await reserved(tables.id, 2);
    await sql.begin((tx) => releaseLine(tx, a.lineId, "Not needed", TS));
    expect((await sql.begin((tx) => reservationsForImpact(tx, event.id))).map((r) => r.id)).toEqual([b.reservationId]);
  });
});

describe("flagReservations and outstandingReservationFlags (S3, AC8)", () => {
  it("sets the column and records why, and the event shows the flag", async () => {
    const { reservationId } = await reserved(chairs.id, 4);
    const changeRequestId = randomUUID();
    await sql.begin((tx) => flagReservations(tx, event.id, changeRequestId, [flag(reservationId)]));

    const [row] = await sql`select flagged_for_review from equipment.reservations where id = ${reservationId}`;
    expect(row!.flagged_for_review).toBe(true);
    const stored = await sql`
      select reservation_id, event_id, change_request_id, flag, reason, details from equipment.reservation_flags
      where reservation_id = ${reservationId}`;
    expect(stored).toEqual([
      {
        reservation_id: reservationId,
        event_id: event.id,
        change_request_id: changeRequestId,
        flag: "FLAGGED_FOR_REVIEW",
        reason: "The event moved.",
        details: { bookedStartsAt: EVENT_START },
      },
    ]);

    const outstanding = await outstandingReservationFlags(sql, event.id);
    expect(outstanding).toMatchObject([
      { reservationId, equipmentTypeName: chairs.name, flag: "FLAGGED_FOR_REVIEW", reason: "The event moved." },
    ]);
    expect(Number.isNaN(Date.parse(outstanding[0]!.flaggedAt))).toBe(false);
  });

  it("does nothing for an empty list", async () => {
    await sql.begin((tx) => flagReservations(tx, event.id, randomUUID(), []));
    expect(await sql`select 1 from equipment.reservation_flags where event_id = ${event.id}`).toHaveLength(0);
  });

  it("leaves out released reservations and flags that have since been cleared", async () => {
    const released = await reserved(chairs.id, 4);
    const cleared = await reserved(tables.id, 2);
    const third = await createBulkType(sql, A.ts, "S3R Stages", 5);
    const still = await reserved(third.id, 1);
    await sql.begin((tx) =>
      flagReservations(tx, event.id, randomUUID(), [flag(released.reservationId), flag(cleared.reservationId), flag(still.reservationId)])
    );
    await sql.begin((tx) => releaseLine(tx, released.lineId, "Not needed", TS));
    await sql`update equipment.reservations set flagged_for_review = false where id = ${cleared.reservationId}`;

    expect((await outstandingReservationFlags(sql, event.id)).map((f) => f.reservationId)).toEqual([still.reservationId]);
  });
});

describe("equipmentArrangementsForEvent (F5, AC9)", () => {
  it("gives a line Flagged for review when its active reservation is flagged", async () => {
    const flagged = await reserved(chairs.id, 4);
    const fine = await reserved(tables.id, 2);
    const unreserved = await insertLineDirect(sql, { event, equipmentTypeId: chairs.id, requestedBy: A.c1, status: "CONFIRMED" });
    await sql.begin((tx) => flagReservations(tx, event.id, randomUUID(), [flag(flagged.reservationId)]));

    const lines = await sql.begin((tx) => equipmentArrangementsForEvent(tx, event.id));
    const flagsOf = (id: string) => lines.find((line) => line.id === id)!.flags;
    expect(flagsOf(flagged.lineId)).toEqual(["FLAGGED_FOR_REVIEW"]);
    expect(flagsOf(fine.lineId)).toEqual([]);
    expect(flagsOf(unreserved)).toEqual([]);
  });
});
