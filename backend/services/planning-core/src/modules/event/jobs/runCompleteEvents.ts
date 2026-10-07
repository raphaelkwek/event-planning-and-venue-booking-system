import { randomUUID } from "node:crypto";
import { sql } from "../../../shared/db.js";
import { logger } from "../../../shared/logger.js";
import { completeDueEvents } from "./completeEvents.js";

/**
 * `npm run jobs:complete-events` — runs the F1 completion sweep once, logs a
 * line per event and a summary (implementation.md §9), and exits non-zero if
 * any event could not be completed. The scheduler replaces this trigger when
 * it exists; the sweep itself does not change.
 */
async function main() {
  const correlationId = randomUUID();
  const route = "job complete-events";
  const started = Date.now();

  try {
    const run = await completeDueEvents(sql);

    for (const eventId of run.completed) {
      logger.info("event completed", { correlationId, userId: null, route, outcome: "success", code: null, eventId });
    }
    for (const { id: eventId, currentStatus } of run.skipped) {
      logger.info("event had already moved on; not completed", {
        correlationId,
        userId: null,
        route,
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
        route,
        outcome: "error",
        code: null,
        eventId: failure.id,
        error: failure.error,
      });
    }

    logger.info("completion sweep finished", {
      correlationId,
      userId: null,
      route,
      durationMs: Date.now() - started,
      outcome: run.failed.length > 0 ? "error" : "success",
      code: null,
      completed: run.completed.length,
      skipped: run.skipped.length,
      failed: run.failed.length,
    });

    process.exitCode = run.failed.length > 0 ? 1 : 0;
  } finally {
    await sql.end();
  }
}

await main();
