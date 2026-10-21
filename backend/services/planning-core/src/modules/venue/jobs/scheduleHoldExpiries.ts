import type { Sql } from "postgres";
import { logger } from "../../../shared/logger.js";

/**
 * L6 — the backfill behind `npm run jobs:schedule-hold-expiries`: holds placed
 * before L6 have no expiry timer, because their `hold-placed` message was never
 * written. This reads every Held hold and asks the scheduler (signal-with-start
 * on the hold's workflow) to start its timers. Safe to run again: a hold that
 * already has a run is only told the same expiry, which the workflow ignores.
 */

export interface HeldHold {
  holdId: string;
  expiresAt: string;
  reminderLeadMinutes: number;
}

export interface HoldExpiryScheduling {
  schedule(hold: HeldHold): Promise<void>;
}

export async function listHeldHolds(sql: Sql): Promise<HeldHold[]> {
  const rows = await sql<{ id: string; expiresAt: Date; reminderLeadMinutes: number }[]>`
    select id, expires_at as "expiresAt", reminder_lead_minutes as "reminderLeadMinutes"
    from venue.holds
    where status = 'HELD' and expires_at is not null
    order by expires_at
  `;
  return rows.map((row) => ({
    holdId: row.id,
    expiresAt: new Date(row.expiresAt).toISOString(),
    reminderLeadMinutes: row.reminderLeadMinutes,
  }));
}

/** Schedules each hold in turn; one failure doesn't stop the rest. Returns the process exit code. */
export async function scheduleHoldExpiries(holds: HeldHold[], scheduler: HoldExpiryScheduling): Promise<number> {
  const failed: { holdId: string; error: string }[] = [];
  let scheduled = 0;
  for (const hold of holds) {
    try {
      await scheduler.schedule(hold);
      scheduled += 1;
    } catch (error) {
      failed.push({ holdId: hold.holdId, error: String((error as Error)?.message ?? error) });
    }
  }
  logger.info("hold expiry backfill finished", { held: holds.length, scheduled, failed: failed.length });
  for (const failure of failed) logger.error("hold expiry could not be scheduled", failure);
  return failed.length > 0 ? 1 : 0;
}
