import { randomUUID } from "node:crypto";
import type { TransactionSql } from "postgres";
import {
  formatActor,
  parseCloudEvent,
  type ActorRole,
  type EventMessageType,
  type KafkaTopic,
} from "@connectsphere/contracts";
import { newTraceparent } from "../../../shared/tracing.js";

/**
 * A domain event exists if and only if its state change committed
 * (implementation.md §3.4): the outbox row is written inside the same
 * transaction as the change, and the relay — never a request handler —
 * publishes it. Nothing here talks to Kafka.
 */

/** This module's outbox, which the relay polls (src/index.ts wires it in). */
export const EVENT_OUTBOX_TABLE = "event.outbox";

/** The CloudEvents `source` of every message this module writes (§3.3). */
export const EVENT_SOURCE = "/connectsphere/planning-core/event";

export interface OutboxMessage {
  /** One of the current topics only; a legacy per-type name will not compile. */
  topic: KafkaTopic;
  messageType: EventMessageType;
  aggregateId: string;
  actor: { userId: string | null; role: string };
  correlationId: string | null;
  payload: Record<string, unknown>;
}

/** Writes the message as a CloudEvent, validated against its type's data schema first. */
export async function writeOutbox(tx: TransactionSql, message: OutboxMessage): Promise<string> {
  const event = parseCloudEvent({
    specversion: "1.0",
    id: randomUUID(),
    source: EVENT_SOURCE,
    type: message.messageType,
    subject: message.aggregateId,
    time: new Date().toISOString(),
    datacontenttype: "application/json",
    ...(message.correlationId ? { correlationid: message.correlationId } : {}),
    traceparent: newTraceparent(),
    actor: formatActor({ role: message.actor.role as ActorRole, userId: message.actor.userId }),
    data: message.payload,
  });

  await tx`
    insert into event.outbox (topic, message_key, envelope)
    values (${message.topic}, ${message.aggregateId}, ${tx.json(event as never)})
  `;

  return event.id;
}
