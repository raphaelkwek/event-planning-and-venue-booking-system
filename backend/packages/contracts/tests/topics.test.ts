import { describe, expect, it } from "vitest";
import { aggregateTopicFor, KAFKA_TOPICS, LEGACY_EVENT_TOPICS } from "../src/topics.js";

/**
 * ADR-0008: one topic per aggregate, keyed by aggregate id, with retry and
 * dead-letter topics per consumer. The Sprint 2 set has to fit Aiven's free
 * plan (five topics) until the cutover to Confluent on 13 Oct 2026.
 */

describe("KAFKA_TOPICS", () => {
  it("fits within the five topics Aiven's free plan allows", () => {
    expect(Object.keys(KAFKA_TOPICS).length).toBeLessThanOrEqual(5);
  });

  it("has a topic for each Sprint 2 producer and the notification consumer's retries and dead letters", () => {
    expect(KAFKA_TOPICS).toEqual({
      event: "connectsphere.event.v1",
      equipmentRequest: "connectsphere.equipment-request.v1",
      notificationRetry: "connectsphere.notification.retry.v1",
      notificationDeadLetter: "connectsphere.notification.dlq.v1",
    });
  });

  it("names every topic once", () => {
    const names = Object.values(KAFKA_TOPICS);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("LEGACY_EVENT_TOPICS", () => {
  it("keeps all nine per-event-type names that outbox rows were written with before ADR-0008", () => {
    expect(Object.values(LEGACY_EVENT_TOPICS)).toEqual([
      "connectsphere.event.submitted.v1",
      "connectsphere.event.coordinator-assigned.v1",
      "connectsphere.event.clarification-requested.v1",
      "connectsphere.event.clarification-responded.v1",
      "connectsphere.event.approved.v1",
      "connectsphere.event.rejected.v1",
      "connectsphere.event.reassignment-proposed.v1",
      "connectsphere.event.reassignment-accepted.v1",
      "connectsphere.event.reassignment-declined.v1",
    ]);
  });
});

describe("aggregateTopicFor", () => {
  it("routes every legacy per-type name to the event aggregate's topic", () => {
    for (const legacy of Object.values(LEGACY_EVENT_TOPICS)) {
      expect(aggregateTopicFor(legacy)).toBe(KAFKA_TOPICS.event);
    }
  });

  it("leaves a current topic as it is", () => {
    for (const current of Object.values(KAFKA_TOPICS)) {
      expect(aggregateTopicFor(current)).toBe(current);
    }
  });

  it("refuses a name it does not know, rather than guessing a destination", () => {
    expect(() => aggregateTopicFor("connectsphere.unknown.v1")).toThrow(/connectsphere\.unknown\.v1/);
  });
});
