import { connectionOptionsFor, temporalSettingsFromEnv } from "./domain/settings.js";

/**
 * `npm run jobs:schedule-hold-expiries` — L6's backfill: starts an expiry timer
 * for every Held hold that doesn't have one (those placed before L6). Run once
 * after deploying L6; running it again is harmless. Exits 1 if Temporal isn't
 * configured or any hold could not be scheduled, as F1's `runCompleteEvents.ts`.
 */
const settings = temporalSettingsFromEnv(process.env);
if (settings.status !== "configured") {
  console.error(
    settings.status === "not_configured"
      ? "TEMPORAL_ADDRESS is not set: there is no Temporal to schedule the expiry timers on."
      : `The TEMPORAL_* settings are invalid: ${settings.problems.join("; ")}`
  );
  process.exit(1);
}

const [{ Client, Connection }, { sql }, { listHeldHolds, scheduleHoldExpiries }, { holdExpiryScheduler }] = await Promise.all([
  import("@temporalio/client"),
  import("../shared/db.js"),
  import("../modules/venue/index.js"),
  import("./holdExpiryConsumer.js"),
]);

const connection = await Connection.connect(connectionOptionsFor(settings));
try {
  const client = new Client({ connection, namespace: settings.namespace });
  process.exitCode = await scheduleHoldExpiries(await listHeldHolds(sql), holdExpiryScheduler(client, settings.taskQueue));
} finally {
  await connection.close().catch(() => {});
  await sql.end().catch(() => {});
}
