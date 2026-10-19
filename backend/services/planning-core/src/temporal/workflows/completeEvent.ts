import { condition, defineSignal, proxyActivities, setHandler } from "@temporalio/workflow";
import type { CompletionActivities } from "../activities/completion.js";

/**
 * EN-11 — CompleteEvent (ADR-0009): a durable timer per event that fires at the
 * event's end and completes it (F1 AC6). It survives restarts because Temporal,
 * not this process, keeps the timer.
 *
 * Workflow code is replayed, so it must be deterministic: no I/O, no real clock,
 * no randomness. `Date.now()` here is the workflow's replayed time, and the only
 * side effect is the activity. The completion rule itself is the event module's
 * (`completeEventIfDue`), so the timer can fire early or late without harm: the
 * database decides, and its answer says whether to wait again.
 *
 * Changing this function's commands (timers, activities, conditions) breaks
 * replay of runs already in flight. The replay test (tests/temporal) fails when
 * that happens; use `patched()` for such a change.
 */

/** The event's end moved; the timer resets to `endsAt`. */
export const rescheduleSignal = defineSignal<[{ endsAt: string }]>("reschedule");

/**
 * When the timer fired but the database still says the end hasn't passed (its
 * clock is behind, or the event moved), ask again no sooner than this.
 */
export const RECHECK_AFTER_MS = 60_000;

export interface CompleteEventInput {
  eventId: string;
  /** The event's end, RFC 3339. */
  endsAt: string;
}

export type CompleteEventResult =
  | { outcome: "completed" }
  | { outcome: "not-confirmed"; status: string }
  | { outcome: "not-found" }
  /** The event is Confirmed but has no end, so there is nothing to wait for. */
  | { outcome: "no-end" };

const { completeEventIfDue } = proxyActivities<CompletionActivities>({
  startToCloseTimeout: "30 seconds",
  // A database that is down is retried until it is back; the completion is idempotent.
  retry: { initialInterval: "5 seconds", backoffCoefficient: 2, maximumInterval: "5 minutes" },
});

export async function completeEvent(input: CompleteEventInput): Promise<CompleteEventResult> {
  let endsAt = Date.parse(input.endsAt);
  let notBefore = 0;
  let rescheduled = false;

  setHandler(rescheduleSignal, (signal) => {
    const moved = Date.parse(signal.endsAt);
    if (moved === endsAt) return;
    endsAt = moved;
    notBefore = 0;
    rescheduled = true;
  });

  for (;;) {
    rescheduled = false;
    const wait = Math.max(endsAt, notBefore) - Date.now();
    if (wait > 0 && (await condition(() => rescheduled, wait))) continue;

    const attempt = await completeEventIfDue(input.eventId);
    if (attempt.outcome !== "not-due") return attempt;
    if (attempt.endsAt === null) return { outcome: "no-end" };
    endsAt = Date.parse(attempt.endsAt);
    notBefore = Date.now() + RECHECK_AFTER_MS;
  }
}
