import type { Sql, TransactionSql } from "postgres";
import type {
  EquipmentLineHistoryAction,
  EquipmentRequestLineStatus,
  Role,
} from "@connectsphere/contracts";
import type { StatusChange, ValidLine } from "../domain/requestLines.js";

/**
 * O1/O2 — SQL for the equipment request lines (equipment schema only). Nothing is
 * deleted: removal sets a status, and every save, edit, removal and status change
 * writes a history row in the same transaction as the change.
 *
 * Writers lock the line row first (`lockLine`), so an O1 edit and an O2 status change
 * on the same line queue instead of one overwriting the other. The status they check
 * is read under that lock.
 */

type Db = Sql | TransactionSql;

export interface Actor {
  userId: string;
  role: Role;
}

export interface LineReservation {
  id: string;
  equipmentTypeId: string;
  /** The type actually reserved: the substitute's, for a Substituted line. */
  equipmentTypeName: string;
  requestedQuantity: number;
  reservedQuantity: number;
  reservedBy: string;
  reservedAt: string;
}

export interface RequestLine {
  id: string;
  seq: number;
  eventId: string;
  eventReference: string;
  equipmentTypeId: string;
  equipmentTypeName: string;
  quantity: number;
  notes: string;
  requiredFrom: string;
  requiredTo: string;
  status: EquipmentRequestLineStatus;
  requestedBy: string;
  requestedAt: string;
  statusChangedBy: string | null;
  statusChangedAt: string | null;
  unavailableReason: string | null;
  substituteEquipmentTypeId: string | null;
  substituteEquipmentTypeName: string | null;
  substituteQuantity: number | null;
  updatedAt: string;
  /** Q1: the line's active reservation, or null. */
  reservation: LineReservation | null;
}

export interface LineHistoryEntry {
  id: string;
  action: EquipmentLineHistoryAction;
  previousStatus: EquipmentRequestLineStatus | null;
  newStatus: EquipmentRequestLineStatus;
  equipmentTypeName: string;
  quantity: number;
  details: Record<string, unknown>;
  actorUserId: string;
  actorRole: string;
  occurredAt: string;
}

interface LineRow {
  id: string;
  seq: string;
  event_id: string;
  event_reference: string;
  equipment_type_id: string;
  equipment_type_name: string;
  quantity: number;
  notes: string;
  required_from: Date;
  required_to: Date;
  status: EquipmentRequestLineStatus;
  requested_by: string;
  requested_at: Date;
  status_changed_by: string | null;
  status_changed_at: Date | null;
  unavailable_reason: string | null;
  substitute_equipment_type_id: string | null;
  substitute_equipment_type_name: string | null;
  substitute_quantity: number | null;
  updated_at: Date;
  reservation_id: string | null;
  reservation_type_id: string | null;
  reservation_type_name: string | null;
  requested_quantity: number | null;
  reserved_quantity: number | null;
  reserved_by: string | null;
  reserved_at: Date | null;
}

function toLine(row: LineRow): RequestLine {
  return {
    id: row.id,
    seq: Number(row.seq),
    eventId: row.event_id,
    eventReference: row.event_reference,
    equipmentTypeId: row.equipment_type_id,
    equipmentTypeName: row.equipment_type_name,
    quantity: row.quantity,
    notes: row.notes,
    requiredFrom: row.required_from.toISOString(),
    requiredTo: row.required_to.toISOString(),
    status: row.status,
    requestedBy: row.requested_by,
    requestedAt: row.requested_at.toISOString(),
    statusChangedBy: row.status_changed_by,
    statusChangedAt: row.status_changed_at?.toISOString() ?? null,
    unavailableReason: row.unavailable_reason,
    substituteEquipmentTypeId: row.substitute_equipment_type_id,
    substituteEquipmentTypeName: row.substitute_equipment_type_name,
    substituteQuantity: row.substitute_quantity,
    updatedAt: row.updated_at.toISOString(),
    reservation: row.reservation_id
      ? {
          id: row.reservation_id,
          equipmentTypeId: row.reservation_type_id!,
          equipmentTypeName: row.reservation_type_name!,
          requestedQuantity: row.requested_quantity!,
          reservedQuantity: row.reserved_quantity!,
          reservedBy: row.reserved_by!,
          reservedAt: row.reserved_at!.toISOString(),
        }
      : null,
  };
}

/** A line with its type names, as the API shows it. */
function selectLines(db: Db) {
  return db`
    select l.id, l.seq, l.event_id, l.event_reference, l.equipment_type_id, t.name as equipment_type_name,
           l.quantity, l.notes, l.required_from, l.required_to, l.status, l.requested_by, l.requested_at,
           l.status_changed_by, l.status_changed_at, l.unavailable_reason, l.substitute_equipment_type_id,
           s.name as substitute_equipment_type_name, l.substitute_quantity, l.updated_at,
           r.id as reservation_id, r.equipment_type_id as reservation_type_id, rt.name as reservation_type_name,
           r.requested_quantity, r.reserved_quantity, r.reserved_by, r.reserved_at
    from equipment.equipment_request_lines l
    join equipment.equipment_types t on t.id = l.equipment_type_id
    left join equipment.equipment_types s on s.id = l.substitute_equipment_type_id
    left join equipment.reservations r on r.request_line_id = l.id and r.status = 'RESERVED'
    left join equipment.equipment_types rt on rt.id = r.equipment_type_id
  `;
}

export async function findLine(db: Db, id: string): Promise<RequestLine | null> {
  const rows = await db<LineRow[]>`${selectLines(db)} where l.id = ${id}`;
  return rows[0] ? toLine(rows[0]) : null;
}

export interface LineFilter {
  eventId?: string;
  status?: EquipmentRequestLineStatus;
  /** Continue after this `seq`. */
  after?: number;
  limit: number;
}

/** Removed lines are left out unless the caller asks for that status. */
export async function listLines(db: Db, filter: LineFilter): Promise<RequestLine[]> {
  const rows = await db<LineRow[]>`
    ${selectLines(db)}
    where ${filter.status ? db`l.status = ${filter.status}` : db`l.status <> 'REMOVED'`}
      and ${filter.eventId ? db`l.event_id = ${filter.eventId}` : db`true`}
      and ${filter.after !== undefined ? db`l.seq > ${filter.after}` : db`true`}
    order by l.seq
    limit ${filter.limit}
  `;
  return rows.map(toLine);
}

export async function listLineHistory(db: Db, lineId: string): Promise<LineHistoryEntry[]> {
  const rows = await db<
    {
      id: string;
      action: EquipmentLineHistoryAction;
      previous_status: EquipmentRequestLineStatus | null;
      new_status: EquipmentRequestLineStatus;
      equipment_type_name: string;
      quantity: number;
      details: Record<string, unknown>;
      actor_user_id: string;
      actor_role: string;
      occurred_at: Date;
    }[]
  >`
    select id, action, previous_status, new_status, equipment_type_name, quantity, details,
           actor_user_id, actor_role, occurred_at
    from equipment.request_line_history
    where line_id = ${lineId}
    order by occurred_at, created_at, id
  `;
  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    previousStatus: row.previous_status,
    newStatus: row.new_status,
    equipmentTypeName: row.equipment_type_name,
    quantity: row.quantity,
    details: row.details,
    actorUserId: row.actor_user_id,
    actorRole: row.actor_role,
    occurredAt: row.occurred_at.toISOString(),
  }));
}

/** The ids among `ids` that name no equipment type. */
export async function findMissingTypeIds(db: Db, ids: readonly string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const unique = [...new Set(ids)];
  const found = await db<{ id: string }[]>`select id from equipment.equipment_types where id in ${db(unique)}`;
  const known = new Set(found.map((row) => row.id));
  return unique.filter((id) => !known.has(id));
}

async function typeName(db: Db, id: string): Promise<string> {
  const rows = await db<{ name: string }[]>`select name from equipment.equipment_types where id = ${id}`;
  return rows[0]!.name;
}

interface HistoryInput {
  lineId: string;
  action: EquipmentLineHistoryAction;
  previousStatus: EquipmentRequestLineStatus | null;
  newStatus: EquipmentRequestLineStatus;
  equipmentTypeId: string;
  quantity: number;
  details: Record<string, unknown>;
  actor: Actor;
}

async function writeHistory(tx: TransactionSql, input: HistoryInput): Promise<void> {
  await tx`
    insert into equipment.request_line_history
      (line_id, action, previous_status, new_status, equipment_type_id, equipment_type_name, quantity,
       details, actor_user_id, actor_role, created_by, updated_by)
    values
      (${input.lineId}, ${input.action}, ${input.previousStatus}, ${input.newStatus}, ${input.equipmentTypeId},
       ${await typeName(tx, input.equipmentTypeId)}, ${input.quantity}, ${tx.json(input.details as never)},
       ${input.actor.userId}, ${input.actor.role}, ${input.actor.userId}, ${input.actor.userId})
  `;
}

export interface EventRef {
  id: string;
  reference: string;
}

/** O1: stores every line of a request as Submitted, with its CREATED history, in the caller's transaction. */
export async function insertLines(
  tx: TransactionSql,
  event: EventRef,
  lines: readonly ValidLine[],
  actor: Actor,
): Promise<RequestLine[]> {
  const created: RequestLine[] = [];
  for (const line of lines) {
    const [row] = await tx<{ id: string }[]>`
      insert into equipment.equipment_request_lines
        (event_id, event_reference, equipment_type_id, quantity, notes, required_from, required_to,
         requested_by, created_by, updated_by)
      values
        (${event.id}, ${event.reference}, ${line.equipmentTypeId}, ${line.quantity}, ${line.notes},
         ${line.requiredFrom}, ${line.requiredTo}, ${actor.userId}, ${actor.userId}, ${actor.userId})
      returning id
    `;
    await writeHistory(tx, {
      lineId: row!.id,
      action: "CREATED",
      previousStatus: null,
      newStatus: "SUBMITTED",
      equipmentTypeId: line.equipmentTypeId,
      quantity: line.quantity,
      details: { notes: line.notes, requiredFrom: line.requiredFrom.toISOString(), requiredTo: line.requiredTo.toISOString() },
      actor,
    });
    created.push((await findLine(tx, row!.id))!);
  }
  return created;
}

/** Locks the line row for the rest of the transaction and returns it, or null if there is none. */
export async function lockLine(tx: TransactionSql, id: string): Promise<RequestLine | null> {
  const locked = await tx<{ id: string }[]>`select id from equipment.equipment_request_lines where id = ${id} for update`;
  return locked[0] ? findLine(tx, id) : null;
}

/** O1: replaces the editable fields of a locked line. Status and requester are untouched. */
export async function updateLine(tx: TransactionSql, current: RequestLine, line: ValidLine, actor: Actor): Promise<RequestLine> {
  await tx`
    update equipment.equipment_request_lines
    set equipment_type_id = ${line.equipmentTypeId}, quantity = ${line.quantity}, notes = ${line.notes},
        required_from = ${line.requiredFrom}, required_to = ${line.requiredTo},
        updated_at = now(), updated_by = ${actor.userId}
    where id = ${current.id}
  `;
  await writeHistory(tx, {
    lineId: current.id,
    action: "EDITED",
    previousStatus: current.status,
    newStatus: current.status,
    equipmentTypeId: line.equipmentTypeId,
    quantity: line.quantity,
    details: {
      previousEquipmentTypeId: current.equipmentTypeId,
      previousQuantity: current.quantity,
      notes: line.notes,
      requiredFrom: line.requiredFrom.toISOString(),
      requiredTo: line.requiredTo.toISOString(),
    },
    actor,
  });
  return (await findLine(tx, current.id))!;
}

/** O1: removal is a status. The history row keeps the type and quantity removed. */
export async function markRemoved(tx: TransactionSql, current: RequestLine, actor: Actor): Promise<RequestLine> {
  await tx`
    update equipment.equipment_request_lines
    set status = 'REMOVED', updated_at = now(), updated_by = ${actor.userId}
    where id = ${current.id}
  `;
  await writeHistory(tx, {
    lineId: current.id,
    action: "REMOVED",
    previousStatus: current.status,
    newStatus: "REMOVED",
    equipmentTypeId: current.equipmentTypeId,
    quantity: current.quantity,
    details: {},
    actor,
  });
  return (await findLine(tx, current.id))!;
}

/**
 * O2: sets the new status and who/when. The line's own type and quantity are the original request and
 * are never written here; a substitution goes in the substitute columns, which other statuses clear.
 */
export async function applyStatusChange(
  tx: TransactionSql,
  current: RequestLine,
  change: StatusChange,
  actor: Actor,
): Promise<RequestLine> {
  await tx`
    update equipment.equipment_request_lines
    set status = ${change.status},
        status_changed_by = ${actor.userId}, status_changed_at = clock_timestamp(),
        unavailable_reason = ${change.reason},
        substitute_equipment_type_id = ${change.substituteEquipmentTypeId},
        substitute_quantity = ${change.substituteQuantity},
        updated_at = now(), updated_by = ${actor.userId}
    where id = ${current.id}
  `;
  const substituteName = change.substituteEquipmentTypeId ? await typeName(tx, change.substituteEquipmentTypeId) : null;
  await writeHistory(tx, {
    lineId: current.id,
    action: "STATUS_CHANGED",
    previousStatus: current.status,
    newStatus: change.status,
    equipmentTypeId: current.equipmentTypeId,
    quantity: current.quantity,
    details: {
      reason: change.reason,
      substituteEquipmentTypeId: change.substituteEquipmentTypeId,
      substituteEquipmentTypeName: substituteName,
      substituteQuantity: change.substituteQuantity,
    },
    actor,
  });
  return (await findLine(tx, current.id))!;
}

/** Q1: a locked Confirmed or Substituted line becomes Reserved, with its history entry. */
export async function markReserved(
  tx: TransactionSql,
  current: RequestLine,
  reservation: { id: string; equipmentTypeId: string; requestedQuantity: number; reservedQuantity: number },
  actor: Actor,
): Promise<RequestLine> {
  await tx`
    update equipment.equipment_request_lines
    set status = 'RESERVED',
        status_changed_by = ${actor.userId}, status_changed_at = clock_timestamp(),
        updated_at = now(), updated_by = ${actor.userId}
    where id = ${current.id}
  `;
  await writeHistory(tx, {
    lineId: current.id,
    action: "STATUS_CHANGED",
    previousStatus: current.status,
    newStatus: "RESERVED",
    equipmentTypeId: current.equipmentTypeId,
    quantity: current.quantity,
    details: {
      reservationId: reservation.id,
      equipmentTypeId: reservation.equipmentTypeId,
      equipmentTypeName: await typeName(tx, reservation.equipmentTypeId),
      requestedQuantity: reservation.requestedQuantity,
      reservedQuantity: reservation.reservedQuantity,
    },
    actor,
  });
  return (await findLine(tx, current.id))!;
}
