import { describe, expect, it } from "vitest";
import { backoffMs, groupByTopic, prepareRow, UnpublishableError } from "../../src/outbox/messages.js";
import { newTraceparent } from "../../src/outbox/write.js";

/** R2 to R4 — what the relay sends for an outbox row (implementation.md §3.3, §3.4). */

const registrationId = "77777777-7777-4777-8777-777777777777";
const envelope = {
  specversion: "1.0",
  id: "88888888-8888-4888-8888-888888888888",
  source: "/connectsphere/registration",
  type: "registration.withdrawn",
  subject: registrationId,
  time: "2026-12-03T02:00:00.000Z",
  datacontenttype: "application/json",
  traceparent: "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01",
  actor: "ATTENDEE:00000000-0000-0000-0000-000000000005",
  data: {
    registrationId,
    registrationReference: "REG-000042",
    eventId: "22222222-2222-4222-8222-222222222222",
    eventReference: "EVT-000123",
    eventName: "R Test Symposium",
    attendeeId: "00000000-0000-0000-0000-000000000005",
    registeredAt: "2026-12-01T02:00:00.000Z",
    withdrawnAt: "2026-12-03T02:00:00.000Z",
  },
};
const row = { id: "row-1", topic: "connectsphere.registration.v1", message_key: registrationId, envelope };

describe("prepareRow", () => {
  it("sends the CloudEvent in structured mode to the registration topic, keyed by the registration", () => {
    expect(prepareRow(row)).toEqual({
      rowId: "row-1",
      topic: "connectsphere.registration.v1",
      key: registrationId,
      value: JSON.stringify(envelope),
      // EN-08: the event's traceparent also travels as a header (the relay swaps in its publish span's).
      headers: { "content-type": "application/cloudevents+json; charset=UTF-8", traceparent: envelope.traceparent },
    });
  });

  it("sets aside a row with an unknown topic, an envelope that fails its contract, or a key that is not its subject", () => {
    expect(() => prepareRow({ ...row, topic: "connectsphere.nowhere.v1" })).toThrow(UnpublishableError);
    expect(() => prepareRow({ ...row, envelope: { ...envelope, data: {} } })).toThrow(UnpublishableError);
    expect(() => prepareRow({ ...row, message_key: "someone-else" })).toThrow(/message_key/);
  });
});

describe("groupByTopic and backoffMs", () => {
  it("keeps each topic's messages in outbox order", () => {
    const a = prepareRow(row);
    const b = { ...a, rowId: "row-2" };
    expect([...groupByTopic([a, b]).entries()]).toEqual([["connectsphere.registration.v1", [a, b]]]);
  });

  it("waits 1 s after a failure, doubling, at most 30 s", () => {
    expect([1, 2, 3, 5, 6, 10].map(backoffMs)).toEqual([1000, 2000, 4000, 16_000, 30_000, 30_000]);
  });

  it("starts a valid W3C trace for every message", () => {
    expect(newTraceparent()).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
    expect(newTraceparent()).not.toBe(newTraceparent());
  });
});
