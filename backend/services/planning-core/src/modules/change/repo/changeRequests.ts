import type { Sql, TransactionSql } from "postgres";
import { isSignificantEventField, SIGNIFICANT_EVENT_FIELDS, type SignificantEventField } from "@connectsphere/contracts";
import type { ProposedChanges } from "../../event/index.js";

/**
 * S1 — SQL for change requests (change schema only). The event's own row is
 * never read or written here: the event module hands over its current values,
 * and this module stores them as the request's snapshot (AC3).
 */

type Db = Sql | TransactionSql;

export interface ChangeRequestFieldRecord {
  fieldName: SignificantEventField;
  currentValue: unknown;
  proposedValue: unknown;
}

export interface ChangeRequestRecord {
  id: string;
  eventId: string;
  eventReference: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reason: string;
  requestedBy: string;
  requestedAt: string;
  decidedBy: string | null;
  decidedAt: string | null;
  rejectionReason: string | null;
  fields: ChangeRequestFieldRecord[];
}

/** Another request is already pending for the event (AC5); it names that request. */
export class ChangeRequestAlreadyPendingError extends Error {
  constructor(readonly existing: ChangeRequestRecord) {
    super("A change request is already pending for this event.");
    this.name = "ChangeRequestAlreadyPendingError";
  }
}

const ONE_PENDING_INDEX = "change_requests_one_pending_per_event";

function isAlreadyPending(error: unknown): boolean {
  const e = error as { code?: string; constraint_name?: string } | null;
  return e?.code === "23505" && e.constraint_name === ONE_PENDING_INDEX;
}

interface RequestRow {
  id: string;
  event_id: string;
  event_reference: string;
  status: ChangeRequestRecord["status"];
  reason: string;
  requested_by: string;
  requested_at: Date;
  decided_by: string | null;
  decided_at: Date | null;
  rejection_reason: string | null;
}

interface FieldRow {
  request_id: string;
  field_name: string;
  current_value: unknown;
  proposed_value: unknown;
}

/**
 * A JSON null is a real value (the field was empty), so it is sent as JSON text and cast, not as
 * `tx.json(null)`, which postgres.js sends as SQL NULL.
 */
// Sent as text and cast to jsonb in SQL, so a JSON null is stored as a value
// (a null snapshot), not as SQL NULL. Casting the parameter straight to jsonb
// would make the driver JSON-encode the already encoded text a second time,
// storing 150 as the string "150".
const jsonText = (value: unknown) => JSON.stringify(value ?? null);

async function withFields(db: Db, rows: RequestRow[]): Promise<ChangeRequestRecord[]> {
  if (rows.length === 0) return [];
  const fieldRows = await db<FieldRow[]>`
    select request_id, field_name, current_value, proposed_value
    from change.change_request_fields
    where request_id in ${db(rows.map((row) => row.id))}
  `;
  return rows.map((row) => ({
    id: row.id,
    eventId: row.event_id,
    eventReference: row.event_reference,
    status: row.status,
    reason: row.reason,
    requestedBy: row.requested_by,
    requestedAt: row.requested_at.toISOString(),
    decidedBy: row.decided_by,
    decidedAt: row.decided_at ? row.decided_at.toISOString() : null,
    rejectionReason: row.rejection_reason,
    fields: fieldRows
      .filter((field) => field.request_id === row.id && isSignificantEventField(field.field_name))
      .sort(
        (a, b) =>
          SIGNIFICANT_EVENT_FIELDS.indexOf(a.field_name as SignificantEventField) -
          SIGNIFICANT_EVENT_FIELDS.indexOf(b.field_name as SignificantEventField)
      )
      .map((field) => ({
        fieldName: field.field_name as SignificantEventField,
        currentValue: field.current_value ?? null,
        proposedValue: field.proposed_value ?? null,
      })),
  }));
}

/** Inserts the request and its fields; the partial unique index refuses a second pending one (AC5). */
export async function insertChangeRequest(
  tx: TransactionSql,
  input: {
    event: { id: string; reference: string };
    reason: string;
    changes: ProposedChanges;
    current: Record<string, unknown>;
    actorId: string;
  }
): Promise<ChangeRequestRecord> {
  let row: RequestRow;
  try {
    // A savepoint, so a refused insert leaves the transaction usable to read the request that blocked it.
    const inserted = await tx.savepoint(
      (sp) => sp<RequestRow[]>`
        insert into change.change_requests (event_id, event_reference, requested_by, reason, created_by, updated_by)
        values (${input.event.id}, ${input.event.reference}, ${input.actorId}, ${input.reason}, ${input.actorId}, ${input.actorId})
        returning id, event_id, event_reference, status, reason, requested_by, requested_at,
      decided_by, decided_at, rejection_reason
      `
    );
    row = inserted[0]!;
  } catch (error) {
    if (!isAlreadyPending(error)) throw error;
    const existing = await findPendingForEvent(tx, input.event.id);
    if (!existing) throw error;
    throw new ChangeRequestAlreadyPendingError(existing);
  }

  const names = Object.keys(input.changes).filter(isSignificantEventField);
  for (const name of names) {
    await tx`
      insert into change.change_request_fields (request_id, field_name, current_value, proposed_value)
      values (${row.id}, ${name}, ${jsonText(input.current[name])}::text::jsonb, ${jsonText(input.changes[name])}::text::jsonb)
    `;
  }
  const [record] = await withFields(tx, [row]);
  return record!;
}

export async function findPendingForEvent(db: Db, eventId: string): Promise<ChangeRequestRecord | null> {
  const rows = await db<RequestRow[]>`
    select id, event_id, event_reference, status, reason, requested_by, requested_at,
      decided_by, decided_at, rejection_reason
    from change.change_requests
    where event_id = ${eventId} and status = 'PENDING'
  `;
  return (await withFields(db, rows))[0] ?? null;
}

/** Newest first. */
export async function listForEvent(db: Db, eventId: string): Promise<ChangeRequestRecord[]> {
  const rows = await db<RequestRow[]>`
    select id, event_id, event_reference, status, reason, requested_by, requested_at,
      decided_by, decided_at, rejection_reason
    from change.change_requests
    where event_id = ${eventId}
    order by requested_at desc, id
  `;
  return withFields(db, rows);
}

/** S2 — the request, locked `for update` until the transaction ends; null when there is none. */
export async function lockRequest(tx: TransactionSql, id: string): Promise<ChangeRequestRecord | null> {
  const rows = await tx<RequestRow[]>`
    select id, event_id, event_reference, status, reason, requested_by, requested_at,
      decided_by, decided_at, rejection_reason
    from change.change_requests
    where id = ${id}
    for update
  `;
  return (await withFields(tx, rows))[0] ?? null;
}

/** S2 — records the decision on a request the caller holds locked; the check constraint ties the columns to the status. */
export async function recordDecision(
  tx: TransactionSql,
  id: string,
  decision: { status: "APPROVED" | "REJECTED"; actorId: string; reason: string | null; at?: Date }
): Promise<ChangeRequestRecord> {
  const rows = await tx<RequestRow[]>`
    update change.change_requests
    set status = ${decision.status}, decided_by = ${decision.actorId}, decided_at = ${decision.at ?? tx`clock_timestamp()`},
        rejection_reason = ${decision.reason}, updated_at = now(), updated_by = ${decision.actorId}
    where id = ${id}
    returning id, event_id, event_reference, status, reason, requested_by, requested_at,
      decided_by, decided_at, rejection_reason
  `;
  return (await withFields(tx, rows))[0]!;
}
