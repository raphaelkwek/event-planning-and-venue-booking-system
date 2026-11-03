import type { TransactionSql } from "postgres";
import type { OutboxMessage } from "../events/outbox.js";
import {
  fieldChangeEntries,
  statusChangeEntry,
  type FieldChange,
  type StatusChange,
} from "../domain/eventStream.js";
import { appendToStream } from "./eventStream.js";

/**
 * An event's history: every status change (F1) and every field-level
 * amendment (D3, G1, S2). Since EN-03 each is an entry in the event's stream
 * (ADR-0007), and event.event_history is the stream's projection; both are
 * written by appendToStream in the caller's transaction. There is no update or
 * delete here, and none may be added — history cannot be edited (F2).
 */

export type { FieldChange, StatusChange };

/** F1 — one status change, and the message that publishes it when there is one. */
export async function recordStatusChange(
  tx: TransactionSql,
  eventId: string,
  change: StatusChange,
  outbox?: OutboxMessage
): Promise<void> {
  await appendToStream(tx, eventId, [statusChangeEntry(change)], { outbox });
}

/** F5 — when the event's latest status change was recorded, read from its stream, so a message carries the history's own time. */
export async function latestStatusChangeAt(tx: TransactionSql, eventId: string): Promise<string> {
  const [row] = await tx<{ occurred_at: Date }[]>`
    select occurred_at from event.event_stream
    where aggregate_id = ${eventId} and type = 'STATUS_CHANGE'
    order by occurred_at desc, version desc
    limit 1
  `;
  if (!row) throw new Error(`Event ${eventId} has no status change recorded.`);
  return row.occurred_at.toISOString();
}

/** D3 — the values as originally submitted, retained alongside the amendments. */
export async function recordFieldChanges(
  tx: TransactionSql,
  eventId: string,
  changes: FieldChange[],
  actor: { userId: string; role: string },
  triggeringAction: string,
  occurredAt?: Date
): Promise<void> {
  if (changes.length === 0) return;
  await appendToStream(tx, eventId, fieldChangeEntries(changes, actor, triggeringAction, occurredAt));
}
