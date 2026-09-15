import { randomUUID } from "node:crypto";
import type { TransactionSql } from "postgres";
import { envelopeSchema, EVENT_PAYLOAD_SCHEMAS, type EventMessageType } from "@connectsphere/contracts";
import { config } from "../config.js";

/**
 * A domain event exists if and only if its state change committed
 * (implementation.md §3.4): the outbox row is written inside the same
 * transaction as the change, and a relay — never a request handler —
 * publishes it. Nothing here talks to Kafka.
 */
export interface OutboxMessage {
  topic: string;
  messageType: EventMessageType;
  aggregateId: string;
  actor: { userId: string | null; role: string };
  correlationId: string | null;
  causationId?: string | null;
  payload: Record<string, unknown>;
}

export async function writeOutbox(tx: TransactionSql, message: OutboxMessage): Promise<string> {
  const payload = EVENT_PAYLOAD_SCHEMAS[message.messageType].parse(message.payload);

  const envelope = envelopeSchema.parse({
    messageId: randomUUID(),
    messageType: message.messageType,
    schemaVersion: 1,
    occurredAt: new Date().toISOString(),
    producer: config.serviceName,
    correlationId: message.correlationId,
    causationId: message.causationId ?? null,
    actor: message.actor,
    aggregate: { type: "EVENT", id: message.aggregateId },
    payload,
  });

  await tx`
    insert into event.outbox (topic, message_key, envelope)
    values (${message.topic}, ${message.aggregateId}, ${tx.json(envelope as never)})
  `;

  return envelope.messageId;
}
