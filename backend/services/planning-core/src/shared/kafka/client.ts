import { Kafka, logLevel, Partitioners, type LogEntry, type SASLOptions } from "kafkajs";
import { logger } from "../logger.js";
import { kafkaSettingsFromEnv, redact, type KafkaSettings } from "./config.js";
import { brokerProbe } from "./probe.js";
import type { OutboxPublisher } from "../outbox-relay.js";

/**
 * planning-core's Kafka connection, built once from the KAFKA_* variables
 * (implementation.md §10). Without them `kafka` is null: the process runs
 * without the relay and /readyz says Kafka is not configured.
 */

/** kafkajs's own log lines, through our logger, with any credential redacted. */
export function kafkaLogCreator(vars: Record<string, string | undefined>) {
  return ({ level, log }: LogEntry) => {
    const { message, ...fields } = log;
    const text = redact(`kafkajs: ${message}`, vars);
    if (level === logLevel.ERROR) logger.error(text, { error: redact(String(fields.error), vars) });
    else logger.warn(text);
  };
}

export function createKafka(settings: KafkaSettings): Kafka | null {
  if (settings.status === "invalid") {
    logger.error("Kafka is switched off: the KAFKA_* settings are incomplete", { problems: settings.problems });
  }
  if (settings.status !== "configured") return null;
  return new Kafka({
    clientId: "planning-core",
    ...settings.config,
    // kafkajs types SASL per mechanism; config.ts has already checked it is one of its three.
    sasl: settings.config.sasl as SASLOptions,
    connectionTimeout: 10_000,
    requestTimeout: 15_000,
    retry: { retries: 3 },
    logLevel: logLevel.WARN,
    logCreator: () => kafkaLogCreator(process.env),
  });
}

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

/** For /readyz: whether a broker answers, checked without kafkajs's retries so it answers fast. */
export function probeFor(client: Kafka | null): (() => Promise<boolean>) | undefined {
  return client ? brokerProbe(() => client.admin({ retry: { retries: 0 } })) : undefined;
}

export const kafkaSettings: KafkaSettings = kafkaSettingsFromEnv(process.env);
export const kafka = createKafka(kafkaSettings);
export const probeBroker = probeFor(kafka);
