import { randomBytes, randomUUID } from "node:crypto";
import {
  formatActor,
  KAFKA_TOPICS,
  parseCloudEvent,
  type ActorRole,
  type RegistrationMessageType,
} from "@connectsphere/contracts";
import type { Db } from "../repo/seats.js";
import type { Sql } from "postgres";

/**
 * A registration message exists if and only if its change committed
 * (implementation.md §3.4): the outbox row is written inside the same
 * transaction, and the relay, never a request handler, publishes it. Nothing
 * here talks to Kafka.
 */

/** This service's outbox, which its relay polls (src/index.ts). */
export const REGISTRATION_OUTBOX_TABLE = "registration.outbox";

/** The CloudEvents `source` of every message this service writes (§3.3). */
export const REGISTRATION_SOURCE = "/connectsphere/registration";

/** A new W3C traceparent per message, until ADR-0013's OpenTelemetry SDK supplies the active span's. */
export function newTraceparent(): string {
  return `00-${randomBytes(16).toString("hex")}-${randomBytes(8).toString("hex")}-01`;
}

export interface RegistrationMessage {
  messageType: RegistrationMessageType;
  /** The registration's or waitlist entry's id: the message key and the envelope's subject (§3.2). */
  subjectId: string;
  actor: { userId: string | null; role: ActorRole };
  correlationId: string | null;
  data: Record<string, unknown>;
}

/** Writes the message as a CloudEvent to connectsphere.registration.v1, validated against its type's schema first. */
export async function writeRegistrationOutbox(db: Db, message: RegistrationMessage): Promise<string> {
  const sql = db as Sql;
  const event = parseCloudEvent({
    specversion: "1.0",
    id: randomUUID(),
    source: REGISTRATION_SOURCE,
    type: message.messageType,
    subject: message.subjectId,
    time: new Date().toISOString(),
    datacontenttype: "application/json",
    ...(message.correlationId ? { correlationid: message.correlationId } : {}),
    traceparent: newTraceparent(),
    actor: formatActor({ role: message.actor.role, userId: message.actor.userId }),
    data: message.data,
  });
  await sql`
    insert into registration.outbox (topic, message_key, envelope)
    values (${KAFKA_TOPICS.registration}, ${message.subjectId}, ${sql.json(event as never)})
  `;
  return event.id;
}
