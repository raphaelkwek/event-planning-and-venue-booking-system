import type { Sql, TransactionSql } from "postgres";
import type { EventStatus } from "@connectsphere/contracts";

/**
 * F1 — every status change writes a history entry. Append only: there is no
 * update or delete function here, and none may be added (F2).
 */
export interface HistoryEntry {
  previousStatus: EventStatus | null;
  newStatus: EventStatus;
  actorUserId: string | null;
  actorRole: string;
  triggeringAction: string;
}

export async function insertHistory(
  tx: TransactionSql,
  eventId: string,
  entry: HistoryEntry
): Promise<void> {
  await tx`
    insert into event.status_history (
      event_id, previous_status, new_status, actor_user_id, actor_role,
      triggering_action, created_by, updated_by
    ) values (
      ${eventId}, ${entry.previousStatus}, ${entry.newStatus}, ${entry.actorUserId},
      ${entry.actorRole}, ${entry.triggeringAction}, ${entry.actorUserId}, ${entry.actorUserId}
    )
  `;
}

export interface HistoryRow extends HistoryEntry {
  occurredAt: string;
}

export async function listHistory(sql: Sql, eventId: string): Promise<HistoryRow[]> {
  const rows = await sql<
    {
      previous_status: EventStatus | null;
      new_status: EventStatus;
      actor_user_id: string | null;
      actor_role: string;
      triggering_action: string;
      occurred_at: Date;
    }[]
  >`
    select previous_status, new_status, actor_user_id, actor_role, triggering_action, occurred_at
    from event.status_history
    where event_id = ${eventId}
    order by occurred_at asc
  `;

  return rows.map((row) => ({
    previousStatus: row.previous_status,
    newStatus: row.new_status,
    actorUserId: row.actor_user_id,
    actorRole: row.actor_role,
    triggeringAction: row.triggering_action,
    occurredAt: row.occurred_at.toISOString(),
  }));
}
