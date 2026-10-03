import { describe, expect, it } from "vitest";
import { parseCloudEvent } from "@connectsphere/contracts";
import {
  backoffMs,
  groupByTopic,
  prepareRow,
  toCloudEvent,
  UnpublishableError,
  type OutboxRow,
} from "../../src/shared/outbox/messages.js";

/**
 * EN-04.2: what the relay sends for each outbox row (implementation.md §3.3,
 * §3.4). Rows written before the CloudEvents switch are converted here, using
 * the mapping in §3.3.
 */

const eventId = "6f1c2a4e-8b1d-4c3a-9e2f-1a2b3c4d5e6f";
const coordinator = "00000000-0000-0000-0000-000000000002";
const organiser = "00000000-0000-0000-0000-000000000001";
const trace = "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01";
const fixedTrace = () => trace;

const approvedData = {
  eventId,
  eventReference: "EVT-2026-0042",
  eventName: "Freshmen Orientation",
  ownerId: organiser,
  approvedBy: coordinator,
  approvedAt: "2026-10-03T08:31:22.104Z",
};

const cloudEvent = {
  specversion: "1.0",
  id: "018f2a6b-3c4d-4e5f-8a9b-0c1d2e3f4a5b",
  source: "/connectsphere/planning-core/event",
  type: "event.approved",
  subject: eventId,
  time: "2026-10-03T08:31:22.104Z",
  datacontenttype: "application/json",
  correlationid: "9b2e7c1a-5d3f-4a8b-9c0d-1e2f3a4b5c6d",
  traceparent: trace,
  actor: `EVENT_COORDINATOR:${coordinator}`,
  data: approvedData,
};

/** The envelope the event module wrote before EN-04.2 (contracts/src/envelope.ts). */
const legacyEnvelope = {
  messageId: "018f2a6b-3c4d-4e5f-8a9b-0c1d2e3f4a5b",
  messageType: "event.approved",
  schemaVersion: 1,
  occurredAt: "2026-10-03T08:31:22.104Z",
  producer: "event-service",
  correlationId: null,
  causationId: null,
  actor: { userId: coordinator, role: "EVENT_COORDINATOR" },
  aggregate: { type: "EVENT", id: eventId },
  payload: approvedData,
};

function row(overrides: Partial<OutboxRow> = {}): OutboxRow {
  return { id: "row-1", topic: "connectsphere.event.v1", message_key: eventId, envelope: cloudEvent, ...overrides };
}

describe("toCloudEvent", () => {
  it("passes a CloudEvent through unchanged once it validates", () => {
    expect(toCloudEvent(cloudEvent, fixedTrace)).toEqual(cloudEvent);
  });

  it("converts an envelope written before the switch, field by field (§3.3)", () => {
    expect(toCloudEvent(legacyEnvelope, fixedTrace)).toEqual({
      specversion: "1.0",
      id: legacyEnvelope.messageId,
      source: "/connectsphere/planning-core/event",
      type: "event.approved",
      subject: eventId,
      time: legacyEnvelope.occurredAt,
      datacontenttype: "application/json",
      traceparent: trace,
      actor: `EVENT_COORDINATOR:${coordinator}`,
      data: approvedData,
    });
  });

  it("carries an old correlationId across as correlationid", () => {
    const converted = toCloudEvent({ ...legacyEnvelope, correlationId: "req-42" }, fixedTrace);
    expect(converted.correlationid).toBe("req-42");
  });

  it("produces a message every consumer will accept", () => {
    expect(() => parseCloudEvent(toCloudEvent(legacyEnvelope, fixedTrace))).not.toThrow();
  });

  it("refuses an old envelope from a producer it has no source for, naming the producer", () => {
    expect(() => toCloudEvent({ ...legacyEnvelope, producer: "mystery-service" }, fixedTrace)).toThrow(
      /mystery-service/,
    );
  });

  it("refuses something that is neither shape, as unpublishable", () => {
    expect(() => toCloudEvent({ hello: "world" }, fixedTrace)).toThrow(UnpublishableError);
  });

  it("refuses a CloudEvent whose data does not match its type", () => {
    expect(() => toCloudEvent({ ...cloudEvent, data: { ...approvedData, approvedBy: "not-a-uuid" } }, fixedTrace)).toThrow(
      UnpublishableError,
    );
  });
});

describe("prepareRow", () => {
  it("keys the message by the aggregate id and sends the CloudEvent as JSON in structured mode", () => {
    expect(prepareRow(row(), fixedTrace)).toEqual({
      rowId: "row-1",
      topic: "connectsphere.event.v1",
      key: eventId,
      value: JSON.stringify(cloudEvent),
      headers: { "content-type": "application/cloudevents+json; charset=UTF-8" },
    });
  });

  it("sends a row written under an old per-type topic to its aggregate's topic", () => {
    const prepared = prepareRow(row({ topic: "connectsphere.event.approved.v1", envelope: legacyEnvelope }), fixedTrace);
    expect(prepared.topic).toBe("connectsphere.event.v1");
  });

  it("refuses a topic it does not know, as unpublishable", () => {
    expect(() => prepareRow(row({ topic: "connectsphere.mystery.v1" }), fixedTrace)).toThrow(UnpublishableError);
  });

  it("refuses a row whose key is not the event's subject, since ordering depends on it", () => {
    expect(() => prepareRow(row({ message_key: coordinator }), fixedTrace)).toThrow(/subject/);
  });
});

describe("groupByTopic", () => {
  it("groups messages by topic and keeps each topic's messages in outbox order", () => {
    const a1 = { ...prepareRow(row({ id: "a1" }), fixedTrace) };
    const b1 = { ...a1, rowId: "b1", topic: "connectsphere.equipment-request.v1" as const };
    const a2 = { ...a1, rowId: "a2" };
    const groups = groupByTopic([a1, b1, a2]);
    expect([...groups.keys()]).toEqual(["connectsphere.event.v1", "connectsphere.equipment-request.v1"]);
    expect(groups.get("connectsphere.event.v1")!.map((m) => m.rowId)).toEqual(["a1", "a2"]);
  });
});

describe("backoffMs: how long the relay waits after the broker fails", () => {
  it("doubles from one second and stops at thirty", () => {
    expect([1, 2, 3, 4, 5, 6, 10].map(backoffMs)).toEqual([1000, 2000, 4000, 8000, 16000, 30000, 30000]);
  });
});
