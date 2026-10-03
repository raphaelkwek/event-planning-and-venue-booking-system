import { describe, expect, it } from "vitest";
import {
  AGGREGATE_TOPICS,
  aggregateTopicFor,
  deadLetterTopic,
  KAFKA_TOPICS,
  LEGACY_EVENT_TOPICS,
  retryTopic,
  TOPICS_BEFORE_CUTOVER,
} from "../src/topics.js";

/**
 * ADR-0008: one topic per aggregate, keyed by aggregate id, with retry and
 * dead-letter topics per consumer. Until the cutover to Confluent on 13 Oct
 * 2026, only the topics Sprint 2 uses exist, on Aiven's free plan (five).
 */

describe("AGGREGATE_TOPICS", () => {
  it("has one topic per aggregate that publishes", () => {
    expect(AGGREGATE_TOPICS).toEqual({
      event: "connectsphere.event.v1",
      venueBooking: "connectsphere.venue-booking.v1",
      equipmentRequest: "connectsphere.equipment-request.v1",
      equipmentReservation: "connectsphere.equipment-reservation.v1",
      registration: "connectsphere.registration.v1",
    });
  });
});

describe("retry and dead-letter topics", () => {
  it("names a consumer's retry topic connectsphere.<consumer>.retry.v1", () => {
    expect(retryTopic("notification")).toBe("connectsphere.notification.retry.v1");
  });

  it("names a consumer's dead-letter topic connectsphere.<consumer>.dlq.v1", () => {
    expect(deadLetterTopic("notification")).toBe("connectsphere.notification.dlq.v1");
  });

  it("refuses a consumer name that is not lowercase kebab-case, so no name can break the pattern", () => {
    for (const consumer of ["Notification", "notification.v2", "", "notification service"]) {
      expect(() => retryTopic(consumer)).toThrow();
      expect(() => deadLetterTopic(consumer)).toThrow();
    }
  });
});

describe("KAFKA_TOPICS", () => {
  it("is every aggregate topic plus the notification consumer's retry and dead-letter topics", () => {
    expect(KAFKA_TOPICS).toEqual({
      ...AGGREGATE_TOPICS,
      notificationRetry: "connectsphere.notification.retry.v1",
      notificationDeadLetter: "connectsphere.notification.dlq.v1",
    });
  });

  it("names every topic once", () => {
    const names = Object.values(KAFKA_TOPICS);
    expect(new Set(names).size).toBe(names.length);
  });

  it("names every topic connectsphere.<name>.v<major>", () => {
    for (const topic of Object.values(KAFKA_TOPICS)) {
      expect(topic).toMatch(/^connectsphere\.[a-z][a-z0-9-]*(\.(retry|dlq))?\.v[1-9][0-9]*$/);
    }
  });
});

describe("TOPICS_BEFORE_CUTOVER", () => {
  it("fits within the five topics Aiven's free plan allows", () => {
    expect(TOPICS_BEFORE_CUTOVER.length).toBeLessThanOrEqual(5);
  });

  it("is the Sprint 2 set: the event and equipment-request topics and the notification consumer's", () => {
    expect([...TOPICS_BEFORE_CUTOVER]).toEqual([
      "connectsphere.event.v1",
      "connectsphere.equipment-request.v1",
      "connectsphere.notification.retry.v1",
      "connectsphere.notification.dlq.v1",
    ]);
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
