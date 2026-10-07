import type { Sql } from "postgres";
import type { EventStatus } from "@connectsphere/contracts";
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
