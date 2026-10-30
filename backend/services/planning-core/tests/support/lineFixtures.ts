import { randomUUID } from "node:crypto";
import type { Sql } from "postgres";
import type { EquipmentRequestLineStatus } from "@connectsphere/contracts";
import { deleteSeededEvents, seedEvent } from "./seedEvent.js";
import { EVENT_END, EVENT_START } from "./eventDates.js";

/**
 * Fixtures for the O1/O2 cards (tests/O1, tests/O2): FX-O1 and FX-O2. Each test file passes its own
 * actor ids and name prefix, so two files running in one database never touch each other's rows.
 */

export interface LineActors {
  /** Coordinator assigned to E1. */
  c1: string;
  /** Coordinator not assigned to E1. */
  c2: string;
  /** Owner of E1. */
  org: string;
  /** Technical Support. */
  ts: string;
  /** Venue Staff. */
  vs: string;
  /** Attendee. */
  att: string;
}

/** Actors whose ids share a suffix-free prefix, e.g. `0b100000-0000-4000-8000-00000000000N`. */
export function actorsWithPrefix(prefix: string): LineActors {
  const id = (n: number) => `${prefix}-0000-4000-8000-00000000000${n}`;
  return { c1: id(1), c2: id(2), org: id(3), ts: id(4), vs: id(5), att: id(6) };
}

export const EVENT_WINDOW = { start: EVENT_START, end: EVENT_END };

/** An Approved event owned by `ownerId`, assigned to `coordinatorId` unless that is null. */
export async function createEvent(
  sql: Sql,
  options: { ownerId: string; coordinatorId: string | null; name?: string },
): Promise<{ id: string; reference: string; name: string }> {
  const name = options.name ?? "Fixture event";
  const id = await seedEvent(sql, { ownerId: options.ownerId, status: "APPROVED", endsAt: new Date(EVENT_END), name });
  if (options.coordinatorId) {
    await sql`
      insert into event.assignments (event_id, coordinator_id, assignment_rule)
      values (${id}, ${options.coordinatorId}, 'TEST_FIXTURE')
    `;
  }
  const [row] = await sql<{ reference: string }[]>`select reference from event.events where id = ${id}`;
  return { id, reference: row!.reference, name };
}

/** Two bulk equipment types, CHAIRS (total 50) and PROJECTORS (total 5), created by `createdBy`. */
export async function createTypes(sql: Sql, createdBy: string, prefix: string) {
  const make = async (name: string, total: number) => {
    const [row] = await sql<{ id: string }[]>`
      insert into equipment.equipment_types (name, description, kind, total_quantity, created_by, updated_by)
      values (${name}, 'Line fixture', 'BULK', ${total}, ${createdBy}, ${createdBy})
      returning id
    `;
    return { id: row!.id, name };
  };
  return { chairs: await make(`${prefix} Folding Chairs`, 50), projectors: await make(`${prefix} Projectors`, 5) };
}

/** A serialized type with the given unit labels, created by `createdBy` (FX-Q1's PROJECTORS). */
export async function createSerializedType(sql: Sql, createdBy: string, name: string, labels: string[]) {
  const [type] = await sql<{ id: string }[]>`
    insert into equipment.equipment_types (name, description, kind, created_by, updated_by)
    values (${name}, 'Line fixture', 'SERIALIZED', ${createdBy}, ${createdBy})
    returning id
  `;
  for (const label of labels) {
    await sql`
      insert into equipment.equipment_units (equipment_type_id, label, created_by, updated_by)
      values (${type!.id}, ${label}, ${createdBy}, ${createdBy})
    `;
  }
  return { id: type!.id, name };
}

/** A bulk type with the given total (FX-Q1's CHAIRS has 10). */
export async function createBulkType(sql: Sql, createdBy: string, name: string, total: number) {
  const [row] = await sql<{ id: string }[]>`
    insert into equipment.equipment_types (name, description, kind, total_quantity, created_by, updated_by)
    values (${name}, 'Line fixture', 'BULK', ${total}, ${createdBy}, ${createdBy})
    returning id
  `;
  return { id: row!.id, name };
}

/** Another event's reservation of bulk stock, written directly, to use up availability. */
export async function reserveBulkDirect(
  sql: Sql,
  options: { equipmentTypeId: string; quantity: number; startsAt: string; endsAt: string; actorUserId: string },
): Promise<void> {
  await sql`
    insert into equipment.bulk_reservations
      (equipment_type_id, event_id, event_reference, quantity, starts_at, ends_at, created_by, updated_by)
    values
      (${options.equipmentTypeId}, ${randomUUID()}, 'EVT-OTHER', ${options.quantity}, ${options.startsAt}, ${options.endsAt},
       ${options.actorUserId}, ${options.actorUserId})
  `;
}

/** Inserts a line directly, in any status, for statuses no user action can reach yet (Reserved, Removed). */
export async function insertLineDirect(
  sql: Sql,
  options: {
    event: { id: string; reference: string };
    equipmentTypeId: string;
    requestedBy: string;
    status?: EquipmentRequestLineStatus;
    quantity?: number;
    notes?: string;
    reason?: string;
    substitute?: { typeId: string; quantity: number };
  },
): Promise<string> {
  const status = options.status ?? "SUBMITTED";
  const [row] = await sql<{ id: string }[]>`
    insert into equipment.equipment_request_lines
      (event_id, event_reference, equipment_type_id, quantity, notes, required_from, required_to, status,
       requested_by, unavailable_reason, substitute_equipment_type_id, substitute_quantity, created_by, updated_by)
    values
      (${options.event.id}, ${options.event.reference}, ${options.equipmentTypeId}, ${options.quantity ?? 40},
       ${options.notes ?? ""}, ${EVENT_START}, ${EVENT_END}, ${status}, ${options.requestedBy},
       ${status === "UNAVAILABLE" ? (options.reason ?? "fixture reason") : null},
       ${options.substitute?.typeId ?? null}, ${options.substitute?.quantity ?? null},
       ${options.requestedBy}, ${options.requestedBy})
    returning id
  `;
  return row!.id;
}

/** A fresh id that matches no row. */
export const unknownId = () => randomUUID();

/** Removes everything the fixtures created for these owners and equipment creators. Test-only. */
export async function cleanLineFixtures(sql: Sql, owners: string[], typeCreators: string[]): Promise<void> {
  const events = sql`select id from event.events where owner_id in ${sql(owners)}`;
  const types = sql`select id from equipment.equipment_types where created_by in ${sql(typeCreators)}`;
  const lines = sql`
    select id from equipment.equipment_request_lines
    where event_id in (${events}) or equipment_type_id in (${types})
  `;
  await sql`delete from equipment.outbox where message_key in (select id::text from (${lines}) l)`;
  await sql`delete from equipment.request_line_history where line_id in (${lines})`;
  const reservationIds = sql`select id from equipment.reservations where request_line_id in (${lines})`;
  // S3's flags reference reservations, so they go first.
  await sql`delete from equipment.reservation_flags where reservation_id in (
    select id from equipment.reservations where equipment_type_id in (${types}) or request_line_id in (${lines}))`;
  await sql`delete from equipment.unit_reservations where reservation_id in (${reservationIds})`;
  await sql`delete from equipment.bulk_reservations where reservation_id in (${reservationIds})`;
  await sql`delete from equipment.unit_reservations where unit_id in (select id from equipment.equipment_units where equipment_type_id in (${types}))`;
  await sql`delete from equipment.bulk_reservations where equipment_type_id in (${types})`;
  await sql`delete from equipment.reservations where equipment_type_id in (${types}) or request_line_id in (${lines})`;
  await sql`delete from equipment.equipment_units where equipment_type_id in (${types})`;
  await sql`delete from equipment.equipment_request_lines where event_id in (${events}) or equipment_type_id in (${types})`;
  await sql`delete from equipment.inventory_history where equipment_type_id in (${types})`;
  await sql`delete from equipment.equipment_types where id in (${types})`;
  await deleteSeededEvents(sql, owners);
}
