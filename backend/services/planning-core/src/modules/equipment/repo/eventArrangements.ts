import type { TransactionSql } from "postgres";
import type { EquipmentRequestLineStatus } from "@connectsphere/contracts";

/**
 * F5 — an event's equipment arrangements, read live at the moment of
 * confirmation. SQL against the equipment schema only: every line that is not
 * Removed, in list order, with its active reservation if it has one.
 *
 * Lines and reservations are taken `for share` inside the confirmation's
 * transaction, so a Q1 reservation, a Q2 release or an O2 status change on
 * them waits until the event's status has changed (implementation.md §4.7).
 * The caller has already locked the event. S3 adds the "flagged for review"
 * flag on a reservation here once it stores one.
 */

export interface EquipmentArrangementLine {
  id: string;
  /** The type and quantity the coordinator requested (O1), as the line is named to them. */
  equipmentTypeName: string;
  quantity: number;
  status: EquipmentRequestLineStatus;
  reservation: {
    id: string;
    /** What Q1 set out to reserve: the line's quantity, or O2's substitute quantity. */
    requestedQuantity: number;
    reservedQuantity: number;
    /** The Technical Support Staff member who reserved it: who F5 notifies. */
    reservedBy: string;
    reservedTypeName: string;
  } | null;
}

export async function equipmentArrangementsForEvent(tx: TransactionSql, eventId: string): Promise<EquipmentArrangementLine[]> {
  const lines = await tx<{ id: string; type_name: string; quantity: number; status: EquipmentRequestLineStatus }[]>`
    select l.id, t.name as type_name, l.quantity, l.status
    from equipment.equipment_request_lines l
    join equipment.equipment_types t on t.id = l.equipment_type_id
    where l.event_id = ${eventId} and l.status <> 'REMOVED'
    order by l.seq
    for share of l
  `;

  const reservations = await tx<
    { id: string; request_line_id: string; requested_quantity: number; reserved_quantity: number; reserved_by: string; type_name: string }[]
  >`
    select r.id, r.request_line_id, r.requested_quantity, r.reserved_quantity, r.reserved_by, t.name as type_name
    from equipment.reservations r
    join equipment.equipment_types t on t.id = r.equipment_type_id
    where r.event_id = ${eventId} and r.status = 'RESERVED'
    for share of r
  `;

  return lines.map((line) => {
    const reservation = reservations.find((candidate) => candidate.request_line_id === line.id);
    return {
      id: line.id,
      equipmentTypeName: line.type_name,
      quantity: line.quantity,
      status: line.status,
      reservation: reservation
        ? {
            id: reservation.id,
            requestedQuantity: reservation.requested_quantity,
            reservedQuantity: reservation.reserved_quantity,
            reservedBy: reservation.reserved_by,
            reservedTypeName: reservation.type_name,
          }
        : null,
    };
  });
}
