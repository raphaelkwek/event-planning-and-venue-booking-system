import type { Sql, TransactionSql } from "postgres";
import type { EquipmentKind, Role } from "@connectsphere/contracts";
import {
  availableQuantity,
  InsufficientEquipmentError,
  isUnitOverlap,
  peakConcurrentUse,
  UnitAlreadyReservedError,
} from "../domain/availability.js";
import {
  InventoryReductionConflictError,
  UnavailabilityExceedsTotalError,
  type AffectedReservation,
  type EquipmentTypeInput,
  type UnavailabilityInput,
} from "../domain/inventory.js";

/**
 * Equipment availability and reservations (EN-02.2, ADR-0006, implementation.md
 * §4.6). SQL for the equipment schema only. P1, P2, Q1 and Q2 build on these.
 *
 * Every reservation takes its equipment type's row lock first, so reservations
 * of one type queue.
 * - Bulk stock has no row per unit to constrain, so the lock is what makes its
 *   peak check safe against a simultaneous reservation.
 * - Serialized units are guarded by their exclusion constraint, which decides
 *   on its own. The lock is there because two conflicting inserts in flight at
 *   once can each wait for the other, and Postgres then aborts one as a
 *   deadlock (40P01) instead of an overlap; EN-02.3's race showed it. Queued,
 *   each loser meets an already committed winner and is refused cleanly.
 */

export interface Period {
  startsAt: Date;
  endsAt: Date;
}

interface ReservationFor extends Period {
  /** event.events.id. */
  eventId: string;
  /** The event's reference, which P2's refusals name. */
  eventReference: string;
  actorUserId: string;
}

export interface UnitReservationInput extends ReservationFor {
  unitId: string;
}

export interface BulkReservationInput extends ReservationFor {
  equipmentTypeId: string;
  quantity: number;
}

export interface Reservation {
  id: string;
  quantity: number;
}

export interface LockedType {
  kind: EquipmentKind;
  /** Bulk stock only; null for a serialized type. */
  totalQuantity: number | null;
}

export interface FreeUnit {
  id: string;
  label: string;
}

type Db = Sql | TransactionSql;

export interface EquipmentUnitRecord {
  id: string;
  label: string;
}

export interface EquipmentTypeRecord {
  id: string;
  name: string;
  description: string;
  characteristics: Record<string, string>;
  kind: EquipmentKind;
  /** Stored for bulk stock; derived from active units for serialized inventory. */
  totalQuantity: number;
  unitLabels: string[];
  units: EquipmentUnitRecord[];
  createdAt: string;
  createdBy: string | null;
  updatedAt: string;
  updatedBy: string | null;
}

export interface InventoryActor {
  userId: string;
  role: Role;
}

interface EquipmentTypeRow {
  id: string;
  name: string;
  description: string;
  characteristics: Record<string, string>;
  kind: EquipmentKind;
  total_quantity: number | null;
  created_at: Date;
  created_by: string | null;
  updated_at: Date;
  updated_by: string | null;
}

interface UnitRow {
  id: string;
  label: string;
}

async function toEquipmentType(db: Db, row: EquipmentTypeRow): Promise<EquipmentTypeRecord> {
  const units = row.kind === "SERIALIZED"
    ? await db<UnitRow[]>`
        select id, label from equipment.equipment_units
         where equipment_type_id = ${row.id} and status = 'ACTIVE'
         order by lower(label), id
      `
    : [];
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    characteristics: row.characteristics,
    kind: row.kind,
    totalQuantity: row.kind === "BULK" ? row.total_quantity! : units.length,
    unitLabels: units.map((unit) => unit.label),
    units,
    createdAt: row.created_at.toISOString(),
    createdBy: row.created_by,
    updatedAt: row.updated_at.toISOString(),
    updatedBy: row.updated_by,
  };
}

const windowOf = (period: Period) => ({ start: period.startsAt, end: period.endsAt });

/**
 * Takes the equipment type's row lock, held until the transaction ends. Every
 * reservation (Q1) and P2's reductions of the total take it first, so they
 * serialise per type. Null when there is no such type.
 */
export async function lockEquipmentType(tx: TransactionSql, typeId: string): Promise<LockedType | null> {
  const [row] = await tx<{ kind: EquipmentKind; total_quantity: number | null }[]>`
    select kind, total_quantity from equipment.equipment_types where id = ${typeId} for update
  `;
  return row ? { kind: row.kind, totalQuantity: row.total_quantity } : null;
}

/**
 * The most bulk stock of a type in use at any one moment inside the window:
 * reserved quantities plus quantities recorded unavailable (P1).
 */
export async function peakUse(tx: TransactionSql, typeId: string, period: Period): Promise<number> {
  const uses = await tx<{ start: Date; end: Date; quantity: number }[]>`
    select lower(period) as start, upper(period) as end, quantity
      from equipment.bulk_reservations
     where equipment_type_id = ${typeId}
       and status = 'RESERVED'
       and period && tstzrange(${period.startsAt}::timestamptz, ${period.endsAt}::timestamptz, '[)')
    union all
    select lower(period), upper(period), quantity
      from equipment.unavailability
     where equipment_type_id = ${typeId}
       and status = 'ACTIVE'
       and quantity is not null
       and period && tstzrange(${period.startsAt}::timestamptz, ${period.endsAt}::timestamptz, '[)')
  `;
  return peakConcurrentUse(uses, windowOf(period));
}

/**
 * Units of a serialized type free for the whole window: no reservation and no
 * unavailability overlaps any part of it. Ones that only touch it count as free.
 * In label order. Q1 picks from these; the constraint still decides if two
 * reservations race for the same unit.
 */
export async function availableUnits(tx: TransactionSql, typeId: string, period: Period): Promise<FreeUnit[]> {
  return tx<FreeUnit[]>`
    select u.id, u.label
      from equipment.equipment_units u
     where u.equipment_type_id = ${typeId}
       and u.status = 'ACTIVE'
       and not exists (
             select 1 from equipment.unit_reservations r
              where r.unit_id = u.id and r.status = 'RESERVED'
                and r.period && tstzrange(${period.startsAt}::timestamptz, ${period.endsAt}::timestamptz, '[)'))
       and not exists (
             select 1 from equipment.unavailability n
              where n.unit_id = u.id and n.status = 'ACTIVE'
                and n.period && tstzrange(${period.startsAt}::timestamptz, ${period.endsAt}::timestamptz, '[)'))
     order by u.label
  `;
}

/**
 * Reserves one serialized unit for a period, after taking its type's row lock.
 * The per-unit exclusion constraint refuses an overlapping reservation; that
 * refusal becomes UnitAlreadyReservedError, naming the unit. The insert runs in
 * a savepoint so the unit's label can still be read after the refusal.
 */
export async function reserveUnit(tx: TransactionSql, input: UnitReservationInput): Promise<Reservation> {
  const [type] = await tx<{ id: string }[]>`
    select t.id from equipment.equipment_types t
     where t.id = (select equipment_type_id from equipment.equipment_units where id = ${input.unitId} and status = 'ACTIVE')
       for update
  `;
  if (!type) throw new Error(`No active equipment unit: ${input.unitId}`);
  try {
    const [row] = await tx.savepoint(
      (sp) => sp<{ id: string }[]>`
        insert into equipment.unit_reservations
          (unit_id, event_id, event_reference, starts_at, ends_at, status, created_by, updated_by)
        values
          (${input.unitId}, ${input.eventId}, ${input.eventReference}, ${input.startsAt}, ${input.endsAt},
           'RESERVED', ${input.actorUserId}, ${input.actorUserId})
        returning id
      `,
    );
    return { id: row!.id, quantity: 1 };
  } catch (error) {
    if (!isUnitOverlap(error)) throw error;
    const [unit] = await tx<{ label: string }[]>`select label from equipment.equipment_units where id = ${input.unitId}`;
    throw new UnitAlreadyReservedError(unit?.label ?? input.unitId);
  }
}

/**
 * Reserves a quantity of bulk stock for a period, or refuses with the shortfall
 * and reserves nothing (Q1). Locks the type first, then checks that the new
 * quantity fits under the total at the busiest moment of the window.
 */
export async function reserveBulk(tx: TransactionSql, input: BulkReservationInput): Promise<Reservation> {
  const type = await lockEquipmentType(tx, input.equipmentTypeId);
  if (!type) throw new Error(`No such equipment type: ${input.equipmentTypeId}`);
  if (type.kind !== "BULK" || type.totalQuantity === null) {
    throw new Error(`Equipment type ${input.equipmentTypeId} is not bulk stock; reserve its units instead.`);
  }

  const available = availableQuantity(type.totalQuantity, await peakUse(tx, input.equipmentTypeId, input));
  if (input.quantity > available) {
    throw new InsufficientEquipmentError({ requested: input.quantity, available });
  }

  const [row] = await tx<Reservation[]>`
    insert into equipment.bulk_reservations
      (equipment_type_id, event_id, event_reference, quantity, starts_at, ends_at, status, created_by, updated_by)
    values
      (${input.equipmentTypeId}, ${input.eventId}, ${input.eventReference}, ${input.quantity},
       ${input.startsAt}, ${input.endsAt}, 'RESERVED', ${input.actorUserId}, ${input.actorUserId})
    returning id, quantity
  `;
  return row!;
}

/** P2 catalogue list. Serialized totals are the number of active unit rows. */
export async function listEquipmentTypes(db: Db): Promise<EquipmentTypeRecord[]> {
  const rows = await db<EquipmentTypeRow[]>`
    select * from equipment.equipment_types order by lower(name), id
  `;
  return Promise.all(rows.map((row) => toEquipmentType(db, row)));
}

export async function findEquipmentType(db: Db, id: string): Promise<EquipmentTypeRecord | null> {
  const [row] = await db<EquipmentTypeRow[]>`select * from equipment.equipment_types where id = ${id}`;
  return row ? toEquipmentType(db, row) : null;
}

/** Locks the aggregate before P2 changes its type row or its labelled units. */
export async function lockEquipmentTypeRecord(tx: TransactionSql, id: string): Promise<EquipmentTypeRecord | null> {
  const [row] = await tx<EquipmentTypeRow[]>`select * from equipment.equipment_types where id = ${id} for update`;
  return row ? toEquipmentType(tx, row) : null;
}

async function recordInventoryHistory(
  tx: TransactionSql,
  input: {
    equipmentTypeId: string;
    unavailabilityId?: string;
    action: "TYPE_CREATED" | "TYPE_UPDATED" | "UNAVAILABILITY_RECORDED";
    previousQuantity: number;
    newQuantity: number;
    changes?: Record<string, { previous: unknown; new: unknown }>;
  },
  actor: InventoryActor,
) {
  await tx`
    insert into equipment.inventory_history
      (equipment_type_id, unavailability_id, action, previous_quantity, new_quantity, changes,
       actor_user_id, actor_role, created_by, updated_by)
    values
      (${input.equipmentTypeId}, ${input.unavailabilityId ?? null}, ${input.action}, ${input.previousQuantity},
       ${input.newQuantity}, ${tx.json((input.changes ?? {}) as never)}, ${actor.userId}, ${actor.role},
       ${actor.userId}, ${actor.userId})
  `;
}

export async function insertEquipmentType(
  tx: TransactionSql,
  input: EquipmentTypeInput,
  actor: InventoryActor,
): Promise<EquipmentTypeRecord> {
  const [row] = await tx<EquipmentTypeRow[]>`
    insert into equipment.equipment_types
      (name, description, characteristics, kind, total_quantity, created_by, updated_by)
    values
      (${input.name}, ${input.description}, ${tx.json(input.characteristics as never)}, ${input.kind},
       ${input.kind === "BULK" ? input.totalQuantity : null}, ${actor.userId}, ${actor.userId})
    returning *
  `;
  if (input.kind === "SERIALIZED") {
    for (const label of input.unitLabels) {
      await tx`
        insert into equipment.equipment_units (equipment_type_id, label, status, created_by, updated_by)
        values (${row!.id}, ${label}, 'ACTIVE', ${actor.userId}, ${actor.userId})
      `;
    }
  }
  const total = input.kind === "BULK" ? input.totalQuantity! : input.unitLabels.length;
  await recordInventoryHistory(tx, {
    equipmentTypeId: row!.id,
    action: "TYPE_CREATED",
    previousQuantity: 0,
    newQuantity: total,
    changes: {
      name: { previous: null, new: input.name },
      description: { previous: null, new: input.description },
      characteristics: { previous: null, new: input.characteristics },
      kind: { previous: null, new: input.kind },
      totalQuantity: { previous: 0, new: total },
    },
  }, actor);
  return (await findEquipmentType(tx, row!.id))!;
}

/**
 * Active reservations which participate in any interval whose total use is
 * above `proposedQuantity`. Unavailability participates in the peak check,
 * while the returned evidence names the event reservations P2 asks for.
 */
async function affectedBulkReservations(
  tx: TransactionSql,
  typeId: string,
  proposedQuantity: number,
): Promise<AffectedReservation[]> {
  const rows = await tx<{ event_reference: string; quantity: number }[]>`
    with boundaries as (
      select starts_at as at from equipment.bulk_reservations
       where equipment_type_id = ${typeId} and status = 'RESERVED'
      union
      select starts_at as at from equipment.unavailability
       where equipment_type_id = ${typeId} and status = 'ACTIVE' and quantity is not null
    ), overloaded as (
      select b.at
        from boundaries b
       where (
         coalesce((select sum(r.quantity) from equipment.bulk_reservations r
                    where r.equipment_type_id = ${typeId} and r.status = 'RESERVED' and r.period @> b.at), 0)
         + coalesce((select sum(u.quantity) from equipment.unavailability u
                      where u.equipment_type_id = ${typeId} and u.status = 'ACTIVE'
                        and u.quantity is not null and u.period @> b.at), 0)
       ) > ${proposedQuantity}
    )
    select distinct r.event_reference, r.quantity
      from equipment.bulk_reservations r
      join overloaded o on r.period @> o.at
     where r.equipment_type_id = ${typeId} and r.status = 'RESERVED'
     order by r.event_reference, r.quantity
  `;
  return rows.map((row) => ({ eventReference: row.event_reference, quantity: row.quantity }));
}

async function reductionExceedsUse(tx: TransactionSql, typeId: string, proposedQuantity: number): Promise<boolean> {
  const [row] = await tx<{ exceeds: boolean }[]>`
    with boundaries as (
      select starts_at as at from equipment.bulk_reservations
       where equipment_type_id = ${typeId} and status = 'RESERVED'
      union
      select starts_at as at from equipment.unavailability
       where equipment_type_id = ${typeId} and status = 'ACTIVE' and quantity is not null
    )
    select exists (
      select 1 from boundaries b
       where (
         coalesce((select sum(r.quantity) from equipment.bulk_reservations r
                    where r.equipment_type_id = ${typeId} and r.status = 'RESERVED' and r.period @> b.at), 0)
         + coalesce((select sum(u.quantity) from equipment.unavailability u
                      where u.equipment_type_id = ${typeId} and u.status = 'ACTIVE'
                        and u.quantity is not null and u.period @> b.at), 0)
       ) > ${proposedQuantity}
    ) as exceeds
  `;
  return row!.exceeds;
}

async function affectedUnitReservations(
  tx: TransactionSql,
  typeId: string,
  labels: readonly string[],
): Promise<AffectedReservation[]> {
  if (labels.length === 0) return [];
  const rows = await tx<{ event_reference: string; quantity: number }[]>`
    select r.event_reference, count(*)::int as quantity
      from equipment.unit_reservations r
      join equipment.equipment_units u on u.id = r.unit_id
     where u.equipment_type_id = ${typeId}
       and u.label in ${tx(labels)}
       and r.status = 'RESERVED'
     group by r.event_reference
     order by r.event_reference
  `;
  return rows.map((row) => ({ eventReference: row.event_reference, quantity: row.quantity }));
}

function typeChanges(before: EquipmentTypeRecord, after: EquipmentTypeInput, newTotal: number) {
  const changes: Record<string, { previous: unknown; new: unknown }> = {};
  const values = {
    name: [before.name, after.name],
    description: [before.description, after.description],
    characteristics: [before.characteristics, after.characteristics],
    totalQuantity: [before.totalQuantity, newTotal],
    unitLabels: [before.unitLabels, after.unitLabels],
  } as const;
  for (const [field, [previous, next]] of Object.entries(values)) {
    if (JSON.stringify(previous) !== JSON.stringify(next)) changes[field] = { previous, new: next };
  }
  return changes;
}

/**
 * Updates one P2 type while holding the same aggregate lock reservations use.
 * Serialized labels absent from the replacement list become RETIRED, never
 * deleted. A reserved unit or an overloaded bulk period refuses the whole
 * transaction and reports the affected event references and quantities.
 */
export async function updateEquipmentType(
  tx: TransactionSql,
  current: EquipmentTypeRecord,
  input: EquipmentTypeInput,
  actor: InventoryActor,
): Promise<EquipmentTypeRecord> {
  if (input.kind !== current.kind) throw new Error("An equipment type's kind cannot be changed.");
  const newTotal = input.kind === "BULK" ? input.totalQuantity! : input.unitLabels.length;

  const changes = typeChanges(current, input, newTotal);
  if (Object.keys(changes).length === 0) return current;

  if (input.kind === "BULK" && newTotal < current.totalQuantity) {
    const conflicts = await reductionExceedsUse(tx, current.id, newTotal);
    const affected = conflicts ? await affectedBulkReservations(tx, current.id, newTotal) : [];
    if (conflicts) throw new InventoryReductionConflictError(newTotal, affected);
  } else if (input.kind === "SERIALIZED") {
    const retained = new Set(input.unitLabels);
    const removed = current.unitLabels.filter((label) => !retained.has(label));
    const affected = await affectedUnitReservations(tx, current.id, removed);
    if (affected.length > 0) throw new InventoryReductionConflictError(newTotal, affected);
  }

  await tx`
    update equipment.equipment_types set
      name = ${input.name}, description = ${input.description},
      characteristics = ${tx.json(input.characteristics as never)},
      total_quantity = ${input.kind === "BULK" ? input.totalQuantity : null},
      updated_at = now(), updated_by = ${actor.userId}
    where id = ${current.id}
  `;

  if (input.kind === "SERIALIZED") {
    const wanted = new Set(input.unitLabels);
    for (const unit of current.units) {
      if (!wanted.has(unit.label)) {
        await tx`
          update equipment.equipment_units
             set status = 'RETIRED', updated_at = now(), updated_by = ${actor.userId}
           where id = ${unit.id}
        `;
      }
    }
    for (const label of input.unitLabels) {
      const [existing] = await tx<{ id: string }[]>`
        select id from equipment.equipment_units where equipment_type_id = ${current.id} and label = ${label}
      `;
      if (existing) {
        await tx`
          update equipment.equipment_units
             set status = 'ACTIVE', updated_at = now(), updated_by = ${actor.userId}
           where id = ${existing.id}
        `;
      } else {
        await tx`
          insert into equipment.equipment_units (equipment_type_id, label, status, created_by, updated_by)
          values (${current.id}, ${label}, 'ACTIVE', ${actor.userId}, ${actor.userId})
        `;
      }
    }
  }

  await recordInventoryHistory(tx, {
    equipmentTypeId: current.id,
    action: "TYPE_UPDATED",
    previousQuantity: current.totalQuantity,
    newQuantity: newTotal,
    changes,
  }, actor);
  return (await findEquipmentType(tx, current.id))!;
}

export interface UnavailabilityRecord {
  id: string;
  equipmentTypeId: string;
  unitId: string | null;
  quantity: number;
  startsAt: string;
  endsAt: string;
  reason: string;
  status: "ACTIVE" | "REMOVED";
  createdAt: string;
  createdBy: string | null;
  updatedAt: string;
  updatedBy: string | null;
}

/** Records a P2 unavailable quantity/unit and its audit row in the caller's transaction. */
export async function insertUnavailability(
  tx: TransactionSql,
  type: EquipmentTypeRecord,
  input: UnavailabilityInput,
  actor: InventoryActor,
): Promise<UnavailabilityRecord | null> {
  const quantity = type.kind === "BULK" ? input.quantity! : 1;
  if (type.kind === "BULK" && quantity > type.totalQuantity) {
    throw new UnavailabilityExceedsTotalError(quantity, type.totalQuantity);
  }
  if (type.kind === "SERIALIZED") {
    const unit = type.units.find(({ id }) => id === input.unitId);
    if (!unit) return null;
  }

  const [row] = await tx<{
    id: string;
    equipment_type_id: string;
    unit_id: string | null;
    quantity: number | null;
    starts_at: Date;
    ends_at: Date;
    reason: string;
    status: "ACTIVE" | "REMOVED";
    created_at: Date;
    created_by: string | null;
    updated_at: Date;
    updated_by: string | null;
  }[]>`
    insert into equipment.unavailability
      (equipment_type_id, unit_id, quantity, starts_at, ends_at, reason, status, created_by, updated_by)
    values
      (${type.id}, ${input.unitId}, ${input.quantity}, ${input.startsAt}, ${input.endsAt}, ${input.reason},
       'ACTIVE', ${actor.userId}, ${actor.userId})
    returning id, equipment_type_id, unit_id, quantity, starts_at, ends_at, reason, status,
              created_at, created_by, updated_at, updated_by
  `;
  await recordInventoryHistory(tx, {
    equipmentTypeId: type.id,
    unavailabilityId: row!.id,
    action: "UNAVAILABILITY_RECORDED",
    previousQuantity: 0,
    newQuantity: quantity,
    changes: { unavailableQuantity: { previous: 0, new: quantity } },
  }, actor);
  return {
    id: row!.id,
    equipmentTypeId: row!.equipment_type_id,
    unitId: row!.unit_id,
    quantity,
    startsAt: row!.starts_at.toISOString(),
    endsAt: row!.ends_at.toISOString(),
    reason: row!.reason,
    status: row!.status,
    createdAt: row!.created_at.toISOString(),
    createdBy: row!.created_by,
    updatedAt: row!.updated_at.toISOString(),
    updatedBy: row!.updated_by,
  };
}

/** P2 detail evidence, newest first. */
export async function listInventoryHistory(db: Db, typeId: string) {
  const rows = await db<{
    id: string;
    action: string;
    previous_quantity: number;
    new_quantity: number;
    changes: Record<string, unknown>;
    actor_user_id: string;
    actor_role: Role;
    occurred_at: Date;
  }[]>`
    select id, action, previous_quantity, new_quantity, changes, actor_user_id, actor_role, occurred_at
      from equipment.inventory_history where equipment_type_id = ${typeId}
     order by occurred_at desc, id desc
  `;
  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    previousQuantity: row.previous_quantity,
    newQuantity: row.new_quantity,
    changes: row.changes,
    actorUserId: row.actor_user_id,
    actorRole: row.actor_role,
    occurredAt: row.occurred_at.toISOString(),
  }));
}

export async function listUnavailability(db: Db, typeId: string): Promise<UnavailabilityRecord[]> {
  const rows = await db<{
    id: string;
    equipment_type_id: string;
    unit_id: string | null;
    quantity: number | null;
    starts_at: Date;
    ends_at: Date;
    reason: string;
    status: "ACTIVE" | "REMOVED";
    created_at: Date;
    created_by: string | null;
    updated_at: Date;
    updated_by: string | null;
  }[]>`
    select id, equipment_type_id, unit_id, quantity, starts_at, ends_at, reason, status,
           created_at, created_by, updated_at, updated_by
      from equipment.unavailability where equipment_type_id = ${typeId}
     order by starts_at, id
  `;
  return rows.map((row) => ({
    id: row.id,
    equipmentTypeId: row.equipment_type_id,
    unitId: row.unit_id,
    quantity: row.quantity ?? 1,
    startsAt: row.starts_at.toISOString(),
    endsAt: row.ends_at.toISOString(),
    reason: row.reason,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    createdBy: row.created_by,
    updatedAt: row.updated_at.toISOString(),
    updatedBy: row.updated_by,
  }));
}
