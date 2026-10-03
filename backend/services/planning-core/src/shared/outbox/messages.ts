import {
  aggregateTopicFor,
  cloudEventSchema,
  envelopeSchema,
  formatActor,
  parseCloudEvent,
  type ActorRole,
  type CloudEvent,
  type KafkaTopic,
} from "@connectsphere/contracts";

/**
 * What the outbox relay sends for each row (implementation.md §3.3, §3.4).
 * Pure: no database and no Kafka, so every rule here is unit-tested.
 */

/** An outbox row as the relay reads it. */
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

/**
 * A row that will never publish however often it is retried, such as an
 * envelope that fails its schema. The relay sets it aside (§3.4) instead of
 * letting it hold up the rows behind it.
 */
export class UnpublishableError extends Error {}

/** CloudEvents' Kafka binding, structured mode: the whole event is the value. */
const STRUCTURED_CONTENT_TYPE = "application/cloudevents+json; charset=UTF-8";

/** The old envelope's `producer`, as a CloudEvents `source`. */
const LEGACY_SOURCES: Record<string, string> = {
  "event-service": "/connectsphere/planning-core/event",
};

/**
 * The CloudEvent to publish for an outbox envelope. One written as a CloudEvent
 * is validated and returned; one written before the switch is converted using
 * §3.3's mapping. Anything else is unpublishable.
 */
export function toCloudEvent(envelope: unknown, newTraceparent: () => string): CloudEvent {
  try {
    if (cloudEventSchema.safeParse(envelope).success) return parseCloudEvent(envelope);

    const legacy = envelopeSchema.parse(envelope);
    const source = LEGACY_SOURCES[legacy.producer];
    if (!source) throw new Error(`no CloudEvents source is known for producer "${legacy.producer}"`);
    return parseCloudEvent({
      specversion: "1.0",
      id: legacy.messageId,
      source,
      type: legacy.messageType,
      subject: legacy.aggregate.id,
      time: legacy.occurredAt,
      datacontenttype: "application/json",
      ...(legacy.correlationId ? { correlationid: legacy.correlationId } : {}),
      traceparent: newTraceparent(),
      actor: formatActor({ role: legacy.actor.role as ActorRole, userId: legacy.actor.userId }),
      data: legacy.payload,
    });
  } catch (error) {
    throw new UnpublishableError((error as Error).message);
  }
}

/** The Kafka message for one outbox row: its aggregate's topic, keyed by the aggregate id. */
export function prepareRow(row: OutboxRow, newTraceparent: () => string): PreparedMessage {
  let topic: KafkaTopic;
  try {
    topic = aggregateTopicFor(row.topic);
  } catch (error) {
    throw new UnpublishableError((error as Error).message);
  }
  const event = toCloudEvent(row.envelope, newTraceparent);
  if (event.subject !== row.message_key) {
    throw new UnpublishableError("the row's message_key is not the event's subject");
  }
  return {
    rowId: row.id,
    topic,
    key: row.message_key,
    value: JSON.stringify(event),
    headers: { "content-type": STRUCTURED_CONTENT_TYPE },
  };
}

/** Messages per topic, each topic's in outbox order. */
export function groupByTopic(messages: PreparedMessage[]): Map<KafkaTopic, PreparedMessage[]> {
  const groups = new Map<KafkaTopic, PreparedMessage[]>();
  for (const message of messages) {
    const group = groups.get(message.topic) ?? [];
    group.push(message);
    groups.set(message.topic, group);
  }
  return groups;
}

/** The wait after `failures` passes in a row hit a broker error: 1 s, doubling, at most 30 s. */
export function backoffMs(failures: number): number {
  return Math.min(1000 * 2 ** (failures - 1), 30_000);
}
