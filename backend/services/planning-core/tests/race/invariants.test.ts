import { afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { testDb } from "../support/testDb.js";
import { isThrowawayDatabase, losers, race, winners } from "../support/race.js";
import { insertVenueSlot, type NewVenueSlot } from "../../src/modules/venue/repo/slots.js";
import { VenueSlotConflictError } from "../../src/modules/venue/domain/slotConflict.js";
import { reserveBulk, reserveUnit } from "../../src/modules/equipment/repo/inventory.js";
import { InsufficientEquipmentError, UnitAlreadyReservedError } from "../../src/modules/equipment/domain/availability.js";

/**
 * EN-02.3 (ADR-0006, implementation.md §8.1): fifty attempts at exactly the
 * same moment, each on its own connection. The database, not our code, must
 * let exactly one through when they compete, and all of them when they don't.
 *
 * These are the "exactly one succeeds" checks behind N1 (venue slots) and Q1
 * (the last unit of equipment). They run only against a throwaway database
 * (CI's, from EN-06.1); against any other database the suite is skipped.
 */

const ATTEMPTS = 50;
const ACTOR = "a5555555-0000-0000-0000-000000000001";
const sql = testDb();

afterAll(async () => {
  await sql.end();
});

/** A time on Monday 2 Nov 2026, Singapore time. */
const at = (hhmm: string) => new Date(`2026-11-02T${hhmm}:00+08:00`);
const minutesAfter = (start: Date, minutes: number) => new Date(start.getTime() + minutes * 60_000);

async function newVenue(): Promise<string> {
  const [row] = await sql<{ id: string }[]>`
    insert into venue.venues (name, building, max_capacity, layouts, operating_hours, created_by, updated_by)
    values (${`EN-02.3 Race Room ${randomUUID().slice(0, 8)}`}, 'EN-02.3 Test Building', 50,
            ${sql.json([{ name: "Theatre", capacity: 50 }])}, ${sql.json({})}, ${ACTOR}, ${ACTOR})
    returning id
  `;
  return row!.id;
}

function slot(venueId: string, index: number, startsAt: Date, endsAt: Date): NewVenueSlot {
  return {
    venueId,
    eventId: randomUUID(),
    reference: `BR-RACE-${String(index).padStart(2, "0")}`,
    startsAt,
    endsAt,
    setupMinutes: 0,
    turnaroundMinutes: 0,
    status: "HELD",
    actorUserId: ACTOR,
  };
}

const reservationFor = (index: number) => ({
  eventId: randomUUID(),
  eventReference: `EVT-RACE-${String(index).padStart(2, "0")}`,
  startsAt: at("10:00"),
  endsAt: at("12:00"),
  actorUserId: ACTOR,
});

describe.runIf(isThrowawayDatabase())(`${ATTEMPTS} attempts at the same moment (EN-02.3)`, () => {
  it("N1, L3: exactly one of 50 overlapping holds on one venue succeeds; the other 49 get the conflict refusal", async () => {
    const venueId = await newVenue();

    const results = await race(ATTEMPTS, (tx, i) => insertVenueSlot(tx, slot(venueId, i, at("10:00"), at("12:00"))));

    expect(winners(results)).toHaveLength(1);
    const refused = losers(results);
    expect(refused).toHaveLength(ATTEMPTS - 1);
    for (const reason of refused) {
      expect(reason).toBeInstanceOf(VenueSlotConflictError);
      expect((reason as VenueSlotConflictError).conflictingReferences).toEqual([winners(results)[0]!.reference]);
    }
    const [stored] = await sql<{ n: number }[]>`select count(*)::int as n from venue.venue_slots where venue_id = ${venueId}`;
    expect(stored!.n).toBe(1);
  });

  it("N1: all of 50 back-to-back holds that merely touch succeed", async () => {
    const venueId = await newVenue();
    const start = at("08:00");

    const results = await race(ATTEMPTS, (tx, i) =>
      insertVenueSlot(tx, slot(venueId, i, minutesAfter(start, i * 10), minutesAfter(start, (i + 1) * 10))),
    );

    expect(losers(results)).toEqual([]);
    expect(winners(results)).toHaveLength(ATTEMPTS);
  });

  it("Q1: exactly one of 50 reservations of the last free projector succeeds", async () => {
    const [type] = await sql<{ id: string }[]>`
      insert into equipment.equipment_types (name, kind, created_by, updated_by)
      values (${`EN-02.3 Projector ${randomUUID().slice(0, 8)}`}, 'SERIALIZED', ${ACTOR}, ${ACTOR})
      returning id
    `;
    const [unit] = await sql<{ id: string }[]>`
      insert into equipment.equipment_units (equipment_type_id, label, created_by, updated_by)
      values (${type!.id}, 'PROJ-LAST', ${ACTOR}, ${ACTOR})
      returning id
    `;

    const results = await race(ATTEMPTS, (tx, i) => reserveUnit(tx, { unitId: unit!.id, ...reservationFor(i) }));

    expect(winners(results)).toHaveLength(1);
    for (const reason of losers(results)) {
      expect(reason).toBeInstanceOf(UnitAlreadyReservedError);
    }
    const [stored] = await sql<{ n: number }[]>`
      select count(*)::int as n from equipment.unit_reservations where unit_id = ${unit!.id} and status = 'RESERVED'
    `;
    expect(stored!.n).toBe(1);
  });

  it("Q1: exactly one of 50 reservations of the last chair in bulk stock succeeds, and the rest learn they are 1 short", async () => {
    const [type] = await sql<{ id: string }[]>`
      insert into equipment.equipment_types (name, kind, total_quantity, created_by, updated_by)
      values (${`EN-02.3 Chairs ${randomUUID().slice(0, 8)}`}, 'BULK', 1, ${ACTOR}, ${ACTOR})
      returning id
    `;

    const results = await race(ATTEMPTS, (tx, i) =>
      reserveBulk(tx, { equipmentTypeId: type!.id, quantity: 1, ...reservationFor(i) }),
    );

    expect(winners(results)).toHaveLength(1);
    for (const reason of losers(results)) {
      expect(reason).toBeInstanceOf(InsufficientEquipmentError);
      expect(reason).toMatchObject({ requested: 1, available: 0, shortfall: 1 });
    }
  });
});

describe("isThrowawayDatabase", () => {
  it("accepts only this machine's own Postgres", () => {
    expect(isThrowawayDatabase("postgres://ci:ci@127.0.0.1:5432/connectsphere_ci")).toBe(true);
    expect(isThrowawayDatabase("postgresql://me@localhost/dev")).toBe(true);
    expect(isThrowawayDatabase("postgresql://postgres.abc:pw@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres")).toBe(false);
    expect(isThrowawayDatabase("")).toBe(false);
    expect(isThrowawayDatabase("not a url")).toBe(false);
  });
});
