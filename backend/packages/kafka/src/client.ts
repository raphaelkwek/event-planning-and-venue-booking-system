import { Kafka, logLevel, type LogEntry, type SASLOptions } from "kafkajs";
import { redact, type KafkaSettings } from "./config.js";
import { brokerProbe } from "./probe.js";

/** The part of a service's logger the Kafka client writes to. */
export interface KafkaLog {
  error(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
}

/** kafkajs's own log lines, through the service's logger, with any credential redacted. */
export function kafkaLogCreator(vars: Record<string, string | undefined>, log: KafkaLog) {
  return ({ level, log: entry }: LogEntry) => {
    const { message, ...fields } = entry;
    const text = redact(`kafkajs: ${message}`, vars);
    if (level === logLevel.ERROR) log.error(text, { error: redact(String(fields.error), vars) });
    else log.warn(text);
  };
}

/**
 * The service's Kafka client, or null when it has no KAFKA_* settings: it then
 * runs without Kafka, and /readyz says so. Incomplete settings are logged by
 * variable name.
 */
export function createKafka(settings: KafkaSettings, options: { clientId: string; log: KafkaLog }): Kafka | null {
  if (settings.status === "invalid") {
    options.log.error("Kafka is switched off: the KAFKA_* settings are incomplete", { problems: settings.problems });
  }
  if (settings.status !== "configured") return null;
  return new Kafka({
    clientId: options.clientId,
    ...settings.config,
    // kafkajs types SASL per mechanism; config.ts has already checked it is one of its three.
    sasl: settings.config.sasl as SASLOptions,
    connectionTimeout: 10_000,
    requestTimeout: 15_000,
    retry: { retries: 3 },
    logLevel: logLevel.WARN,
    logCreator: () => kafkaLogCreator(process.env, options.log),
  });
}

/** For /readyz: whether a broker answers, checked without kafkajs's retries so it answers fast. */
export function probeFor(client: Kafka | null): (() => Promise<boolean>) | undefined {
  return client ? brokerProbe(() => client.admin({ retry: { retries: 0 } })) : undefined;
}
