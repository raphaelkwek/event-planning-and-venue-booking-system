import { app } from "./app.js";
import { config } from "./shared/config.js";
import { sql } from "./shared/db.js";
import { logger } from "./shared/logger.js";
import { kafka, kafkaPublisher } from "./shared/kafka/client.js";
import { OutboxRelay } from "./shared/outbox-relay.js";
import { EVENT_OUTBOX_TABLE } from "./modules/event/index.js";

const server = app.listen(config.port, () => {
  logger.info(`${config.serviceName} listening on :${config.port}`);
});

/**
 * The outbox relay (EN-04.2, implementation.md §3.4) runs in this process
 * whenever KAFKA_* is set. Each module with an outbox adds its table here.
 * Without Kafka settings the API still works; messages wait in the outbox.
 */
const publisher = kafka ? kafkaPublisher(kafka) : null;
const relay = publisher ? new OutboxRelay({ sql, tables: [EVENT_OUTBOX_TABLE], publisher }) : null;
if (relay) {
  relay.start();
  logger.info("outbox relay started", { tables: [EVENT_OUTBOX_TABLE] });
} else {
  logger.warn("outbox relay not started: this process has no Kafka settings, so messages wait in the outbox");
}

/**
 * Graceful shutdown: stop taking requests, let the relay finish the batch it
 * is publishing, then close Kafka and the database. A second signal exits at once.
 */
let stopping = false;
async function shutdown(signal: string) {
  if (stopping) process.exit(1);
  stopping = true;
  logger.info("shutting down", { signal });
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await relay?.stop();
  await publisher?.disconnect();
  await sql.end({ timeout: 5 });
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
