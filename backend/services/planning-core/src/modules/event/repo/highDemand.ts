import type { TransactionSql } from "postgres";
import type { EventStatus } from "@connectsphere/contracts";

/**
 * EN-19 — reading an event's high-demand flag under its row lock, and writing
 * it. SQL against the event schema only.
 */

export interface LockedHighDemand {
  highDemand: boolean;
  status: EventStatus;
  ownerId: string;
  version: number;
}

/** Locks the event row for the rest of the transaction (as the registration settings do). Null when there is no such event. */
export async function lockHighDemand(tx: TransactionSql, eventId: string): Promise<LockedHighDemand | null> {
  const [row] = await tx<{ high_demand: boolean; status: EventStatus; owner_id: string; version: number }[]>`
    select high_demand, status, owner_id, version from event.events where id = ${eventId} for update
  `;
  return row ? { highDemand: row.high_demand, status: row.status, ownerId: row.owner_id, version: row.version } : null;
}

/** The version trigger raises the version (migration event/0009). */
export async function saveHighDemand(tx: TransactionSql, eventId: string, highDemand: boolean, actorUserId: string): Promise<void> {
  await tx`
    update event.events set high_demand = ${highDemand}, updated_at = now(), updated_by = ${actorUserId}
    where id = ${eventId}
  `;
}
