import { randomUUID } from "node:crypto";
import { logger } from "../shared/logger.js";
import type { CompletionScheduler } from "./completionConsumer.js";
import type { CompletionSchedule } from "./domain/completionTrigger.js";
import type { HoldExpirySchedule } from "./domain/holdExpiryTrigger.js";
import type { HoldExpiryScheduler } from "./holdExpiryConsumer.js";

/**
 * EN-11, L6 — the worker's first step when it starts: re-create every timer there should be.
 *
 * A timer lives in Temporal, and Temporal's state can be lost: on 4 Nov 2026 a redeploy replaced
 * staging's container, Temporal's SQLite file went with it, and a Confirmed event stayed Confirmed
 * past its end. The database knows which timers there should be (every Confirmed event with an
 * end, every Held hold), so the worker asks it and signal-with-starts each one through the
 * consumers' own schedulers, with the consumers' workflow ids:
 * - a lost timer starts again, and one whose time passed while it was gone finishes at once;
 * - a timer that is still there is only told the end or expiry it already has, which its
 *   workflow ignores (or, for a hold already reminded, answers `already`), so this is idempotent.
 *
 * It never throws: what it cannot list or schedule is logged by id, the rest carries on, and the
 * completion and hold-expiry sweeps (deploy/space/sweeps.sh) still catch anything it missed.
 */

/** What the database says the timers should be. The worker reads these through the modules' index.ts. */
export interface TimerSources {
  /** Every Confirmed event with an end (event module). */
  awaitingCompletion(): Promise<CompletionSchedule[]>;
  /** Every Held hold with an expiry (venue module). */
  heldHolds(): Promise<HoldExpirySchedule[]>;
}

export interface TimerSchedulers {
  completion: CompletionScheduler;
  holdExpiry: HoldExpiryScheduler;
}

export interface ReconcileTally {
  /** How many the database listed; null when the listing itself failed. */
  listed: number | null;
  scheduled: number;
  failed: number;
}

export interface TimerReconciliation {
  events: ReconcileTally;
  holds: ReconcileTally;
}

const ROUTE = "worker reconcile-timers";

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Lists one kind of timer and schedules each in turn; one failure doesn't stop the rest. */
async function reconcileKind<T>(
  list: () => Promise<T[]>,
  schedule: (item: T) => Promise<void>,
  names: { listFailed: string; scheduleFailed: string; idField: string; idOf: (item: T) => string },
  correlationId: string
): Promise<ReconcileTally> {
  let items: T[];
  try {
    items = await list();
  } catch (error) {
    logger.error(names.listFailed, { correlationId, userId: null, route: ROUTE, outcome: "error", code: null, error: errorText(error) });
    return { listed: null, scheduled: 0, failed: 0 };
  }

  const tally: ReconcileTally = { listed: items.length, scheduled: 0, failed: 0 };
  for (const item of items) {
    try {
      await schedule(item);
      tally.scheduled += 1;
    } catch (error) {
      tally.failed += 1;
      logger.error(names.scheduleFailed, {
        correlationId,
        userId: null,
        route: ROUTE,
        outcome: "error",
        code: null,
        [names.idField]: names.idOf(item),
        error: errorText(error),
      });
    }
  }
  return tally;
}

export async function reconcileTimers(sources: TimerSources, schedulers: TimerSchedulers): Promise<TimerReconciliation> {
  const correlationId = randomUUID();
  const started = Date.now();

  const events = await reconcileKind(
    () => sources.awaitingCompletion(),
    (event) => schedulers.completion.schedule(event),
    {
      listFailed: "events awaiting completion could not be listed",
      scheduleFailed: "event completion timer could not be re-created",
      idField: "eventId",
      idOf: (event) => event.eventId,
    },
    correlationId
  );
  const holds = await reconcileKind(
    () => sources.heldHolds(),
    (hold) => schedulers.holdExpiry.schedule(hold),
    {
      listFailed: "held holds could not be listed",
      scheduleFailed: "hold expiry timer could not be re-created",
      idField: "holdId",
      idOf: (hold) => hold.holdId,
    },
    correlationId
  );

  const failed = events.listed === null || holds.listed === null || events.failed > 0 || holds.failed > 0;
  logger.info("timers reconciled", {
    correlationId,
    userId: null,
    route: ROUTE,
    durationMs: Date.now() - started,
    outcome: failed ? "error" : "success",
    code: null,
    events: events.listed,
    eventsScheduled: events.scheduled,
    eventsFailed: events.failed,
    holds: holds.listed,
    holdsScheduled: holds.scheduled,
    holdsFailed: holds.failed,
  });
  return { events, holds };
}
