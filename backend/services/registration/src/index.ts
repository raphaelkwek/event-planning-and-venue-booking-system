import { telemetry } from "./telemetry.js";
import { app } from "./app.js";
import { config } from "./config.js";
import { sql } from "./db.js";
import { kafka } from "./kafka.js";
import { logger } from "./logger.js";
import { installProcessGuards } from "./processGuards.js";
import { startConsumers, type RunningConsumers } from "./consumer/run.js";
import { kafkaPublisher, OutboxRelay } from "./outbox/relay.js";
import { REGISTRATION_OUTBOX_TABLE } from "./outbox/write.js";

installProcessGuards();

const server = app.listen(config.port, () => {
  logger.info(`registration listening on :${config.port}`);
});

/**
 * The outbox relay (implementation.md §3.4) publishes the registration messages
 * (R2 to R4) whenever KAFKA_* is set; without it they wait in the outbox.
 */
const publisher = kafka ? kafkaPublisher(kafka) : null;
const relay = publisher ? new OutboxRelay({ sql, table: REGISTRATION_OUTBOX_TABLE, publisher }) : null;
if (relay) relay.start();
else logger.warn("outbox relay not started: this process has no Kafka settings, so registration messages wait in the outbox");

let consumers: RunningConsumers | null = null;
let stopping = false;

/** Starts the consumer, trying again every 15 s if the broker cannot be reached yet (e.g. the broker down). */
async function startWhenReachable() {
  if (!kafka) {
    logger.warn("consumers not started: this process has no Kafka settings, so no seats are built");
    return;
  }
  while (!stopping) {
    try {
      consumers = await startConsumers(kafka, sql, config.groupSuffix);
      return;
    } catch (error) {
      logger.error("could not start the consumer; trying again in 15 s", { error: (error as Error).message });
      await new Promise((resolve) => setTimeout(resolve, 15_000));
    }
  }
}
void startWhenReachable();

/** Graceful shutdown: stop taking requests, let the consumers finish the message in hand and the relay its batch, then close the database. */
async function shutdown(signal: string) {
  if (stopping) process.exit(1);
  stopping = true;
  logger.info("shutting down", { signal });
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await consumers?.stop();
  await relay?.stop();
  await publisher?.disconnect();
  await sql.end({ timeout: 5 });
  await telemetry.shutdown();
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
