import { connectionOptionsFor, temporalSettingsFromEnv } from "./domain/settings.js";

/**
 * EN-11 — planning-core's Temporal worker (ADR-0009): `npm run worker`, and the
 * fourth process in the root `npm run dev`. It runs the workflows and their
 * activities, the consumer that starts each Confirmed event's CompleteEvent
 * workflow from the event topic, and (L6) the one that starts each placed
 * hold's HoldExpiry workflow from the venue-booking topic.
 *
 * Without TEMPORAL_ADDRESS it says so and exits 0, so `npm run dev`
 * (concurrently --kill-others-on-fail) keeps the API and web app running on a
 * laptop with no namespace. Settings that are present but wrong are logged as
 * an error and also exit 0, for the same reason; the error names the variable.
 * Without KAFKA_* the worker still runs workflows, but nothing starts new ones.
 */

const settings = temporalSettingsFromEnv(process.env);

if (settings.status !== "configured") {
  const line =
    settings.status === "not_configured"
      ? { level: "info", message: "Temporal worker not started: TEMPORAL_ADDRESS is not set" }
      : { level: "error", message: "Temporal worker not started: the TEMPORAL_* settings are invalid", problems: settings.problems };
  console.log(JSON.stringify({ ts: new Date().toISOString(), service: "planning-core-worker", ...line }));
  process.exit(0);
}

// Loaded only once Temporal is configured: these read DATABASE_URL and KAFKA_* when imported.
const [{ Client, Connection }, { NativeConnection, Worker }, { sql }, { logger }, { kafka }, { completeEventIfDue }, { expireHoldIfDue, remindHoldIfDue }] =
  await Promise.all([
    import("@temporalio/client"),
    import("@temporalio/worker"),
    import("../shared/db.js"),
    import("../shared/logger.js"),
    import("../shared/kafka/client.js"),
    import("../modules/event/index.js"),
    import("../modules/venue/index.js"),
  ]);
const { createCompletionActivities } = await import("./activities/completion.js");
const { createHoldExpiryActivities } = await import("./activities/holdExpiry.js");
const { bundleCompletionWorkflows } = await import("./workflowBundle.js");
const { temporalScheduler } = await import("./completionConsumer.js");
const { startCompletionConsumer } = await import("./runCompletionConsumer.js");
const { holdExpiryScheduler } = await import("./holdExpiryConsumer.js");
const { startHoldExpiryConsumer } = await import("./runHoldExpiryConsumer.js");

const options = connectionOptionsFor(settings);
const nativeConnection = await NativeConnection.connect(options);
const worker = await Worker.create({
  connection: nativeConnection,
  namespace: settings.namespace,
  taskQueue: settings.taskQueue,
  workflowBundle: await bundleCompletionWorkflows(),
  activities: {
    ...createCompletionActivities((eventId) => completeEventIfDue(sql, eventId)),
    ...createHoldExpiryActivities(
      (holdId) => sql.begin((tx) => remindHoldIfDue(tx, holdId)),
      (holdId) => sql.begin((tx) => expireHoldIfDue(tx, holdId))
    ),
  },
});

const clientConnection = await Connection.connect(options);
const client = new Client({ connection: clientConnection, namespace: settings.namespace });
const consumer = kafka
  ? await startCompletionConsumer(kafka, temporalScheduler(client, settings.taskQueue), process.env.KAFKA_GROUP_SUFFIX?.trim() ?? "")
  : null;
if (!consumer) logger.warn("event-completion consumer not started: this process has no Kafka settings");
const holdConsumer = kafka
  ? await startHoldExpiryConsumer(kafka, holdExpiryScheduler(client, settings.taskQueue), process.env.KAFKA_GROUP_SUFFIX?.trim() ?? "")
  : null;
if (!holdConsumer) logger.warn("hold-expiry consumer not started: this process has no Kafka settings");

logger.info("Temporal worker started", { namespace: settings.namespace, taskQueue: settings.taskQueue });

/** Graceful shutdown: stop polling and let activities in flight finish, then close the rest. */
let stopping = false;
function shutdown(signal: string) {
  if (stopping) process.exit(1);
  stopping = true;
  logger.info("Temporal worker shutting down", { signal });
  worker.shutdown();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

try {
  await worker.run();
} finally {
  await consumer?.stop().catch(() => {});
  await holdConsumer?.stop().catch(() => {});
  await clientConnection.close().catch(() => {});
  await nativeConnection.close().catch(() => {});
  await sql.end({ timeout: 5 }).catch(() => {});
}
