import { Kafka, logLevel, type Admin } from "kafkajs";
import { KAFKA_TOPICS } from "@connectsphere/contracts";
import { sleep, waitFor } from "./toxiproxy.js";

/**
 * Redpanda for the chaos experiments (EN-20). The container has two listeners: clients that connect to
 * `DIRECT` are told to stay on it, clients that connect through Toxiproxy (`VIA_PROXY`, which forwards to the
 * second listener) are told to stay on the proxy. So a test can watch the broker directly while the
 * services reach it only through the proxy that breaks it.
 *
 * Plaintext, because the container has no TLS or SASL: the services' createKafka (TLS and SASL
 * from KAFKA_*) is not used here, the experiments build kafkajs clients with the same timeouts and retries.
 */

export const DIRECT = ["127.0.0.1:19092"];
export const VIA_PROXY = ["127.0.0.1:29092"];
/** Where Toxiproxy listens, and the broker listener it forwards to. */
export const PROXY_LISTEN = "127.0.0.1:29092";
export const PROXY_UPSTREAM = "127.0.0.1:19093";

export const ALL_TOPICS: string[] = Object.values(KAFKA_TOPICS);

/** The timeouts and retries the services' createKafka uses (backend/packages/kafka/src/client.ts). */
export function client(brokers: string[], clientId: string): Kafka {
  return new Kafka({ clientId, brokers, logLevel: logLevel.NOTHING, connectionTimeout: 10_000, requestTimeout: 15_000, retry: { retries: 3 } });
}

export async function createTopics(): Promise<void> {
  const admin = client(DIRECT, "chaos-admin").admin();
  await admin.connect();
  try {
    await admin.createTopics({ waitForLeaders: true, topics: ALL_TOPICS.map((topic) => ({ topic, numPartitions: 1, replicationFactor: 1 })) });
  } finally {
    await admin.disconnect();
  }
}

export async function endOffset(admin: Admin, topic: string): Promise<number> {
  const offsets = await admin.fetchTopicOffsets(topic);
  return offsets.reduce((sum, p) => sum + Number(p.high), 0);
}

/** How many messages a group has yet to commit on a topic. */
export async function groupLag(admin: Admin, groupId: string, topic: string): Promise<number> {
  const end = await endOffset(admin, topic);
  const [committed] = await admin.fetchOffsets({ groupId, topics: [topic] });
  const done = (committed?.partitions ?? []).reduce((sum, p) => sum + Math.max(0, Number(p.offset)), 0);
  return end - done;
}

/** Waits until every group has joined and been given its partitions, so a message sent next is not missed. */
export async function waitForGroupsStable(admin: Admin, groupIds: string[], timeoutMs = 60_000): Promise<void> {
  await waitFor(
    `groups ${groupIds.join(", ")} to be stable`,
    async () => {
      const { groups } = await admin.describeGroups(groupIds);
      return groups.length === groupIds.length && groups.every((g) => g.state === "Stable" && g.members.length > 0);
    },
    timeoutMs,
    500,
  );
}

export interface RawMessage {
  key: string | null;
  value: string;
  headers: Record<string, string>;
}

/** Every message on a topic, from the start, read straight from the broker. */
export async function readAll(topic: string): Promise<RawMessage[]> {
  const kafka = client(DIRECT, "chaos-reader");
  const admin = kafka.admin();
  await admin.connect();
  const expected = await endOffset(admin, topic);
  await admin.disconnect();
  const messages: RawMessage[] = [];
  if (expected === 0) return messages;
  const consumer = kafka.consumer({ groupId: `chaos-reader-${topic}-${Date.now()}-${Math.random().toString(16).slice(2)}` });
  await consumer.connect();
  await consumer.subscribe({ topic, fromBeginning: true });
  await consumer.run({
    eachMessage: async ({ message }) => {
      const headers: Record<string, string> = {};
      for (const [name, value] of Object.entries(message.headers ?? {})) if (value !== undefined) headers[name] = String(value);
      messages.push({ key: message.key?.toString() ?? null, value: message.value?.toString() ?? "", headers });
    },
  });
  try {
    await waitFor(`${expected} messages on ${topic}`, async () => messages.length >= expected, 60_000, 200);
  } finally {
    await consumer.disconnect();
  }
  return messages;
}

/** Sends messages to a topic through the given brokers (the proxied ones, to subject the send to the chaos). */
export async function produce(brokers: string[], topic: string, messages: RawMessage[]): Promise<void> {
  const producer = client(brokers, "chaos-producer").producer({ allowAutoTopicCreation: false, maxInFlightRequests: 1 });
  await producer.connect();
  try {
    await producer.send({ topic, acks: -1, messages: messages.map((m) => ({ key: m.key, value: m.value, headers: m.headers })) });
  } finally {
    await producer.disconnect();
  }
}

/** Waits for the groups to have consumed everything on the topics, however many messages that is. */
export async function waitForGroupsCaughtUp(admin: Admin, groups: Array<{ groupId: string; topic: string }>, timeoutMs = 90_000): Promise<void> {
  await waitFor(
    `groups to catch up (${groups.map((g) => g.groupId).join(", ")})`,
    async () => {
      const lags = await Promise.all(groups.map((g) => groupLag(admin, g.groupId, g.topic)));
      return lags.every((lag) => lag === 0);
    },
    timeoutMs,
    500,
  );
  await sleep(500);
}
