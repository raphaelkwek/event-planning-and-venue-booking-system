import type { TransactionSql } from "postgres";
import { findEventForChange } from "../../event/index.js";

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
