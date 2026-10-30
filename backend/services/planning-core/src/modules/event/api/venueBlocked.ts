import type { TransactionSql } from "postgres";
import type { EventStatus } from "@connectsphere/contracts";
import { transitionRule } from "../domain/statusMachine.js";
import { lockEventStatuses } from "../repo/eventStatus.js";
import { transitionEvent } from "./transitionEvent.js";

/**
 * I3 — the event module's half of a block over confirmed bookings. The venue
 * module names the events whose confirmed bookings the block disrupts; each
 * that is Confirmed moves to Planning through F1's VENUE_BLOCKED transition,
 * which writes the history entry (by the Venue Staff member, naming the block
 * as the trigger) and `event.status-changed`. The event is kept, never
 * cancelled (W9-50); an event in any other status is left as it is.
 */

/** Whether a block over its confirmed booking would return an event in `status` to Planning: I2's review says so beforehand. */
export function blockReturnsToPlanning(status: EventStatus): boolean {
  return transitionRule("VENUE_BLOCKED").from.includes(status);
}

/**
 * Returns the ids of the events it moved. Call it inside the block's
 * transaction, after the venue row lock and before the bookings are flagged:
 * F5 locks the event and then its bookings, so taking them in the same order
 * here means the two cannot deadlock (implementation.md §4.6).
 */
export async function returnBlockedEventsToPlanning(
  tx: TransactionSql,
  eventIds: readonly string[],
  actor: { userId: string; role: string; correlationId?: string | null }
): Promise<Set<string>> {
  const statuses = await lockEventStatuses(tx, [...new Set(eventIds)]);
  const returned = new Set<string>();
  for (const [eventId, status] of statuses) {
    if (!blockReturnsToPlanning(status)) continue;
    const moved = await transitionEvent(tx, eventId, "VENUE_BLOCKED", { userId: actor.userId, role: actor.role }, {
      correlationId: actor.correlationId ?? null,
    });
    if (moved.ok) returned.add(eventId);
  }
  return returned;
}
