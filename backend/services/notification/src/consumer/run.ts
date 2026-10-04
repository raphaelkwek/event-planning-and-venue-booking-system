import { Partitioners, type Kafka } from "kafkajs";
import type { Sql } from "postgres";
import { KAFKA_TOPICS } from "@connectsphere/contracts";
import { logger } from "../logger.js";
import { handleMessage, type OutgoingMessage, type Outcome } from "./handleMessage.js";
import { consumerGroup, toIncoming, waitUntilDue } from "./kafkaMessages.js";
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
  const publish = async (topic: string, message: OutgoingMessage) => {
    await producer.send({ topic, acks: -1, messages: [{ key: message.key, value: message.value, headers: message.headers }] });
  };

  const notifier = kafka.consumer({ groupId: consumerGroup("event-notifier", groupSuffix) });
  const retryWorker = kafka.consumer({ groupId: consumerGroup("retry-worker", groupSuffix) });

  try {
    await producer.connect();
    await notifier.connect();
    await retryWorker.connect();
    await notifier.subscribe({ topic: KAFKA_TOPICS.event, fromBeginning: false });
    await retryWorker.subscribe({ topic: KAFKA_TOPICS.notificationRetry, fromBeginning: false });
  } catch (error) {
    // Close whatever did connect, so the next attempt starts clean.
    await Promise.allSettled([notifier.disconnect(), retryWorker.disconnect(), producer.disconnect()]);
    throw error;
  }

  await notifier.run({
    eachMessage: async ({ topic, message }) => {
      const incoming = toIncoming(topic, message);
      log(await handleMessage(incoming, { sql, publish }), topic, incoming.key);
    },
  });
  await retryWorker.run({
    eachMessage: async ({ topic, message, heartbeat }) => {
      const incoming = toIncoming(topic, message);
      await waitUntilDue(Number(incoming.headers[NOT_BEFORE_HEADER] ?? 0), heartbeat, () => stopping);
      log(await handleMessage(incoming, { sql, publish }), topic, incoming.key);
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
