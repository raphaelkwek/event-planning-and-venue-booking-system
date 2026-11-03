import { randomUUID } from "node:crypto";
import type { Sql } from "postgres";
import { logger } from "../../../shared/logger.js";
import { expireHoldIfDue } from "../repo/holds.js";

/**
 * M4 (audit of 2 Nov 2026), L6 (CR-04) — the fallback behind
 * `npm run jobs:expire-holds`: expire every Held hold whose expiry has passed.
 *
 * The HoldExpiry workflow expires each hold on time when Temporal and Kafka are
 * up. When they aren't, a hold would stay Held past its expiry. Slot inserts
 * already expire a venue's overdue holds before checking overlap
 * (repo/slots.ts), so no overdue hold refuses anyone; this sweep catches the
 * rest, so the hold shows Expired and its coordinator is told, "whether or not
 * anyone is using the system" (L6).
 *
 * Each hold goes through `expireHoldIfDue`, the workflow's own step, in its own
 * transaction: the same records, the same `venue-booking.hold-expired` message,
 * and the same locks (the venue, then the hold). So it is idempotent: a hold
 * the workflow, an insert or another sweep has already expired is skipped, and
 * the workflow later finds it gone. The database clock decides what is due.
 */

/** What one sweep did, per hold. */
export interface HoldExpiryRun {
  expired: string[];
  /** No longer due or no longer Held by the time its turn came: someone else expired, moved, converted or released it. */
  skipped: string[];
  failed: { id: string; error: string }[];
}

/** The Held holds whose expiry the database clock has reached, oldest expiry first. */
export async function listOverdueHolds(sql: Sql): Promise<string[]> {
  const rows = await sql<{ id: string }[]>`
    select id from venue.holds where status = 'HELD' and expires_at <= now() order by expires_at, reference
  `;
  return rows.map((row) => row.id);
}

export async function expireOverdueHolds(sql: Sql): Promise<HoldExpiryRun> {
  const run: HoldExpiryRun = { expired: [], skipped: [], failed: [] };
  for (const id of await listOverdueHolds(sql)) {
    try {
      const outcome = await sql.begin((tx) => expireHoldIfDue(tx, id));
      if (outcome.outcome === "expired") run.expired.push(id);
      else run.skipped.push(id);
    } catch (error) {
      run.failed.push({ id, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return run;
}

const ROUTE = "job expire-holds";

/** Logs one sweep (implementation.md §9): a line per hold and a summary. Returns the exit code, non-zero if any hold failed. */
export function reportHoldExpiryRun(run: HoldExpiryRun, correlationId: string, started: number): number {
  for (const holdId of run.expired) {
    logger.info("hold expired", { correlationId, userId: null, route: ROUTE, outcome: "success", code: null, holdId });
  }
  for (const holdId of run.skipped) {
    logger.info("hold no longer due", { correlationId, userId: null, route: ROUTE, outcome: "refused", code: "HOLD_NOT_HELD", holdId });
  }
  for (const failure of run.failed) {
    logger.error("hold could not be expired", {
      correlationId,
      userId: null,
      route: ROUTE,
      outcome: "error",
      code: null,
      holdId: failure.id,
      error: failure.error,
    });
  }
  logger.info("hold expiry sweep finished", {
    correlationId,
    userId: null,
    route: ROUTE,
    durationMs: Date.now() - started,
    outcome: run.failed.length > 0 ? "error" : "success",
    code: null,
    expired: run.expired.length,
    skipped: run.skipped.length,
    failed: run.failed.length,
  });
  return run.failed.length > 0 ? 1 : 0;
}

/** One run of `npm run jobs:expire-holds`: sweep, log, and return the exit code. A sweep that fails outright exits 1. */
export async function runHoldExpirySweep(sql: Sql): Promise<number> {
  const correlationId = randomUUID();
  const started = Date.now();
  try {
    return reportHoldExpiryRun(await expireOverdueHolds(sql), correlationId, started);
  } catch (error) {
    logger.error("hold expiry sweep failed", {
      correlationId,
      userId: null,
      route: ROUTE,
      durationMs: Date.now() - started,
      outcome: "error",
      code: null,
      error: error instanceof Error ? error.message : String(error),
    });
    return 1;
  }
}
