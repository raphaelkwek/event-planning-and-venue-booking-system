import { describe, expect, it } from "vitest";
import { parseCloudEvent } from "../src/cloudEvent.js";
import {
  REGISTRATION_PAYLOAD_SCHEMAS,
  REGISTRATION_STATUS_LABELS,
  REGISTRATION_STATUSES,
  WAITLIST_STATUS_LABELS,
  WAITLIST_STATUSES,
} from "../src/registrationEvents.js";
import { KAFKA_TOPICS } from "../src/topics.js";

/**
 * R2 to R4 — the registration service's messages (ADR-0008): an example for
 * each type, validated as the relay and every consumer validate it.
 */

const attendee = "00000000-0000-0000-0000-000000000005";
const registrationId = "77777777-7777-4777-8777-777777777777";
const fields = {
  registrationId,
  registrationReference: "REG-000042",
  eventId: "22222222-2222-4222-8222-222222222222",
  eventReference: "EVT-000123",
  eventName: "Annual Research Symposium",
  attendeeId: attendee,
};

const entry = {
  waitlistEntryId: "99999999-9999-4999-8999-999999999999",
  waitlistReference: "WL-000007",
  eventId: fields.eventId,
  eventReference: fields.eventReference,
  eventName: fields.eventName,
  attendeeId: attendee,
};

const EXAMPLES: Record<keyof typeof REGISTRATION_PAYLOAD_SCHEMAS, Record<string, unknown>> = {
  "registration.confirmed": {
    ...fields,
    registeredAt: "2026-12-01T02:00:00.000Z",
    eventStartsAt: "2026-12-16T06:00:00.000Z",
    eventEndsAt: "2026-12-16T10:00:00.000Z",
  },
  "registration.withdrawn": { ...fields, registeredAt: "2026-12-01T02:00:00.000Z", withdrawnAt: "2026-12-03T02:00:00.000Z" },
  "registration.cancelled": { ...fields, cancelledAt: "2026-12-04T02:00:00.000Z" },
  "registration.added": {
    ...fields,
    registeredAt: "2026-12-11T02:00:00.000Z",
    eventStartsAt: "2026-12-16T06:00:00.000Z",
    eventEndsAt: "2026-12-16T10:00:00.000Z",
    addedBy: "00000000-0000-0000-0000-000000000001",
    addedByName: "Organiser One",
    addedOverCapacity: true,
  },
  "waitlist.place-opened": { ...entry, placesRemaining: 1, openedAt: "2026-12-03T02:00:00.000Z" },
  "waitlist.cancelled": { ...entry, cancelledAt: "2026-12-04T02:00:00.000Z" },
};

function message(type: string, data: Record<string, unknown>) {
  return {
    specversion: "1.0",
    id: "88888888-8888-4888-8888-888888888888",
    source: "/connectsphere/registration",
    type,
    subject: registrationId,
    time: "2026-12-01T02:00:00.000Z",
    datacontenttype: "application/json",
    traceparent: "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01",
    actor: `ATTENDEE:${attendee}`,
    data,
  };
}

describe("the registration messages (R2 to R4)", () => {
  it("has an example for every registration message type", () => {
    expect(Object.keys(EXAMPLES).sort()).toEqual(Object.keys(REGISTRATION_PAYLOAD_SCHEMAS).sort());
  });

  it.each(Object.entries(EXAMPLES))("accepts a %s message from the registration service, by an attendee", (type, data) => {
    expect(parseCloudEvent(message(type, data)).data).toEqual(data);
  });

  it("accepts a cancellation sent by the system, as the consumer that applies the event's cancellation sends it", () => {
    const sent = { ...message("registration.cancelled", EXAMPLES["registration.cancelled"]), actor: "SYSTEM" };
    expect(parseCloudEvent(sent).type).toBe("registration.cancelled");
  });

  it("refuses a message without the attendee to tell, or with a reference that isn't REG- and six digits", () => {
    const rest: Record<string, unknown> = { ...EXAMPLES["registration.confirmed"] };
    delete rest.attendeeId;
    expect(() => parseCloudEvent(message("registration.confirmed", rest))).toThrow(/attendeeId/);
    expect(() =>
      parseCloudEvent(message("registration.withdrawn", { ...EXAMPLES["registration.withdrawn"], registrationReference: "REG-42" })),
    ).toThrow(/registrationReference/);
  });

  it("refuses a withdrawal without its time, which R6 orders invitations by", () => {
    const rest: Record<string, unknown> = { ...EXAMPLES["registration.withdrawn"] };
    delete rest.withdrawnAt;
    expect(() => parseCloudEvent(message("registration.withdrawn", rest))).toThrow(/withdrawnAt/);
  });

  it("refuses an addition that doesn't say who added it or whether it went over capacity (R7)", () => {
    for (const field of ["addedBy", "addedOverCapacity"]) {
      const rest: Record<string, unknown> = { ...EXAMPLES["registration.added"] };
      delete rest[field];
      expect(() => parseCloudEvent(message("registration.added", rest)), field).toThrow(new RegExp(field));
    }
  });

  it("refuses a waitlist notice whose reference isn't WL- and six digits, or that opens no place (R6)", () => {
    expect(() =>
      parseCloudEvent(message("waitlist.cancelled", { ...EXAMPLES["waitlist.cancelled"], waitlistReference: "REG-000007" })),
    ).toThrow(/waitlistReference/);
    expect(() =>
      parseCloudEvent(message("waitlist.place-opened", { ...EXAMPLES["waitlist.place-opened"], placesRemaining: 0 })),
    ).toThrow(/placesRemaining/);
  });

  it("has a label for every waitlist status", () => {
    expect(WAITLIST_STATUSES.map((s) => WAITLIST_STATUS_LABELS[s])).toEqual(["Waitlisted", "Registered", "Left the waitlist", "Cancelled"]);
  });

  it("has a label for every status, and a topic of its own", () => {
    expect(REGISTRATION_STATUSES.map((s) => REGISTRATION_STATUS_LABELS[s])).toEqual(["Registered", "Withdrawn", "Cancelled"]);
    expect(KAFKA_TOPICS.registration).toBe("connectsphere.registration.v1");
  });
});
