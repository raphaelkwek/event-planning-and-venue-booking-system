import type { Sql, TransactionSql } from "postgres";

/**
 * S3 (SPM-59) — the reservations an approved significant change is assessed
 * against, the Flagged for review flags the change module stores on them, and
 * the flags still outstanding on an event (AC8). SQL against the equipment
 * schema only.
 *
 * A flag is reservations.flagged_for_review, which F5 reads (AC9), plus a row
 * in equipment.reservation_flags saying which change request set it and why.
 * The types below match the change module's ImpactReservation and
 * ReservationFlag, so it passes its values straight in without this module
 * importing it.
 */

type Db = Sql | TransactionSql;

export interface ImpactReservationRow {
  id: string;
  lineId: string;
  equipmentTypeName: string;
  reservedQuantity: number;
  startsAt: string;
  endsAt: string;
  reservedBy: string;
}

export interface ReservationFlagInput {
  reservationId: string;
  flag: "FLAGGED_FOR_REVIEW";
  reason: string;
  details: Record<string, unknown>;
}

export interface OutstandingReservationFlag {
  reservationId: string;
  equipmentTypeName: string;
  flag: "FLAGGED_FOR_REVIEW";
  reason: string;
  flaggedAt: string;
}

/**
 * The event's RESERVED reservations, soonest first, locked `for update`
 * inside the approval's transaction so nothing changes them between the
 * assessment and the flags. The caller has already locked the event.
 */
export async function reservationsForImpact(tx: TransactionSql, eventId: string): Promise<ImpactReservationRow[]> {
  const rows = await tx<
    { id: string; request_line_id: string; type_name: string; reserved_quantity: number; starts_at: Date; ends_at: Date; reserved_by: string }[]
  >`
    select r.id, r.request_line_id, t.name as type_name, r.reserved_quantity, r.starts_at, r.ends_at, r.reserved_by
    from equipment.reservations r
    join equipment.equipment_types t on t.id = r.equipment_type_id
    where r.event_id = ${eventId} and r.status = 'RESERVED'
    order by r.starts_at, t.name, r.id
    for update of r
  `;
  return rows.map((row) => ({
    id: row.id,
    lineId: row.request_line_id,
    equipmentTypeName: row.type_name,
    reservedQuantity: row.reserved_quantity,
    startsAt: row.starts_at.toISOString(),
    endsAt: row.ends_at.toISOString(),
    reservedBy: row.reserved_by,
  }));
}

/** Flags each reservation for review and records why. Call inside the approval's transaction. */
export async function flagReservations(
  tx: TransactionSql,
  eventId: string,
  changeRequestId: string,
  flags: readonly ReservationFlagInput[]
): Promise<void> {
  for (const flag of flags) {
    await tx`update equipment.reservations set flagged_for_review = true, updated_at = now() where id = ${flag.reservationId}`;
    await tx`
      insert into equipment.reservation_flags (reservation_id, event_id, change_request_id, flag, reason, details)
      values (${flag.reservationId}, ${eventId}, ${changeRequestId}, ${flag.flag}, ${flag.reason},
              ${JSON.stringify(flag.details)}::text::jsonb)
    `;
  }
}

/** The event's flags that still hold: the reservation is RESERVED and still flagged. Oldest first. */
export async function outstandingReservationFlags(db: Db, eventId: string): Promise<OutstandingReservationFlag[]> {
  const rows = await db<{ reservation_id: string; type_name: string; flag: "FLAGGED_FOR_REVIEW"; reason: string; flagged_at: Date }[]>`
    select f.reservation_id, t.name as type_name, f.flag, f.reason, f.flagged_at
    from equipment.reservation_flags f
    join equipment.reservations r on r.id = f.reservation_id
    join equipment.equipment_types t on t.id = r.equipment_type_id
    where f.event_id = ${eventId} and r.status = 'RESERVED' and r.flagged_for_review
    order by f.flagged_at, t.name, f.id
  `;
  return rows.map((row) => ({
    reservationId: row.reservation_id,
    equipmentTypeName: row.type_name,
    flag: row.flag,
    reason: row.reason,
    flaggedAt: row.flagged_at.toISOString(),
  }));
}
