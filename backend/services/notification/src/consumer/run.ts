import { Partitioners, type Kafka } from "kafkajs";
import type { Sql } from "postgres";
import { KAFKA_TOPICS } from "@connectsphere/contracts";
import { withProducerSpans } from "@connectsphere/telemetry";
import { logger } from "../logger.js";
import type { OutgoingMessage, Outcome } from "./handleMessage.js";
import { consumerGroup, waitUntilDue } from "./kafkaMessages.js";
import { consumeTraced } from "./consumeTraced.js";
import { NOT_BEFORE_HEADER } from "../domain/retryPolicy.js";

/**
 * The notification service's two consumers (implementation.md §3.5):
 *
 * - event-notifier reads connectsphere.event.v1 and handles each message.
 * - retry-worker reads the retry topic, holds each message until it is due,
 *   then handles it again.
 *
 * Both commit a message's offset only after handleMessage returns, which is
 * after the notification's transaction commits. A group seen for the first
 * time starts at the newest message: rows written before EN-04.2 were skipped
 * (event/0006), and nothing before this service existed should notify anyone.
 */
export interface RunningConsumers {
  stop(): Promise<void>;
}

const log = (outcome: Outcome, topic: string, key: string | null) => {
  if (outcome.outcome === "retried") logger.warn("notification will be retried", { topic, key, attempt: outcome.attempt });
  else if (outcome.outcome === "dead-lettered") logger.error("message sent to the dead-letter topic", { topic, key });
  else if (outcome.outcome === "stored") logger.info("notifications stored", { topic, key, count: outcome.notifications });
};

export async function startConsumers(kafka: Kafka, sql: Sql, groupSuffix: string): Promise<RunningConsumers> {
  let stopping = false;
  const producer = kafka.producer({ allowAutoTopicCreation: false, createPartitioner: Partitioners.DefaultPartitioner });
  // A retry or a dead letter is a PRODUCER span under the consumer span that decided it, so a message
  // that fails keeps its place in the trace (EN-08).
  const publish = (topic: string, message: OutgoingMessage) =>
    withProducerSpans(topic, [message], async (traced) => {
      await producer.send({ topic, acks: -1, messages: traced.map(({ key, value, headers }) => ({ key, value, headers })) });
    });

  const notifier = kafka.consumer({ groupId: consumerGroup("event-notifier", groupSuffix) });
  const retryWorker = kafka.consumer({ groupId: consumerGroup("retry-worker", groupSuffix) });

  try {
    await producer.connect();
    await notifier.connect();
    await retryWorker.connect();
    await notifier.subscribe({ topic: KAFKA_TOPICS.event, fromBeginning: false });
    await notifier.subscribe({ topic: KAFKA_TOPICS.equipmentRequest, fromBeginning: false });
    // L1: a new booking request notifies the venue's Venue Staff.
    await notifier.subscribe({ topic: KAFKA_TOPICS.venueBooking, fromBeginning: false });
    // R2 to R4: the registration service's messages tell attendees.
    await notifier.subscribe({ topic: KAFKA_TOPICS.registration, fromBeginning: false });
    await retryWorker.subscribe({ topic: KAFKA_TOPICS.notificationRetry, fromBeginning: false });
  } catch (error) {
    // Close whatever did connect, so the next attempt starts clean.
    await Promise.allSettled([notifier.disconnect(), retryWorker.disconnect(), producer.disconnect()]);
    throw error;
  }

  const notifierGroup = consumerGroup("event-notifier", groupSuffix);
  const retryGroup = consumerGroup("retry-worker", groupSuffix);
  await notifier.run({
    eachMessage: async ({ topic, partition, message }) => {
      await consumeTraced({ topic, partition, group: notifierGroup, message }, { sql, publish }, (outcome, incoming) =>
        log(outcome, topic, incoming.key),
      );
    },
  });
  await retryWorker.run({
    eachMessage: async ({ topic, partition, message, heartbeat }) => {
      // The wait is outside the span: a retried message holds for seconds, and that is not processing time.
      const dueAt = Number(message.headers?.[NOT_BEFORE_HEADER]?.toString() ?? 0);
      await waitUntilDue(dueAt, heartbeat, () => stopping);
      // The back-off is deliberate, so it is not lag: kafka_consumer_lag_seconds counts from when the retry was due.
      const countedFrom = String(Math.max(Number(message.timestamp), dueAt));
      await consumeTraced({ topic, partition, group: retryGroup, message: { ...message, timestamp: countedFrom } }, { sql, publish }, (outcome, incoming) =>
        log(outcome, topic, incoming.key),
      );
    },
  });

  logger.info("notification consumers started", {
    groups: [consumerGroup("event-notifier", groupSuffix), consumerGroup("retry-worker", groupSuffix)],
  });

  return {
    async stop() {
      stopping = true;
      await Promise.all([notifier.disconnect(), retryWorker.disconnect()]);
      await producer.disconnect();
    },
  };
}
