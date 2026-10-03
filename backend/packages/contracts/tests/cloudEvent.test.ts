import { describe, expect, it } from "vitest";
import {
  cloudEventSchema,
  formatActor,
  parseActor,
  parseCloudEvent,
} from "../src/cloudEvent.js";
import { EVENT_PAYLOAD_SCHEMAS, type EventMessageType } from "../src/eventEvents.js";

/**
 * ADR-0008: every Kafka message is a CloudEvents 1.0 envelope carrying
 * traceparent, validated here. The existing payload schemas are its `data`.
 */

const eventId = "6f1c2a4e-8b1d-4c3a-9e2f-1a2b3c4d5e6f";
const organiser = "00000000-0000-0000-0000-000000000001";
const coordinator = "00000000-0000-0000-0000-000000000002";
const nominee = "00000000-0000-0000-0000-000000000008";
const at = "2026-10-03T08:31:22.104Z";
const ref = { eventId, eventReference: "EVT-2026-0042", eventName: "Freshmen Orientation" };

/** One realistic `data` per event message type. A new type without one fails below. */
const EXAMPLE_DATA: Record<EventMessageType, Record<string, unknown>> = {
  "event.submitted": {
    ...ref,
    ownerId: organiser,
    proposedStartAt: "2026-11-20T01:00:00.000Z",
    proposedEndAt: "2026-11-20T09:00:00.000Z",
    submittedAt: at,
  },
  "event.coordinator-assigned": { ...ref, coordinatorId: coordinator, assignmentRule: "ROUND_ROBIN", assignedAt: at },
  "event.clarification-requested": {
    ...ref,
    clarificationId: "11111111-1111-4111-8111-111111111111",
    ownerId: organiser,
    requestedBy: coordinator,
    requestedAt: at,
  },
  "event.clarification-responded": {
    ...ref,
    clarificationId: "11111111-1111-4111-8111-111111111111",
    requestedBy: coordinator,
    respondedBy: organiser,
    respondedAt: at,
    amendedFields: ["expectedAttendance"],
  },
  "event.approved": { ...ref, ownerId: organiser, approvedBy: coordinator, approvedAt: at },
  "event.rejected": { ...ref, ownerId: organiser, rejectedBy: coordinator, rejectedAt: at, reason: "Clashes with exams" },
  "event.reassignment-proposed": {
    ...ref,
    proposalId: "22222222-2222-4222-8222-222222222222",
    outgoingCoordinatorId: coordinator,
    nomineeCoordinatorId: nominee,
    proposedAt: at,
  },
  "event.reassignment-accepted": {
    ...ref,
    proposalId: "22222222-2222-4222-8222-222222222222",
    outgoingCoordinatorId: coordinator,
    nomineeCoordinatorId: nominee,
    resolvedAt: at,
  },
  "event.reassignment-declined": {
    ...ref,
    proposalId: "22222222-2222-4222-8222-222222222222",
    outgoingCoordinatorId: coordinator,
    nomineeCoordinatorId: nominee,
    resolvedAt: at,
  },
};

function exampleMessage(type: string, data: Record<string, unknown>): Record<string, unknown> {
  return {
    specversion: "1.0",
    id: "018f2a6b-3c4d-4e5f-8a9b-0c1d2e3f4a5b",
    source: "/connectsphere/planning-core/event",
    type,
    subject: eventId,
    time: at,
    datacontenttype: "application/json",
    correlationid: "9b2e7c1a-5d3f-4a8b-9c0d-1e2f3a4b5c6d",
    traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
    actor: `EVENT_COORDINATOR:${coordinator}`,
    data,
  };
}

/** A copy of a message or data without one attribute. */
function without(record: Record<string, unknown>, key: string): Record<string, unknown> {
  const copy = { ...record };
  delete copy[key];
  return copy;
}

const submitted = () => exampleMessage("event.submitted", EXAMPLE_DATA["event.submitted"]);

describe("parseCloudEvent: an example message for every event type", () => {
  it("has an example for every event message type in contracts", () => {
    expect(Object.keys(EXAMPLE_DATA).sort()).toEqual(Object.keys(EVENT_PAYLOAD_SCHEMAS).sort());
  });

  it.each(Object.entries(EXAMPLE_DATA))("accepts a %s message and returns its data", (type, data) => {
    const message = parseCloudEvent(exampleMessage(type, data));
    expect(message.type).toBe(type);
    expect(message.data).toEqual(data);
  });

  it("refuses a message whose data does not match its type's schema", () => {
    const data = without(EXAMPLE_DATA["event.rejected"], "reason");
    expect(() => parseCloudEvent(exampleMessage("event.rejected", data))).toThrow(/reason/);
  });

  it("refuses a type it has no schema for, naming the type", () => {
    expect(() => parseCloudEvent(exampleMessage("event.teleported", {}))).toThrow(/event\.teleported/);
  });
});

describe("cloudEventSchema: the CloudEvents 1.0 attributes", () => {
  it("accepts a message without a correlationid, as a scheduled job sends", () => {
    expect(() => cloudEventSchema.parse(without(submitted(), "correlationid"))).not.toThrow();
  });

  it.each(["specversion", "id", "source", "type", "subject", "time", "datacontenttype", "traceparent", "actor", "data"])(
    "requires %s",
    (attribute) => {
      expect(() => cloudEventSchema.parse(without(submitted(), attribute))).toThrow();
    },
  );

  it("accepts only CloudEvents spec version 1.0", () => {
    expect(() => cloudEventSchema.parse({ ...submitted(), specversion: "0.3" })).toThrow();
  });

  it("accepts only JSON data", () => {
    expect(() => cloudEventSchema.parse({ ...submitted(), datacontenttype: "application/xml" })).toThrow();
  });

  it("requires the subject to be the aggregate's UUID, which is also the message key", () => {
    expect(() => cloudEventSchema.parse({ ...submitted(), subject: "EVT-2026-0042" })).toThrow();
  });

  it("requires the time in UTC with milliseconds", () => {
    expect(() => cloudEventSchema.parse({ ...submitted(), time: "2026-10-03T16:31:22.104+08:00" })).toThrow();
    expect(() => cloudEventSchema.parse({ ...submitted(), time: "2026-10-03T08:31:22Z" })).toThrow();
  });

  it("requires the source to name the producing service and, inside planning-core, its module", () => {
    expect(() => cloudEventSchema.parse({ ...submitted(), source: "/connectsphere/registration" })).not.toThrow();
    expect(() => cloudEventSchema.parse({ ...submitted(), source: "event-service" })).toThrow();
  });

  it("refuses a malformed or all-zero traceparent", () => {
    for (const traceparent of [
      "4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7",
      "00-00000000000000000000000000000000-00f067aa0ba902b7-01",
      "00-4bf92f3577b34da6a3ce929d0e0e4736-0000000000000000-01",
    ]) {
      expect(() => cloudEventSchema.parse({ ...submitted(), traceparent })).toThrow();
    }
  });

  it("refuses an attribute that is not in the contract, such as the old camelCase correlationId", () => {
    expect(() => cloudEventSchema.parse({ ...submitted(), correlationId: "abc" })).toThrow();
  });

  it("refuses an empty correlationid rather than treating it as absent", () => {
    expect(() => cloudEventSchema.parse({ ...submitted(), correlationid: "" })).toThrow();
  });

  it("names every attribute as CloudEvents requires: lowercase letters and digits, at most 20 characters", () => {
    for (const name of Object.keys(cloudEventSchema.shape)) {
      expect(name).toMatch(/^[a-z0-9]{1,20}$/);
    }
  });
});

describe("actor: who caused the message, as one string", () => {
  it("writes a user as ROLE:userId and reads it back", () => {
    const actor = { role: "EVENT_COORDINATOR" as const, userId: coordinator };
    expect(formatActor(actor)).toBe(`EVENT_COORDINATOR:${coordinator}`);
    expect(parseActor(formatActor(actor))).toEqual(actor);
  });

  it("writes the system, which has no user, as SYSTEM", () => {
    expect(formatActor({ role: "SYSTEM", userId: null })).toBe("SYSTEM");
    expect(parseActor("SYSTEM")).toEqual({ role: "SYSTEM", userId: null });
  });

  it("refuses an unknown role, a user role without a user, and a system actor with one", () => {
    for (const actor of ["JANITOR:" + coordinator, "EVENT_COORDINATOR", `SYSTEM:${coordinator}`]) {
      expect(() => parseActor(actor)).toThrow();
      expect(() => cloudEventSchema.parse({ ...submitted(), actor })).toThrow();
    }
  });

  it("refuses to format a user role without a user id", () => {
    expect(() => formatActor({ role: "EVENT_ORGANISER", userId: null })).toThrow();
  });
});
