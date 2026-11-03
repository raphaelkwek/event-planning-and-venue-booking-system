import { aggregateTopicFor, parseCloudEvent, type KafkaTopic } from "@connectsphere/contracts";

/**
 * What the relay sends for each outbox row (implementation.md §3.3, §3.4).
 * Pure: no database and no Kafka. The same rules as planning-core's relay
 * (EN-04.2), without its conversion of the old envelope: this service has only
 * ever written CloudEvents.
 */

export interface OutboxRow {
  id: string;
  topic: string;
  message_key: string;
  envelope: unknown;
}

export interface PreparedMessage {
  rowId: string;
  topic: KafkaTopic;
  key: string;
  value: string;
  headers: Record<string, string>;
}

/** A row that can never publish however often it is retried; the relay sets it aside (§3.4). */
export class UnpublishableError extends Error {}

/** CloudEvents' Kafka binding, structured mode: the whole event is the value. */
const STRUCTURED_CONTENT_TYPE = "application/cloudevents+json; charset=UTF-8";

/** The Kafka message for one outbox row: its topic, keyed by the aggregate id, the envelope validated again. */
export function prepareRow(row: OutboxRow): PreparedMessage {
  let topic: KafkaTopic;
  let event;
  try {
    topic = aggregateTopicFor(row.topic);
    event = parseCloudEvent(row.envelope);
  } catch (error) {
    throw new UnpublishableError((error as Error).message);
  }
  if (event.subject !== row.message_key) throw new UnpublishableError("the row's message_key is not the event's subject");
  return {
    rowId: row.id,
    topic,
    key: row.message_key,
    value: JSON.stringify(event),
    // The trace context travels in the header as well as in the event (ADR-0013); the relay swaps in its publish span's.
    headers: { "content-type": STRUCTURED_CONTENT_TYPE, traceparent: event.traceparent },
  };
}

/** Messages per topic, each topic's in outbox order. */
export function groupByTopic(messages: PreparedMessage[]): Map<KafkaTopic, PreparedMessage[]> {
  const groups = new Map<KafkaTopic, PreparedMessage[]>();
  for (const message of messages) groups.set(message.topic, [...(groups.get(message.topic) ?? []), message]);
  return groups;
}

/** The wait after `failures` passes in a row hit a broker error: 1 s, doubling, at most 30 s. */
export function backoffMs(failures: number): number {
  return Math.min(1000 * 2 ** (failures - 1), 30_000);
}
