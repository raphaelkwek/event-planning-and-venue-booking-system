import type { TransactionSql } from "postgres";
import { transitionEvent, type TransitionOutcome } from "./transitionEvent.js";

/**
 * S3 (AC7, Week 9 W9-22) — an approved significant change to a Confirmed event
 * sends it back to Planning, from where it passes F5 and a new safety check
 * (U1) again. Applies F1's RECONSIDER_AFTER_CHANGE through `transitionEvent`,
 * so the status-change history entry and `event.status-changed` are written as
 * for every other transition, inside the caller's transaction.
 *
 * The change module calls this only for a Confirmed event; for any other
 * status it changes nothing and returns ok:false (AC6). The caller has
 * already locked the event row; locking it again in the same transaction is a
 * no-op in Postgres.
 */
export function returnToPlanningAfterChange(
  tx: TransactionSql,
  eventId: string,
  actor: { userId: string; role: string },
  options: { correlationId?: string | null } = {}
): Promise<TransitionOutcome> {
  return transitionEvent(tx, eventId, "RECONSIDER_AFTER_CHANGE", actor, { correlationId: options.correlationId ?? null });
}
