import type { Sql, TransactionSql } from "postgres";

/**
 * U1 (CR-06) — what the Safety Officer weighs about an event's equipment: each request line that
 * is not Removed, with the quantity requested, what is reserved and the coordinator's placement
 * notes (the line's notes). Read only. SQL against the equipment schema only.
 */

type Db = Sql | TransactionSql;

export interface EquipmentSafetyFactor {
  lineId: string;
  equipmentTypeName: string;
  quantity: number;
  /** The active reservation's id: the id a request for changes names to flag this equipment. Null when nothing is reserved. */
  reservationId: string | null;
  reservedQuantity: number;
  placementNotes: string;
}

export async function equipmentSafetyFactors(db: Db, eventId: string): Promise<EquipmentSafetyFactor[]> {
  const rows = await db<
    { id: string; type_name: string; quantity: number; notes: string; reservation_id: string | null; reserved_quantity: number | null }[]
  >`
    select l.id, t.name as type_name, l.quantity, l.notes, r.id as reservation_id, r.reserved_quantity
    from equipment.equipment_request_lines l
    join equipment.equipment_types t on t.id = l.equipment_type_id
    left join equipment.reservations r on r.request_line_id = l.id and r.status = 'RESERVED'
    where l.event_id = ${eventId} and l.status <> 'REMOVED'
    order by l.seq
  `;
  return rows.map((row) => ({
    lineId: row.id,
    equipmentTypeName: row.type_name,
    quantity: row.quantity,
    reservationId: row.reservation_id,
    reservedQuantity: row.reserved_quantity ?? 0,
    placementNotes: row.notes,
  }));
}
