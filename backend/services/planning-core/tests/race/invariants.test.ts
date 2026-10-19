import { afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { testDb } from "../support/testDb.js";
import { isThrowawayDatabase, losers, race, winners } from "../support/race.js";
import { insertVenueSlot, type NewVenueSlot } from "../../src/modules/venue/repo/slots.js";
import { VenueSlotConflictError } from "../../src/modules/venue/domain/slotConflict.js";
import { reserveBulk, reserveUnit } from "../../src/modules/equipment/repo/inventory.js";
import { reserveLine } from "../../src/modules/equipment/repo/reservations.js";
import { releaseLine } from "../../src/modules/equipment/repo/releases.js";
import { InsufficientEquipmentError, UnitAlreadyReservedError } from "../../src/modules/equipment/domain/availability.js";
import { ChangeRequestAlreadyPendingError, insertChangeRequest } from "../../src/modules/change/repo/changeRequests.js";
import { decideChangeRequest } from "../../src/modules/change/repo/decisions.js";
import { deleteSeededEvents, seedEvent } from "../support/seedEvent.js";
import { EVENT_END } from "../support/eventDates.js";

/**
 * EN-02.3 (ADR-0006, implementation.md §8.1): fifty attempts at exactly the
 * same moment, each on its own connection. The database, not our code, must
 * let exactly one through when they compete, and all of them when they don't.
 *
 * These are the "exactly one succeeds" checks behind N1 (venue slots), Q1
 * (the last unit of equipment) and S1 (one pending change request per event) and S2 (one decision per change request). They run only against a throwaway database
 * (CI's, from EN-06.1); against any other database the suite is skipped.
 */

const ATTEMPTS = 50;
/** Each "exactly one" race is run this many times: a race that passes once can still lose rarely. */
const ROUNDS = 10;
const ACTOR = "a5555555-0000-0000-0000-000000000001";
/** Owns the events of the S1 race, so its cleanup touches nothing else. */
const S1_OWNER = "a5555555-0000-0000-0000-000000000051";
/** Owns the events of the S2 race, and is the coordinator assigned to them. */
const S2_OWNER = "a5555555-0000-0000-0000-000000000052";
const S2_COORDINATOR = "a5555555-0000-0000-0000-000000000053";
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

describe.runIf(isThrowawayDatabase())(`${ATTEMPTS} attempts at the same moment (EN-02.3)`, { timeout: 60_000 }, () => {
  it("N1, L3: exactly one of 50 overlapping holds on one venue succeeds; the other 49 get the conflict refusal", async () => {
    for (let round = 0; round < ROUNDS; round += 1) {
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
    }
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
    for (let round = 0; round < ROUNDS; round += 1) {
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
    }
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

  /** Q1-T13 leaves nothing behind: ~1,000 lines would fill the first page of every unfiltered list the other suites read. */
  async function removeQ1T13Rows(typeId: string, lineIds: string[]): Promise<void> {
    await sql`delete from equipment.unit_reservations where unit_id in (select id from equipment.equipment_units where equipment_type_id = ${typeId})`;
    await sql`delete from equipment.bulk_reservations where equipment_type_id = ${typeId}`;
    await sql`delete from equipment.reservations where equipment_type_id = ${typeId}`;
    await sql`delete from equipment.equipment_units where equipment_type_id = ${typeId}`;
    await sql`delete from equipment.request_line_history where line_id in ${sql(lineIds)}`;
    await sql`delete from equipment.equipment_request_lines where equipment_type_id = ${typeId}`;
    await sql`delete from equipment.equipment_types where id = ${typeId}`;
  }

  it("Q1-T13 exactly one of 50 lines reserves the last unit, for bulk and serialized stock", async () => {
    for (const kind of ["BULK", "SERIALIZED"] as const) {
      for (let round = 0; round < ROUNDS; round += 1) {
        const [type] = await sql<{ id: string }[]>`
          insert into equipment.equipment_types (name, kind, total_quantity, created_by, updated_by)
          values (${`Q1-T13 ${kind} ${randomUUID().slice(0, 8)}`}, ${kind}, ${kind === "BULK" ? 1 : null}, ${ACTOR}, ${ACTOR})
          returning id
        `;
        if (kind === "SERIALIZED") {
          await sql`
            insert into equipment.equipment_units (equipment_type_id, label, created_by, updated_by)
            values (${type!.id}, 'LAST', ${ACTOR}, ${ACTOR})
          `;
        }
        // Fifty Confirmed lines for the same window, in one insert rather than fifty round-trips.
        const rows = Array.from({ length: ATTEMPTS }, (_, i) => ({
          event_id: randomUUID(),
          event_reference: `EVT-Q1-${String(i).padStart(2, "0")}`,
          equipment_type_id: type!.id,
          quantity: 1,
          required_from: at("09:00"),
          required_to: at("12:00"),
          status: "CONFIRMED",
          requested_by: ACTOR,
          created_by: ACTOR,
          updated_by: ACTOR,
        }));
        const inserted = await sql<{ id: string }[]>`
          insert into equipment.equipment_request_lines ${sql(rows)} returning id
        `;
        const lineIds = inserted.map((row) => row.id);

        try {
          const results = await race(ATTEMPTS, (tx, i) =>
            reserveLine(tx, lineIds[i]!, { quantity: null, partial: false }, { userId: ACTOR, role: "TECH_SUPPORT_STAFF" }),
          );

          expect(winners(results)).toHaveLength(1);
          expect(winners(results)[0]).toMatchObject({ ok: true });
          for (const reason of losers(results)) {
            expect(reason).toBeInstanceOf(InsufficientEquipmentError);
            expect(reason).toMatchObject({ requested: 1, available: 0, shortfall: 1 });
          }
          const [stored] = await sql<{ n: number }[]>`
            select count(*)::int as n from equipment.reservations where equipment_type_id = ${type!.id} and status = 'RESERVED'
          `;
          expect(stored!.n).toBe(1);
          const [stillConfirmed] = await sql<{ n: number }[]>`
            select count(*)::int as n from equipment.equipment_request_lines where id in ${sql(lineIds)} and status = 'CONFIRMED'
          `;
          expect(stillConfirmed!.n).toBe(ATTEMPTS - 1);
        } finally {
          await removeQ1T13Rows(type!.id, lineIds);
        }
      }
    }
  });

  it("Q2-T6 exactly one of 50 simultaneous releases of one reservation succeeds, and the rest find the line Confirmed", async () => {
    for (let round = 0; round < ROUNDS; round += 1) {
      const [type] = await sql<{ id: string }[]>`
        insert into equipment.equipment_types (name, kind, total_quantity, created_by, updated_by)
        values (${`Q2-T6 ${randomUUID().slice(0, 8)}`}, 'BULK', 1, ${ACTOR}, ${ACTOR})
        returning id
      `;
      const [inserted] = await sql<{ id: string }[]>`
        insert into equipment.equipment_request_lines
          (event_id, event_reference, equipment_type_id, quantity, required_from, required_to, status, requested_by, created_by, updated_by)
        values (${randomUUID()}, 'EVT-Q2-00', ${type!.id}, 1, ${at("09:00")}, ${at("12:00")}, 'CONFIRMED', ${ACTOR}, ${ACTOR}, ${ACTOR})
        returning id
      `;
      const lineId = inserted!.id;
      const actor = { userId: ACTOR, role: "TECH_SUPPORT_STAFF" } as const;

      try {
        const reserved = await sql.begin((tx) => reserveLine(tx, lineId, { quantity: null, partial: false }, actor));
        expect(reserved).toMatchObject({ ok: true });

        const results = await race(ATTEMPTS, (tx) => releaseLine(tx, lineId, "race", actor));

        expect(losers(results)).toEqual([]);
        const outcomes = winners(results);
        expect(outcomes).toHaveLength(ATTEMPTS);
        expect(outcomes.filter((outcome) => outcome.ok)).toHaveLength(1);
        for (const outcome of outcomes.filter((entry) => !entry.ok)) {
          expect(outcome).toEqual({ ok: false, code: "LINE_NOT_RELEASABLE", status: "CONFIRMED" });
        }
        const stored = await sql<{ released_at: Date | null }[]>`
          select released_at from equipment.reservations where request_line_id = ${lineId}
        `;
        expect(stored).toHaveLength(1);
        expect(stored[0]!.released_at).not.toBeNull();
        const [entries] = await sql<{ n: number }[]>`
          select count(*)::int as n from equipment.request_line_history
          where line_id = ${lineId} and details->>'released' = 'true'
        `;
        expect(entries!.n).toBe(1);
      } finally {
        await removeQ1T13Rows(type!.id, [lineId]);
      }
    }
  });

  it("S1 exactly one of 50 simultaneous change requests for one event is recorded", async () => {
    for (let round = 0; round < ROUNDS; round += 1) {
      const eventId = await seedEvent(sql, { ownerId: S1_OWNER, status: "APPROVED", endsAt: new Date(EVENT_END) });
      try {
        const [event] = await sql<{ reference: string }[]>`select reference from event.events where id = ${eventId}`;

        const results = await race(ATTEMPTS, (tx, i) =>
          insertChangeRequest(tx, {
            event: { id: eventId, reference: event!.reference },
            reason: `S1 race attempt ${i}`,
            changes: { expectedAttendance: 160 },
            current: { expectedAttendance: 150 },
            actorId: S1_OWNER,
          }),
        );

        expect(winners(results)).toHaveLength(1);
        const winner = winners(results)[0]!;
        const refused = losers(results);
        expect(refused).toHaveLength(ATTEMPTS - 1);
        for (const reason of refused) {
          expect(reason).toBeInstanceOf(ChangeRequestAlreadyPendingError);
          expect((reason as ChangeRequestAlreadyPendingError).existing.id).toBe(winner.id);
        }
        const stored = await sql<{ id: string; status: string }[]>`
          select id, status from change.change_requests where event_id = ${eventId}
        `;
        expect(stored).toEqual([{ id: winner.id, status: "PENDING" }]);
      } finally {
        await sql`delete from change.change_request_fields where request_id in (select id from change.change_requests where event_id = ${eventId})`;
        await sql`delete from change.change_requests where event_id = ${eventId}`;
        await deleteSeededEvents(sql, [S1_OWNER]);
      }
    }
  });

  it("S2-T11 exactly one of 50 simultaneous approve and reject decisions on one request is recorded", async () => {
    for (let round = 0; round < ROUNDS; round += 1) {
      const eventId = await seedEvent(sql, { ownerId: S2_OWNER, status: "APPROVED", endsAt: new Date(EVENT_END) });
      try {
        await sql`
          insert into event.assignments (event_id, coordinator_id, assignment_rule)
          values (${eventId}, ${S2_COORDINATOR}, 'TEST_FIXTURE')
        `;
        const [event] = await sql<{ reference: string }[]>`select reference from event.events where id = ${eventId}`;
        const pending = await sql.begin((tx) =>
          insertChangeRequest(tx, {
            event: { id: eventId, reference: event!.reference },
            reason: "S2 race",
            changes: { expectedAttendance: 160 },
            current: { expectedAttendance: 150 },
            actorId: S2_OWNER,
          }),
        );
        const coordinator = { userId: S2_COORDINATOR, role: "EVENT_COORDINATOR" } as const;

        const results = await race(ATTEMPTS, (tx, i) =>
          decideChangeRequest(tx, pending.id, i % 2 ? { decision: "APPROVE" } : { decision: "REJECT", reason: "Race" }, coordinator),
        );

        expect(losers(results)).toEqual([]);
        const outcomes = winners(results);
        expect(outcomes).toHaveLength(ATTEMPTS);
        const decided = outcomes.filter((outcome) => outcome.ok);
        expect(decided).toHaveLength(1);
        for (const outcome of outcomes.filter((entry) => !entry.ok)) {
          expect(outcome).toMatchObject({ ok: false, code: "ALREADY_DECIDED" });
        }

        const stored = await sql<{ status: string; decided_by: string | null }[]>`
          select status, decided_by from change.change_requests where id = ${pending.id}
        `;
        expect(stored).toHaveLength(1);
        const status = stored[0]!.status;
        expect(["APPROVED", "REJECTED"]).toContain(status);
        expect(stored[0]!.decided_by).toBe(S2_COORDINATOR);
        expect((decided[0] as { ok: true; request: { status: string } }).request.status).toBe(status);

        const changes = await sql<{ field_name: string }[]>`
          select field_name from event.event_history where event_id = ${eventId} and entry_type = 'FIELD_CHANGE'
        `;
        expect(changes.map((row) => row.field_name)).toEqual(status === "APPROVED" ? ["expectedAttendance"] : []);
      } finally {
        await sql`delete from change.outbox where message_key = ${eventId}`;
        await sql`delete from change.change_request_fields where request_id in (select id from change.change_requests where event_id = ${eventId})`;
        await sql`delete from change.change_requests where event_id = ${eventId}`;
        await deleteSeededEvents(sql, [S2_OWNER]);
      }
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
