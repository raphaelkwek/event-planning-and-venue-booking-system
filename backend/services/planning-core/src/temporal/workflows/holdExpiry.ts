import { condition, defineSignal, proxyActivities, setHandler } from "@temporalio/workflow";
import type { HoldExpiryActivities } from "../activities/holdExpiry.js";

/**
 * L6 — HoldExpiry (ADR-0009): a durable timer per placed hold that reminds the
 * holding coordinator at the expiry minus the lead time, then expires the hold
 * at its expiry (CR-04). Temporal, not a process, keeps the timers.
 *
 * Workflow code is replayed, so it must be deterministic: no I/O, no real
 * clock, no randomness. The rules are the venue module's (`remindHoldIfDue`,
 * `expireHoldIfDue`), decided under the hold's row lock with the database
 * clock, so a timer firing early or late does no harm: the answer says whether
 * to wait again, and until when.
 *
 * Changing this function's commands (timers, activities, conditions) breaks
 * replay of runs already in flight. Use `patched()` for such a change.
 * FOLLOW-UP: no replay histories are committed for this workflow yet, because
 * recording one needs a live Temporal server (see EN-11's record script); add
 * them to tests/temporal/replay.unit.test.ts once recorded.
 */

/** Venue Staff moved the expiry: both waits restart and the reminder is armed again. */
export const holdRescheduleSignal = defineSignal<[{ expiresAt: string }]>("holdReschedule");

/** When the timer fired but the database says it isn't due yet, ask again no sooner than this. */
export const RECHECK_AFTER_MS = 60_000;

const MINUTE_MS = 60_000;

export interface HoldExpiryInput {
  holdId: string;
  /** The hold's expiry, RFC 3339. */
  expiresAt: string;
  /** How long before the expiry the coordinator is reminded; every placement and expiry change carries it. */
  reminderLeadMinutes: number;
}

export type HoldExpiryResult = { outcome: "expired" } | { outcome: "gone"; status: string | null };

const { remindHoldIfDue, expireHoldIfDue } = proxyActivities<HoldExpiryActivities>({
  startToCloseTimeout: "30 seconds",
  // A database that is down is retried until it is back; both steps are idempotent.
  retry: { initialInterval: "5 seconds", backoffCoefficient: 2, maximumInterval: "5 minutes" },
});

export async function holdExpiry(input: HoldExpiryInput): Promise<HoldExpiryResult> {
  const lead = input.reminderLeadMinutes;
  const remindAtFor = (expiry: number) => expiry - lead * MINUTE_MS;

  let expiresAt = Date.parse(input.expiresAt);
  let remindAt = remindAtFor(expiresAt);
  let reminded = false;
  let notBefore = 0;
  let rescheduled = false;

  setHandler(holdRescheduleSignal, (signal) => {
    const moved = Date.parse(signal.expiresAt);
    if (moved === expiresAt) return;
    expiresAt = moved;
    remindAt = remindAtFor(moved);
    reminded = false;
    notBefore = 0;
    rescheduled = true;
  });

  for (;;) {
    rescheduled = false;

    if (!reminded) {
      const wait = Math.max(remindAt, notBefore) - Date.now();
      if (wait > 0 && (await condition(() => rescheduled, wait))) continue;
      const reminder = await remindHoldIfDue(input.holdId);
      if (rescheduled) continue;
      if (reminder.outcome === "gone") return { outcome: "gone", status: reminder.status };
      if (reminder.outcome === "not-due") {
        remindAt = Date.parse(reminder.remindAt);
        notBefore = Date.now() + RECHECK_AFTER_MS;
        continue;
      }
      reminded = true;
      notBefore = 0;
    }

    const wait = Math.max(expiresAt, notBefore) - Date.now();
    if (wait > 0 && (await condition(() => rescheduled, wait))) continue;
    const attempt = await expireHoldIfDue(input.holdId);
    if (rescheduled) continue;
    if (attempt.outcome === "expired") return attempt;
    if (attempt.outcome === "gone") return { outcome: "gone", status: attempt.status };
    expiresAt = Date.parse(attempt.expiresAt);
    notBefore = Date.now() + RECHECK_AFTER_MS;
  }
}
