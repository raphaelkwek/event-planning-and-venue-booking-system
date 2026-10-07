import type { ISql, PendingQuery, Row, Sql, TransactionSql } from "postgres";
import type { EventStatus } from "@connectsphere/contracts";
import { transitionRule } from "../domain/statusMachine.js";
import { toEvent, type EventRow, type RawEvent } from "./events.js";

/**
 * F1 — the one statement in this service that changes an event's status.
 * Everything else reaches it through `transitionEvent`, which pairs it with the
 * transition table and the history entry; an architecture test fails if any
 * other statement sets `event.events.status`.
 */

/** A piece of SQL spliced into a statement: column assignments or a condition. */
export type Fragment = PendingQuery<Row[]>;

export interface StatusUpdate {
  eventId: string;
  from: readonly EventStatus[];
  to: EventStatus;
  /** Null for a system-initiated change. */
  actorId: string | null;
  /** Columns the action sets alongside the status, each followed by a comma. */
  set?: Fragment;
  /** A further condition on the row, beginning with `and`. */
  onlyIf?: Fragment;
}

/**
 * The condition in the `previous` CTE is the guard: the row is locked only if
 * its status is one the action may leave, so two concurrent actions cannot both
 * succeed — the second waits for the lock, re-reads the row, finds the status
 * moved on, and changes nothing (per-aggregate linearizability, §4.5). The
 * previous status comes from the same CTE, so the history entry can name it.
 */
export async function updateStatusIf(
  tx: TransactionSql,
  update: StatusUpdate
): Promise<{ event: EventRow; previousStatus: EventStatus } | null> {
  const rows = await tx<(RawEvent & { previous_status: EventStatus })[]>`
    with previous as (
      select id, status
      from event.events
      where id = ${update.eventId}
        and status in ${tx(update.from as string[])}
        ${update.onlyIf ?? tx``}
      for update
    )
    update event.events e set
      ${update.set ?? tx``}
      status = ${update.to},
      updated_at = now(),
      updated_by = ${update.actorId}
    from previous
    where e.id = previous.id
    returning e.*, previous.status as previous_status, (
      select a.coordinator_id from event.assignments a where a.event_id = e.id and a.is_active
    ) as assigned_coordinator_id
  `;
  const row = rows[0];
  return row ? { event: toEvent(row), previousStatus: row.previous_status } : null;
}

export async function readStatus(tx: TransactionSql, eventId: string): Promise<EventStatus | null> {
  const rows = await tx<{ status: EventStatus }[]>`
    select status from event.events where id = ${eventId}
  `;
  return rows[0]?.status ?? null;
}

/**
 * F1 AC6 — an event's end has passed once `now` reaches it. At exactly the end
 * instant it counts as passed: periods are half-open, `'[)'`, so the end
 * instant is not part of the event (implementation.md §4.4). The one place
 * this rule is written; both the completion guard and the sweep use it.
 */
export function endHasPassed(db: ISql, now: Date): Fragment {
  return db`and proposed_end_at <= ${now}`;
}

/** F1 — the events the completion sweep should complete, oldest ending first. */
export async function listDueForCompletion(sql: Sql, now: Date): Promise<string[]> {
  const rows = await sql<{ id: string }[]>`
    select id from event.events
    where status in ${sql(transitionRule("COMPLETE").from as string[])}
      ${endHasPassed(sql, now)}
    order by proposed_end_at, id
  `;
  return rows.map((row) => row.id);
}
