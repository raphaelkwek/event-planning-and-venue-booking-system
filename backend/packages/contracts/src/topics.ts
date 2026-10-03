/**
 * Kafka topics (ADR-0008): one per aggregate type, keyed by aggregate id, so
 * every message about one aggregate lands on one partition in order. Each
 * consumer gets its own retry and dead-letter topics.
 *
 * This is the Sprint 2 set. Until the cutover to Confluent on 13 Oct 2026 the
 * cluster is Aiven's free plan, which allows five topics, so only the
 * producers and consumers Sprint 2 builds are here, leaving one spare for the
 * first Sprint 3 aggregate that publishes before the cutover:
 *
 * - `event` — every A–E, F and G message about one event (T2 consumes it).
 * - `equipmentRequest` — O2's status changes, which notify the coordinator.
 * - `notificationRetry` / `notificationDeadLetter` — T2's consumer.
 *
 * What a message *is* lives in its envelope's `messageType`, not its topic.
 */
export const KAFKA_TOPICS = {
  event: "connectsphere.event.v1",
  equipmentRequest: "connectsphere.equipment-request.v1",
  notificationRetry: "connectsphere.notification.retry.v1",
  notificationDeadLetter: "connectsphere.notification.dlq.v1",
} as const;

export type KafkaTopic = (typeof KAFKA_TOPICS)[keyof typeof KAFKA_TOPICS];

/**
 * The per-event-type topic names used until 2 Oct 2026 (implementation.md
 * §3.1, superseded by ADR-0008). Kept, not deleted: outbox rows written before
 * the change still carry them, and the relay routes them with
 * `aggregateTopicFor`. Never publish to these.
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
