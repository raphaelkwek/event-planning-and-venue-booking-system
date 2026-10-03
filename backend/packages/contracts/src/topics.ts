/**
 * Kafka topics (ADR-0008, implementation.md §3.1): one per aggregate type,
 * keyed by aggregate id, so every message about one aggregate lands on one
 * partition in order. What a message *is* lives in its CloudEvents `type`, not
 * its topic.
 */
export const AGGREGATE_TOPICS = {
  /** Every A–G message about one event; T2's notifications are built from it. */
  event: "connectsphere.event.v1",
  /** Holds, booking requests and bookings of a venue (L, M, N, I2). */
  venueBooking: "connectsphere.venue-booking.v1",
  /** O1/O2's equipment request lines; O2's status changes notify the coordinator. */
  equipmentRequest: "connectsphere.equipment-request.v1",
  /** Q1/Q2's reservations of equipment units. */
  equipmentReservation: "connectsphere.equipment-reservation.v1",
  /** The registration service's registrations and waitlist (R). */
  registration: "connectsphere.registration.v1",
} as const;

const CONSUMER_NAME = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

function consumerTopic(consumer: string, kind: "retry" | "dlq"): string {
  if (!CONSUMER_NAME.test(consumer)) {
    throw new Error(`A consumer name is lowercase kebab-case, not "${consumer}".`);
  }
  return `connectsphere.${consumer}.${kind}.v1`;
}

/** A failed message waits here before the consumer tries it again. */
export const retryTopic = (consumer: string) => consumerTopic(consumer, "retry");

/** A message that still fails after its retries is parked here for replay. */
export const deadLetterTopic = (consumer: string) => consumerTopic(consumer, "dlq");

/** The full layout. A consumer's retry and dead-letter topics are added as it is built. */
export const KAFKA_TOPICS = {
  ...AGGREGATE_TOPICS,
  notificationRetry: "connectsphere.notification.retry.v1",
  notificationDeadLetter: "connectsphere.notification.dlq.v1",
} as const;

export type KafkaTopic = (typeof KAFKA_TOPICS)[keyof typeof KAFKA_TOPICS];

/**
 * The topics that exist before the cutover to Confluent on 13 Oct 2026. Until
 * then the cluster is Aiven's free plan, which allows five topics, so only
 * what Sprint 2 produces and consumes is created, leaving one spare. The rest
 * of KAFKA_TOPICS is created at the cutover (ADR-0008, decision note).
 */
export const TOPICS_BEFORE_CUTOVER: readonly KafkaTopic[] = [
  KAFKA_TOPICS.event,
  KAFKA_TOPICS.equipmentRequest,
  KAFKA_TOPICS.notificationRetry,
  KAFKA_TOPICS.notificationDeadLetter,
];

/**
 * The per-event-type topic names used until 2 Oct 2026 (implementation.md
 * §3.1 before ADR-0008). Kept, not deleted: outbox rows written before the
 * change still carry them, and the relay routes them with `aggregateTopicFor`.
 * Never publish to these.
 */
export const LEGACY_EVENT_TOPICS = {
  submitted: "connectsphere.event.submitted.v1",
  coordinatorAssigned: "connectsphere.event.coordinator-assigned.v1",
  clarificationRequested: "connectsphere.event.clarification-requested.v1",
  clarificationResponded: "connectsphere.event.clarification-responded.v1",
  approved: "connectsphere.event.approved.v1",
  rejected: "connectsphere.event.rejected.v1",
  reassignmentProposed: "connectsphere.event.reassignment-proposed.v1",
  reassignmentAccepted: "connectsphere.event.reassignment-accepted.v1",
  reassignmentDeclined: "connectsphere.event.reassignment-declined.v1",
} as const;

const current = new Set<string>(Object.values(KAFKA_TOPICS));
const legacyEvent = new Set<string>(Object.values(LEGACY_EVENT_TOPICS));

/**
 * The topic an outbox row is published to. A current topic is returned as it
 * is; a legacy per-type name goes to its aggregate's topic. An unknown name is
 * refused rather than sent somewhere by guesswork.
 */
export function aggregateTopicFor(topic: string): KafkaTopic {
  if (current.has(topic)) return topic as KafkaTopic;
  if (legacyEvent.has(topic)) return KAFKA_TOPICS.event;
  throw new Error(`No Kafka topic is known for "${topic}".`);
}
