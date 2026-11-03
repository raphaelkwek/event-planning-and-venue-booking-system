import type { Sql } from "postgres";
import type { EventStatus } from "@connectsphere/contracts";
import type { StatusHistoryRow } from "../domain/statusHistory.js";

/**
 * F2 — an event's status changes, oldest first, read from the event's stream
 * (EN-03, ADR-0007), the record the history projection is built from. Read
 * only: the stream is append-only, and nothing here or anywhere else updates
 * or removes an entry. Field-level amendments share the stream and are left
 * out; this is the status history.
 *
 * Entries recorded at the same instant keep the order they were appended in.
 */
export async function listStatusHistory(sql: Sql, eventId: string): Promise<StatusHistoryRow[]> {
  const rows = await sql<
    {
      id: string;
      previous_status: EventStatus | null;
      new_status: EventStatus;
      actor_user_id: string | null;
      actor_role: string;
      triggering_action: string;
      occurred_at: Date;
    }[]
  >`
    select id, data ->> 'previousStatus' as previous_status, data ->> 'newStatus' as new_status,
      actor_user_id, actor_role, data ->> 'triggeringAction' as triggering_action, occurred_at
    from event.event_stream
    where aggregate_id = ${eventId} and type = 'STATUS_CHANGE'
    order by occurred_at asc, version asc
  `;
  return rows.map((row) => ({
    id: row.id,
    previousStatus: row.previous_status,
    newStatus: row.new_status,
    actorUserId: row.actor_user_id,
    actorRole: row.actor_role,
    triggeringAction: row.triggering_action,
    occurredAt: row.occurred_at,
  }));
}
