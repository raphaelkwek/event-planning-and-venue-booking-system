import type { Sql } from "postgres";
import type { EventStatus } from "@connectsphere/contracts";
import type { StatusHistoryRow } from "../domain/statusHistory.js";

/**
 * F2 — an event's status changes, oldest first. Read only: history is
 * append-only (F1), and nothing here or anywhere else updates or removes a row.
 * Field-level amendments share the table and are left out; this is the status
 * history.
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
    select id, previous_status, new_status, actor_user_id, actor_role, triggering_action, occurred_at
    from event.event_history
    where event_id = ${eventId} and entry_type = 'STATUS_CHANGE'
    order by occurred_at asc, created_at asc, id asc
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
