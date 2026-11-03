import type { TransactionSql } from "postgres";
import type { AccessScope } from "@connectsphere/contracts";
import { findEventForChange, type EventForChange } from "../../event/index.js";

/**
 * F3 AC5 — no new equipment request or reservation is raised against a cancelled
 * event. The check runs inside the write's transaction with the event row locked
 * `for share`, so it cannot interleave with a cancellation, which locks the event
 * `for update`: a reservation either commits first, and F4 then releases it, or
 * waits and sees the event Cancelled. The event lock is taken before any line or
 * type lock, as the cancellation takes it before the lines.
 */

const ALL_EVENTS = { scopeType: "ALL" } as const;

export class EventCancelledError extends Error {
  constructor() {
    super("This event has been cancelled, so no equipment can be requested or reserved for it.");
    this.name = "EventCancelledError";
  }
}

export async function refuseIfCancelled(tx: TransactionSql, eventId: string, callerId: string): Promise<void> {
  const event = await findEventForChange(tx, eventId, ALL_EVENTS, callerId, { lock: "share" });
  if (event?.status === "CANCELLED") throw new EventCancelledError();
}

/**
 * A4 — the event in the caller's scope, locked `for share` inside the write's transaction, before any
 * line or type lock (Q1's order: event, line, type). The scope was checked before the transaction too,
 * but a Lead's reassignment (E4) that commits in between takes the event out of the outgoing
 * coordinator's scope, and this check, made once the lock is held, sees it. Null when out of scope.
 */
export function lockEventInScope(tx: TransactionSql, eventId: string, scope: AccessScope, callerId: string): Promise<EventForChange | null> {
  return findEventForChange(tx, eventId, scope, callerId, { lock: "share" });
}

/** O1: `lockEventInScope`, refusing a cancelled event as `refuseIfCancelled` does (F3 AC5). */
export async function lockUncancelledEventInScope(
  tx: TransactionSql,
  eventId: string,
  scope: AccessScope,
  callerId: string
): Promise<EventForChange | null> {
  const event = await lockEventInScope(tx, eventId, scope, callerId);
  if (event?.status === "CANCELLED") throw new EventCancelledError();
  return event;
}
