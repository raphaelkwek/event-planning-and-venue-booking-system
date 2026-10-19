import { randomUUID } from "node:crypto";
import type { Sql } from "postgres";
import type { EventStatus } from "@connectsphere/contracts";
import { logger } from "../../../shared/logger.js";
import { listDueForCompletion } from "../repo/eventStatus.js";
import { SYSTEM_ACTOR, transitionEvent } from "../api/transitionEvent.js";

/** What one sweep did, per event. */
export interface CompletionRun {
  completed: string[];
  skipped: { id: string; currentStatus: EventStatus; message: string }[];
  failed: { id: string; error: string }[];
}

/**
 * F1 AC6 — move every Confirmed event whose end has passed to Completed.
 *
 * The rule belongs to the event service; what triggers it does not. Until the
 * Scheduled Job Runner exists (plan.md §4), `npm run jobs:complete-events`
 * calls this directly; the scheduler will call the same function.
 *
 * Each event is completed in its own transaction, so one failure does not undo
 * the others. The sweep is idempotent: a second run finds nothing, and when
 * two runs race, the transition lets only one complete each event — the other
 * is refused and reported as skipped, not failed. An event is skipped when
 * another run already completed it, it was cancelled or moved, or it is no
 * longer due; the status that refused it is recorded.
 *
 * Production omits `now`, so the database clock decides both which events are
 * due and the completion guard, matching the history timestamps. Tests pass a
 * fixed `now`.
 */
export async function completeDueEvents(sql: Sql, now?: Date): Promise<CompletionRun> {
  const run: CompletionRun = { completed: [], skipped: [], failed: [] };

  for (const id of await listDueForCompletion(sql, now)) {
    try {
      const outcome = await sql.begin((tx) =>
        transitionEvent(tx, id, "COMPLETE", SYSTEM_ACTOR, { now })
      );
      if (outcome.ok) run.completed.push(id);
      else run.skipped.push({ id, currentStatus: outcome.currentStatus, message: outcome.message });
    } catch (error) {
      run.failed.push({ id, error: error instanceof Error ? error.message : String(error) });
    }
  }

  return run;
}

const ROUTE = "job complete-events";

/**
 * Logs one sweep (implementation.md §9): a line per event and a summary.
 * Returns the process exit code — non-zero if any event could not be completed.
 */
export function reportCompletionRun(run: CompletionRun, correlationId: string, started: number): number {
  for (const eventId of run.completed) {
    logger.info("event completed", { correlationId, userId: null, route: ROUTE, outcome: "success", code: null, eventId });
  }
  for (const { id: eventId, currentStatus, message } of run.skipped) {
    logger.info(message, {
      correlationId,
      userId: null,
      route: ROUTE,
      outcome: "refused",
      code: "STATUS_TRANSITION_NOT_PERMITTED",
      eventId,
      currentStatus,
    });
  }
  for (const failure of run.failed) {
    logger.error("event could not be completed", {
      correlationId,
      userId: null,
      route: ROUTE,
      outcome: "error",
      code: null,
      eventId: failure.id,
      error: failure.error,
    });
  }

  logger.info("completion sweep finished", {
    correlationId,
    userId: null,
    route: ROUTE,
    durationMs: Date.now() - started,
    outcome: run.failed.length > 0 ? "error" : "success",
    code: null,
    completed: run.completed.length,
    skipped: run.skipped.length,
    failed: run.failed.length,
  });

  return run.failed.length > 0 ? 1 : 0;
}

/**
 * One run of `npm run jobs:complete-events`: sweep, log, and return the exit
 * code. A sweep that fails outright (say, the database is unreachable) is
 * logged as a structured error and exits 1.
 */
export async function runCompletionSweep(sql: Sql, now?: Date): Promise<number> {
  const correlationId = randomUUID();
  const started = Date.now();

  try {
    return reportCompletionRun(await completeDueEvents(sql, now), correlationId, started);
  } catch (error) {
    logger.error("completion sweep failed", {
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
