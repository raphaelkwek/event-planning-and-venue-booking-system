import type { TransactionSql } from "postgres";
import type { EquipmentKind, EquipmentRequestLineStatus, ErrorField } from "@connectsphere/contracts";
import { InsufficientEquipmentError } from "../domain/availability.js";
import { decideQuantity, reservationTarget, type ReservationBody } from "../domain/reservations.js";
import { availableUnits, lockEquipmentType, reserveBulk, reserveUnit } from "./inventory.js";
import { lockLine, markReserved, type Actor, type RequestLine } from "./requestLines.js";

/**
 * Q1 — reserves a request line's equipment in the caller's transaction.
 *
 * Lock order: the line, then its equipment type. O2 locks only lines and P2
 * only types, so nothing takes them the other way round. The type lock queues
 * reservations of one type, so when two race for the last unit the second sees
 * the first's rows and is refused with the shortfall (AC2).
 *
 * Throws InsufficientEquipmentError when the stock is short, before anything is
 * written; the caller's transaction rolls back. Other refusals are returned.
 */

export interface ReservationRecord {
  id: string;
  requestLineId: string;
  eventId: string;
  eventReference: string;
  equipmentTypeId: string;
  kind: EquipmentKind;
  requestedQuantity: number;
  reservedQuantity: number;
  startsAt: string;
  endsAt: string;
  status: "RESERVED" | "RELEASED";
  reservedBy: string;
  reservedAt: string;
}

export type ReserveOutcome =
  | { ok: true; reservation: ReservationRecord; line: RequestLine; previous: RequestLine }
  | { ok: false; code: "GONE" }
  | { ok: false; code: "LINE_NOT_RESERVABLE"; status: EquipmentRequestLineStatus }
  | { ok: false; code: "PARTIAL_NOT_CONFIRMED"; message: string }
  | { ok: false; code: "VALIDATION_FAILED"; fields: ErrorField[] };

interface ReservationRow {
  id: string;
  request_line_id: string;
  event_id: string;
  event_reference: string;
  equipment_type_id: string;
  kind: EquipmentKind;
  requested_quantity: number;
  reserved_quantity: number;
  starts_at: Date;
  ends_at: Date;
  status: "RESERVED" | "RELEASED";
  reserved_by: string;
  reserved_at: Date;
}

const toReservation = (row: ReservationRow): ReservationRecord => ({
  id: row.id,
  requestLineId: row.request_line_id,
  eventId: row.event_id,
  eventReference: row.event_reference,
  equipmentTypeId: row.equipment_type_id,
  kind: row.kind,
  requestedQuantity: row.requested_quantity,
  reservedQuantity: row.reserved_quantity,
  startsAt: row.starts_at.toISOString(),
  endsAt: row.ends_at.toISOString(),
  status: row.status,
  reservedBy: row.reserved_by,
  reservedAt: row.reserved_at.toISOString(),
});

export async function reserveLine(
  tx: TransactionSql,
  lineId: string,
  body: ReservationBody,
  actor: Actor,
): Promise<ReserveOutcome> {
  const current = await lockLine(tx, lineId);
  if (!current) return { ok: false, code: "GONE" };

  const target = reservationTarget(current);
  if (!target) return { ok: false, code: "LINE_NOT_RESERVABLE", status: current.status };

  const decision = decideQuantity(target.requestedQuantity, body);
  if (!decision.ok) return decision;

  const type = await lockEquipmentType(tx, target.equipmentTypeId);
  if (!type) throw new Error(`No such equipment type: ${target.equipmentTypeId}`);

  const period = { startsAt: new Date(current.requiredFrom), endsAt: new Date(current.requiredTo) };
  const forEvent = { eventId: current.eventId, eventReference: current.eventReference, actorUserId: actor.userId, ...period };

  let childIds: string[];
  if (type.kind === "BULK") {
    const bulk = await reserveBulk(tx, { equipmentTypeId: target.equipmentTypeId, quantity: decision.quantity, ...forEvent });
    childIds = [bulk.id];
  } else {
    const free = await availableUnits(tx, target.equipmentTypeId, period);
    if (free.length < decision.quantity) {
      throw new InsufficientEquipmentError({ requested: decision.quantity, available: free.length });
    }
    childIds = [];
    for (const unit of free.slice(0, decision.quantity)) {
      childIds.push((await reserveUnit(tx, { unitId: unit.id, ...forEvent })).id);
    }
  }

  const [row] = await tx<ReservationRow[]>`
    insert into equipment.reservations
      (request_line_id, event_id, event_reference, equipment_type_id, kind, requested_quantity, reserved_quantity,
       starts_at, ends_at, reserved_by, created_by, updated_by)
    values
      (${current.id}, ${current.eventId}, ${current.eventReference}, ${target.equipmentTypeId}, ${type.kind},
       ${target.requestedQuantity}, ${decision.quantity}, ${period.startsAt}, ${period.endsAt},
       ${actor.userId}, ${actor.userId}, ${actor.userId})
    returning *
  `;
  const reservation = toReservation(row!);
  if (type.kind === "BULK") {
    await tx`update equipment.bulk_reservations set reservation_id = ${reservation.id} where id in ${tx(childIds)}`;
  } else {
    await tx`update equipment.unit_reservations set reservation_id = ${reservation.id} where id in ${tx(childIds)}`;
  }

  const line = await markReserved(tx, current, reservation, actor);
  return { ok: true, reservation, line, previous: current };
}
