import { Partitioners, type Kafka } from "kafkajs";
import { createKafka, kafkaSettingsFromEnv, probeFor, type KafkaSettings } from "@connectsphere/kafka";
import { logger } from "../logger.js";
import type { OutboxPublisher } from "../outbox-relay.js";

/**
 * planning-core's Kafka connection, built once from the KAFKA_* variables
 * (implementation.md §10) by the shared @connectsphere/kafka package. Without
 * them `kafka` is null: the process runs without the relay and /readyz says
 * Kafka is not configured.
 */

/**
 * Publishes the relay's messages. One request in flight at a time keeps a
 * retried send from overtaking the one after it, and publishing never creates
 * a topic: topics are created by hand (ADR-0008's five-topic plan). The
 * partitioner is named, not left to kafkajs's default: DefaultPartitioner
 * hashes keys as the Java client does, so every client puts an aggregate on
 * the same partition.
 */
export function kafkaPublisher(client: Kafka): OutboxPublisher & { disconnect(): Promise<void> } {
  const producer = client.producer({
    allowAutoTopicCreation: false,
    maxInFlightRequests: 1,
    createPartitioner: Partitioners.DefaultPartitioner,
  });
  let connected: Promise<void> | null = null;
  return {
    async publish(topic, messages) {
      connected ??= producer.connect().catch((error) => {
        connected = null;
        throw error;
      });
      await connected;
      await producer.send({ topic, messages, acks: -1 });
    },
    async disconnect() {
      if (connected) await producer.disconnect();
    },
  };
}

export const kafkaSettings: KafkaSettings = kafkaSettingsFromEnv(process.env);
export const kafka = createKafka(kafkaSettings, { clientId: "planning-core", log: logger });
export const probeBroker = probeFor(kafka);
