import { app } from "./app.js";
import { config } from "./config.js";
import { sql } from "./db.js";
import { kafka } from "./kafka.js";
import { logger } from "./logger.js";
import { startConsumers, type RunningConsumers } from "./consumer/run.js";

const server = app.listen(config.port, () => {
  logger.info(`registration listening on :${config.port}`);
});

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

/** Graceful shutdown: stop taking requests, let the consumer finish the message in hand, then close the database. */
async function shutdown(signal: string) {
  if (stopping) process.exit(1);
  stopping = true;
  logger.info("shutting down", { signal });
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await consumers?.stop();
  await sql.end({ timeout: 5 });
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
