import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import type { Sql } from "postgres";
import { handleMessage, type OutgoingMessage } from "../../src/consumer/handleMessage.js";
import { ATTEMPT_HEADER, NOT_BEFORE_HEADER } from "../../src/domain/retryPolicy.js";

/**
 * The handler's paths that never reach the database, so CI runs them on every
 * pull request (implementation.md §3.5). What needs Postgres (the inbox, a
 * duplicate, two consumers racing) is in handleMessage.test.ts.
 */

const EVENT_TOPIC = "connectsphere.event.v1";
const RETRY_TOPIC = "connectsphere.notification.retry.v1";
const DLQ_TOPIC = "connectsphere.notification.dlq.v1";

/** A database stand-in that fails the test if anything touches it. */
const untouchedDb = {
  begin: () => {
    throw new Error("the database should not be touched");
  },
} as unknown as Sql;

/** A database that is down: every transaction fails, as on a pooler outage. */
const brokenDb = { begin: () => Promise.reject(new Error("connection terminated unexpectedly")) } as unknown as Sql;

function approval(overrides: { type?: string; data?: Record<string, unknown> } = {}) {
  const eventId = randomUUID();
  const event = {
    specversion: "1.0",
    id: randomUUID(),
    source: "/connectsphere/planning-core/event",
    type: overrides.type ?? "event.approved",
    subject: eventId,
    time: "2026-10-04T08:31:22.104Z",
    datacontenttype: "application/json",
    traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
    actor: "EVENT_COORDINATOR:00000000-0000-0000-0000-000000000002",
    data: overrides.data ?? {
      eventId,
      eventReference: "EVT-TEST-0001",
      eventName: "Notification test",
      ownerId: randomUUID(),
      approvedBy: "00000000-0000-0000-0000-000000000002",
      approvedAt: "2026-10-04T08:31:22.104Z",
    },
  };
  return { topic: EVENT_TOPIC, key: eventId, value: JSON.stringify(event), headers: { "content-type": "x" } };
}

function recordingPublisher() {
  const sent: Array<OutgoingMessage & { topic: string }> = [];
  return { sent, publish: async (topic: string, message: OutgoingMessage) => void sent.push({ topic, ...message }) };
}

describe("a poison message", () => {
  it("that is not JSON goes to the dead-letter topic unchanged, saying why and where it came from", async () => {
    const { publish, sent } = recordingPublisher();
    const poison = { topic: EVENT_TOPIC, key: "k-1", value: "{not json", headers: { "content-type": "x" } };

    expect(await handleMessage(poison, { sql: untouchedDb, publish })).toEqual({ outcome: "dead-lettered" });
    expect(sent).toEqual([
      {
        topic: DLQ_TOPIC,
        key: "k-1",
        value: "{not json",
        headers: {
          "content-type": "x",
          "connectsphere-original-topic": EVENT_TOPIC,
          "connectsphere-error": expect.stringMatching(/JSON/),
        },
      },
    ]);
  });

  it("with no value at all is dead-lettered too", async () => {
    const { publish, sent } = recordingPublisher();
    expect(await handleMessage({ topic: EVENT_TOPIC, key: null, value: null, headers: {} }, { sql: untouchedDb, publish })).toEqual({
      outcome: "dead-lettered",
    });
    expect(sent[0]!.topic).toBe(DLQ_TOPIC);
  });

  it("includes a valid envelope whose data fails its type's schema", async () => {
    const { publish, sent } = recordingPublisher();
    const message = approval({ data: { eventId: "x", ownerId: "not-a-uuid" } });
    expect(await handleMessage(message, { sql: untouchedDb, publish })).toEqual({ outcome: "dead-lettered" });
    expect(sent[0]).toMatchObject({ topic: DLQ_TOPIC, value: message.value });
  });

  it("includes a type contracts has no schema for, so it can be replayed once one exists", async () => {
    const { publish, sent } = recordingPublisher();
    expect(await handleMessage(approval({ type: "event.teleported" }), { sql: untouchedDb, publish })).toEqual({
      outcome: "dead-lettered",
    });
    expect(sent[0]!.headers["connectsphere-error"]).toMatch(/event\.teleported/);
  });
});

describe("a failure that may pass, such as the database being unreachable", () => {
  it("sends the message to the retry topic with the attempt count and when to try again", async () => {
    const { publish, sent } = recordingPublisher();
    const message = approval();

    expect(await handleMessage(message, { sql: brokenDb, publish, now: () => 1_000_000 })).toEqual({
      outcome: "retried",
      attempt: 1,
    });
    expect(sent).toEqual([
      {
        topic: RETRY_TOPIC,
        key: message.key,
        value: message.value,
        headers: {
          "content-type": "x",
          [ATTEMPT_HEADER]: "1",
          [NOT_BEFORE_HEADER]: String(1_000_000 + 5_000),
          "connectsphere-original-topic": EVENT_TOPIC,
          "connectsphere-error": "connection terminated unexpectedly",
        },
      },
    ]);
  });

  it("counts on from the attempt a retried message carries, waiting longer each time", async () => {
    const { publish, sent } = recordingPublisher();
    const retried = { ...approval(), topic: RETRY_TOPIC, headers: { [ATTEMPT_HEADER]: "1", "connectsphere-original-topic": EVENT_TOPIC } };

    expect(await handleMessage(retried, { sql: brokenDb, publish, now: () => 0 })).toEqual({ outcome: "retried", attempt: 2 });
    expect(sent[0]!.headers).toMatchObject({ [ATTEMPT_HEADER]: "2", [NOT_BEFORE_HEADER]: "30000" });
    expect(sent[0]!.headers["connectsphere-original-topic"]).toBe(EVENT_TOPIC);
  });

  it("dead-letters the message once its three retries are used up", async () => {
    const { publish, sent } = recordingPublisher();
    const third = { ...approval(), topic: RETRY_TOPIC, headers: { [ATTEMPT_HEADER]: "3", "connectsphere-original-topic": EVENT_TOPIC } };

    expect(await handleMessage(third, { sql: brokenDb, publish })).toEqual({ outcome: "dead-lettered" });
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ topic: DLQ_TOPIC, value: third.value });
    expect(sent[0]!.headers).toMatchObject({ [ATTEMPT_HEADER]: "3", "connectsphere-original-topic": EVENT_TOPIC });
  });

  it("lets a Kafka failure escape, so the consumer keeps the message and tries it again", async () => {
    const publish = async () => {
      throw new Error("broker down");
    };
    await expect(handleMessage(approval(), { sql: brokenDb, publish })).rejects.toThrow("broker down");
  });
});

describe("a message nobody needs to hear about", () => {
  it("is acknowledged without touching the database or Kafka", async () => {
    const { publish, sent } = recordingPublisher();
    const eventId = randomUUID();
    const submitted = approval({
      type: "event.submitted",
      data: {
        eventId,
        eventReference: "EVT-TEST-0001",
        eventName: "Notification test",
        ownerId: randomUUID(),
        proposedStartAt: "2026-12-01T01:00:00.000Z",
        proposedEndAt: "2026-12-01T05:00:00.000Z",
        submittedAt: "2026-10-04T08:31:22.104Z",
      },
    });
    expect(await handleMessage(submitted, { sql: untouchedDb, publish })).toEqual({ outcome: "ignored" });
    expect(sent).toEqual([]);
  });
});
