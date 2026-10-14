import { randomUUID } from "node:crypto";
import type { TransactionSql } from "postgres";
import {
  formatActor,
  parseCloudEvent,
  type ActorRole,
  type EquipmentRequestMessageType,
  type KafkaTopic,
} from "@connectsphere/contracts";
import { newTraceparent } from "../../../shared/tracing.js";

/**
 * A domain event exists if and only if its state change committed (implementation.md
 * §3.4): the outbox row is written inside the same transaction as the change, and the
 * relay, never a request handler, publishes it. Nothing here talks to Kafka.
 */

/** This module's outbox, which the relay polls (src/index.ts wires it in). */
export const EQUIPMENT_OUTBOX_TABLE = "equipment.outbox";

/** The CloudEvents `source` of every message this module writes (§3.3). */
export const EQUIPMENT_SOURCE = "/connectsphere/planning-core/equipment";

export interface OutboxMessage {
  topic: KafkaTopic;
  messageType: EquipmentRequestMessageType;
  aggregateId: string;
  actor: { userId: string; role: string };
  correlationId: string | null;
  payload: Record<string, unknown>;
}

/** Writes the message as a CloudEvent, validated against its type's data schema first. */
export async function writeOutbox(tx: TransactionSql, message: OutboxMessage): Promise<string> {
  const event = parseCloudEvent({
    specversion: "1.0",
    id: randomUUID(),
    source: EQUIPMENT_SOURCE,
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
    insert into equipment.outbox (topic, message_key, envelope)
    values (${message.topic}, ${message.aggregateId}, ${tx.json(event as never)})
  `;

  return event.id;
}
