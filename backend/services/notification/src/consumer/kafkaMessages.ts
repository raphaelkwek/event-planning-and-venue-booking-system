import type { IncomingMessage } from "./handleMessage.js";

/**
 * The consumer group for one of this service's consumers (implementation.md
 * §3.1): connectsphere.notification.<consumer>, plus the laptop's
 * KAFKA_GROUP_SUFFIX, so a local consumer never takes partitions from the
 * deployed one or a teammate's.
 */
export function consumerGroup(consumer: string, suffix: string): string {
  const group = `connectsphere.notification.${consumer}`;
  return suffix ? `${group}.${suffix}` : group;
}

type HeaderValue = Buffer | string | Array<Buffer | string> | undefined;

/** A kafkajs message as the handler's input: buffers decoded, absent parts left absent. */
export function toIncoming(
  topic: string,
  message: { key: Buffer | null; value: Buffer | null; headers?: Record<string, HeaderValue> },
): IncomingMessage {
  const headers: Record<string, string> = {};
  for (const [name, value] of Object.entries(message.headers ?? {})) {
    if (value === undefined) continue;
    headers[name] = Array.isArray(value) ? value.map(String).join(",") : value.toString();
  }
  return {
    topic,
    key: message.key ? message.key.toString() : null,
    value: message.value ? message.value.toString() : null,
    headers,
  };
}

const HEARTBEAT_MS = 3_000;

/**
 * Holds a retried message until it is due, heartbeating so the consumer group
 * does not decide this consumer has died. If the service starts stopping, it
 * throws, so kafkajs does not commit a message that was never handled; it is
 * delivered again after the restart.
 */
export async function waitUntilDue(
  dueAt: number,
  heartbeat: () => Promise<void>,
  stopping: () => boolean,
): Promise<void> {
  while (Date.now() < dueAt) {
    if (stopping()) throw new Error("stopping: the retried message is left for the next run");
    await new Promise((resolve) => setTimeout(resolve, Math.min(HEARTBEAT_MS, dueAt - Date.now())));
    await heartbeat();
  }
}
