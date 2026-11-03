import type { TransactionSql } from "postgres";
import { writeOutbox, type OutboxMessage } from "../events/outbox.js";
import type { StreamEntry } from "../domain/eventStream.js";

/**
 * EN-03 (ADR-0007) — an event's stream: the record of everything that happened
 * to its history, in order, append-only and hash-chained
 * (migrations/event/0022).
 */

/** Two appends computed the same next version for one event; the later one is refused. */
export class StreamVersionTakenError extends Error {
  constructor(readonly eventId: string) {
    super(`Another change to event ${eventId} was recorded first, so this one was not stored.`);
    this.name = "StreamVersionTakenError";
  }
}

export interface AppendedEntry {
  id: string;
  version: number;
  hash: string;
}

const VERSION_GUARD = "event_stream_one_entry_per_version";

function versionTaken(eventId: string) {
  return (error: unknown): never => {
    const pg = error as { code?: string; constraint_name?: string };
    if (pg.code === "23505" && pg.constraint_name === VERSION_GUARD) throw new StreamVersionTakenError(eventId);
    throw error;
  };
}

/**
 * The one way anything is added to an event's history. In the caller's
 * transaction, for each entry in order, it:
 * 1. appends the entry to the stream (`event.append_to_stream`), which takes the
 *    next version and hashes the entry with the previous entry's hash;
 * 2. writes the history projection's row (`event.event_history`) from the
 *    stream entry, with the entry's id, so the two cannot disagree;
 * then, when the change is published, writes its outbox row (§3.4).
 *
 * It takes no lock: call it holding the event's row lock, as every writer does
 * (§4.6). If two appends to one event ever race without it, the second is
 * refused with StreamVersionTakenError and its transaction stores nothing.
 */
export async function appendToStream(
  tx: TransactionSql,
  eventId: string,
  entries: readonly StreamEntry[],
  options: { outbox?: OutboxMessage } = {}
): Promise<AppendedEntry[]> {
  const appended: AppendedEntry[] = [];

  for (const entry of entries) {
    const [row] = await tx<{ entry_id: string; entry_version: number; entry_hash: string }[]>`
      select entry_id, entry_version, entry_hash
      from event.append_to_stream(
        ${eventId}::uuid,
        ${entry.type}::text,
        event.history_entry_data(
          ${entry.type}::text, ${entry.previousStatus}::text, ${entry.newStatus}::text,
          ${entry.fieldName}::text, ${entry.previousValue}::text, ${entry.newValue}::text,
          ${entry.triggeringAction}::text
        ),
        ${entry.actorUserId}::uuid,
        ${entry.actorRole}::text,
        ${entry.occurredAt}::timestamptz
      )
    `.catch(versionTaken(eventId));

    // The projection, built from the stored entry rather than from `entry`, so
    // it carries the entry's own time to the microsecond.
    await tx`
      insert into event.event_history (
        id, event_id, entry_type, previous_status, new_status, field_name, previous_value,
        new_value, actor_user_id, actor_role, triggering_action, occurred_at, created_by, updated_by
      )
      select
        s.id, s.aggregate_id, s.type, s.data ->> 'previousStatus', s.data ->> 'newStatus',
        s.data ->> 'fieldName', s.data ->> 'previousValue', s.data ->> 'newValue',
        s.actor_user_id, s.actor_role, s.data ->> 'triggeringAction', s.occurred_at,
        s.actor_user_id, s.actor_user_id
      from event.event_stream s
      where s.id = ${row!.entry_id}
    `;

    appended.push({ id: row!.entry_id, version: row!.entry_version, hash: row!.entry_hash });
  }

  if (options.outbox) await writeOutbox(tx, options.outbox);
  return appended;
}
