import { randomUUID } from "node:crypto";
import type { TransactionSql } from "postgres";
import {
  formatActor,
  KAFKA_TOPICS,
  parseCloudEvent,
  type ActorRole,
  type VenueBookingMessageType,
} from "@connectsphere/contracts";
import { newTraceparent } from "../../../shared/tracing.js";

/**
 * A domain event exists if and only if its state change committed (implementation.md
 * §3.4): the outbox row is written inside the same transaction as the change, and the
 * relay, never a request handler, publishes it. Nothing here talks to Kafka.
 */

/** This module's outbox, which the relay polls (src/index.ts wires it in). */
export const VENUE_OUTBOX_TABLE = "venue.outbox";

/** The CloudEvents `source` of every message this module writes (§3.3). */
export const VENUE_SOURCE = "/connectsphere/planning-core/venue";

export interface VenueOutboxMessage {
  messageType: VenueBookingMessageType;
  /** The booking request, booking or hold the message is about: the message key. */
  aggregateId: string;
  actor: { userId: string; role: string };
  correlationId: string | null;
  payload: Record<string, unknown>;
}

/** Writes the message as a CloudEvent to the venue-booking topic, validated against its type's data schema first. */
export async function writeVenueOutbox(tx: TransactionSql, message: VenueOutboxMessage): Promise<string> {
  const event = parseCloudEvent({
    specversion: "1.0",
    id: randomUUID(),
    source: VENUE_SOURCE,
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
    insert into venue.outbox (topic, message_key, envelope)
    values (${KAFKA_TOPICS.venueBooking}, ${message.aggregateId}, ${tx.json(event as never)})
  `;

  return event.id;
}
