import type { Sql, TransactionSql } from "postgres";

/**
 * D2, D3 — one row per clarification round. Rounds are retained in order and
 * never overwritten (D2's last acceptance criterion).
 */
export interface ClarificationRow {
  id: string;
  eventId: string;
  message: string;
  requestedBy: string;
  requestedAt: string;
  status: "OPEN" | "RESPONDED";
  responseMessage: string | null;
  respondedBy: string | null;
  respondedAt: string | null;
}

interface RawClarification {
  id: string;
  event_id: string;
  message: string;
  requested_by: string;
  requested_at: Date;
  status: "OPEN" | "RESPONDED";
  response_message: string | null;
  responded_by: string | null;
  responded_at: Date | null;
}

function toClarification(row: RawClarification): ClarificationRow {
  return {
    id: row.id,
    eventId: row.event_id,
    message: row.message,
    requestedBy: row.requested_by,
    requestedAt: row.requested_at.toISOString(),
    status: row.status,
    responseMessage: row.response_message,
    respondedBy: row.responded_by,
    respondedAt: row.responded_at?.toISOString() ?? null,
  };
}

export async function insertClarification(
  tx: TransactionSql,
  eventId: string,
  message: string,
  requestedBy: string
): Promise<ClarificationRow> {
  const rows = await tx<RawClarification[]>`
    insert into event.clarifications (event_id, message, requested_by, status, created_by, updated_by)
    values (${eventId}, ${message}, ${requestedBy}, 'OPEN', ${requestedBy}, ${requestedBy})
    returning *
  `;
  return toClarification(rows[0]!);
}

export async function findOpenClarification(
  tx: TransactionSql,
  eventId: string
): Promise<ClarificationRow | null> {
  const rows = await tx<RawClarification[]>`
    select * from event.clarifications
    where event_id = ${eventId} and status = 'OPEN'
    order by requested_at desc
    limit 1
    for update
  `;
  return rows[0] ? toClarification(rows[0]) : null;
}

export async function recordResponse(
  tx: TransactionSql,
  clarificationId: string,
  responseMessage: string | null,
  respondedBy: string
): Promise<ClarificationRow> {
  const rows = await tx<RawClarification[]>`
    update event.clarifications set
      status = 'RESPONDED',
      response_message = ${responseMessage},
      responded_by = ${respondedBy},
      responded_at = now(),
      updated_at = now(),
      updated_by = ${respondedBy}
    where id = ${clarificationId}
    returning *
  `;
  return toClarification(rows[0]!);
}

export async function listClarifications(sql: Sql, eventId: string): Promise<ClarificationRow[]> {
  const rows = await sql<RawClarification[]>`
    select * from event.clarifications
    where event_id = ${eventId}
    order by requested_at asc
  `;
  return rows.map(toClarification);
}

/** D3 — the values as originally submitted, retained alongside the amendments. */
export async function insertFieldEdits(
  tx: TransactionSql,
  eventId: string,
  edits: { fieldName: string; previousValue: string | null; newValue: string | null }[],
  actorId: string
): Promise<void> {
  if (edits.length === 0) return;

  await tx`
    insert into event.event_field_edits ${tx(
      edits.map((edit) => ({
        event_id: eventId,
        field_name: edit.fieldName,
        previous_value: edit.previousValue,
        new_value: edit.newValue,
        source: "CLARIFICATION_RESPONSE",
        edited_by: actorId,
        created_by: actorId,
        updated_by: actorId,
      }))
    )}
  `;
}
