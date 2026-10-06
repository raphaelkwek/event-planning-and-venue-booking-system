import type { TransactionSql } from "postgres";
import type { EquipmentKind } from "@connectsphere/contracts";
import {
  availableQuantity,
  InsufficientEquipmentError,
  isUnitOverlap,
  peakConcurrentUse,
  UnitAlreadyReservedError,
} from "../domain/availability.js";

/**
 * Equipment availability and reservations (EN-02.2, ADR-0006, implementation.md
 * §4.6). SQL for the equipment schema only. P1, P2, Q1 and Q2 build on these.
 *
 * Serialized units are guarded by their exclusion constraint, so reserving one
 * needs no check first. Bulk stock has no row per unit to constrain, so a bulk
 * reservation takes the type's row lock and only then checks peak use: the lock
 * is what makes the check safe against a simultaneous reservation.
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

const windowOf = (period: Period) => ({ start: period.startsAt, end: period.endsAt });

/**
 * Takes the equipment type's row lock, held until the transaction ends. Bulk
 * reservations (Q1) and P2's reductions of the total both take it first, so
 * they serialise per type. Null when there is no such type.
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
 * Reserves one serialized unit for a period. The per-unit exclusion constraint
 * refuses an overlapping reservation; that refusal becomes
 * UnitAlreadyReservedError, naming the unit. The insert runs in a savepoint so
 * the unit's label can still be read after the refusal.
 */
export async function reserveUnit(tx: TransactionSql, input: UnitReservationInput): Promise<Reservation> {
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
