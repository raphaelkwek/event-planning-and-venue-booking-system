import { afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import postgres, { type Sql } from "postgres";
import { handleMessage, type OutgoingMessage } from "../../src/consumer/handleMessage.js";
import { ATTEMPT_HEADER, NOT_BEFORE_HEADER } from "../../src/domain/retryPolicy.js";

/**
 * EN-04.3 done-checks, against the real notification schema (implementation.md
 * §3.5): a duplicate delivery creates one notification, and a poison message
 * goes to the dead-letter topic without blocking the messages after it.
 *
 * Kafka is replaced by a recording publisher: what is tested is what the
 * handler does with each message, which is what the consumer runs.
 */

const db = () => postgres(process.env.DATABASE_URL!, { max: 2, prepare: false });
const sql = db();

const EVENT_TOPIC = "connectsphere.event.v1";
const RETRY_TOPIC = "connectsphere.notification.retry.v1";
const DLQ_TOPIC = "connectsphere.notification.dlq.v1";

const recipients: string[] = [];
const messageIds: string[] = [];

afterAll(async () => {
  if (recipients.length) await sql`delete from notification.notifications where recipient_user_id in ${sql(recipients)}`;
  if (messageIds.length) await sql`delete from notification.consumed_messages where message_id in ${sql(messageIds)}`;
  await sql.end();
});

/** A valid event.approved CloudEvent for a fresh organiser, as the relay publishes it. */
function approval() {
  const organiser = randomUUID();
  const eventId = randomUUID();
  const id = randomUUID();
  recipients.push(organiser);
  messageIds.push(id);
  const event = {
    specversion: "1.0",
    id,
    source: "/connectsphere/planning-core/event",
    type: "event.approved",
    subject: eventId,
    time: new Date().toISOString(),
    datacontenttype: "application/json",
    traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
    actor: "EVENT_COORDINATOR:00000000-0000-0000-0000-000000000002",
    data: {
      eventId,
      eventReference: "EVT-TEST-0001",
      eventName: "Notification test",
      ownerId: organiser,
      approvedBy: "00000000-0000-0000-0000-000000000002",
      approvedAt: new Date().toISOString(),
    },
  };
  return {
    organiser,
    id,
    message: {
      topic: EVENT_TOPIC,
      key: eventId,
      value: JSON.stringify(event),
      headers: { "content-type": "application/cloudevents+json; charset=UTF-8" },
    },
  };
}

function recordingPublisher() {
  const sent: Array<OutgoingMessage & { topic: string }> = [];
  return { sent, publish: async (topic: string, message: OutgoingMessage) => void sent.push({ topic, ...message }) };
}

async function notificationsFor(userId: string) {
  return sql`select * from notification.notifications where recipient_user_id = ${userId}`;
}

describe("a duplicate delivery", () => {
  it("creates one notification, and the second delivery is recognised as already handled", async () => {
    const { organiser, id, message } = approval();
    const { publish, sent } = recordingPublisher();

    expect(await handleMessage(message, { sql, publish })).toEqual({ outcome: "stored", notifications: 1 });
    expect(await handleMessage(message, { sql, publish })).toEqual({ outcome: "duplicate" });

    const rows = await notificationsFor(organiser);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      notification_type: "event.approved",
      event_reference: "EVT-TEST-0001",
      source_message_id: id,
      read_at: null,
    });
    const [inbox] = await sql`select consumer from notification.consumed_messages where message_id = ${id}`;
    expect(inbox!.consumer).toBe("notification.event-notifier");
    expect(sent).toEqual([]);
  });

  it("creates one notification when two consumers handle the same message at the same moment", async () => {
    const { organiser, message } = approval();
    const [a, b] = [db(), db()];
    const results = await Promise.all([
      handleMessage(message, { sql: a, publish: recordingPublisher().publish }),
      handleMessage(message, { sql: b, publish: recordingPublisher().publish }),
    ]);
    await Promise.all([a.end(), b.end()]);

    expect(results.map((r) => r.outcome).sort()).toEqual(["duplicate", "stored"]);
    expect(await notificationsFor(organiser)).toHaveLength(1);
  });
});

describe("a poison message", () => {
  it("goes to the dead-letter topic unchanged, and the next message is still handled", async () => {
    const { publish, sent } = recordingPublisher();
    const poison = { topic: EVENT_TOPIC, key: "k-1", value: "{not json", headers: { "content-type": "x" } };
    const next = approval();

    expect(await handleMessage(poison, { sql, publish })).toEqual({ outcome: "dead-lettered" });
    expect(await handleMessage(next.message, { sql, publish })).toEqual({ outcome: "stored", notifications: 1 });

    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ topic: DLQ_TOPIC, key: "k-1", value: "{not json" });
    expect(sent[0]!.headers).toMatchObject({
      "content-type": "x",
      "connectsphere-original-topic": EVENT_TOPIC,
      "connectsphere-error": expect.stringMatching(/JSON/),
    });
    expect(await notificationsFor(next.organiser)).toHaveLength(1);
  });

  it("includes a valid envelope whose data fails its type's schema", async () => {
    const { publish, sent } = recordingPublisher();
    const { message, organiser } = approval();
    const event = JSON.parse(message.value);
    event.data.ownerId = "not-a-uuid";

    const result = await handleMessage({ ...message, value: JSON.stringify(event) }, { sql, publish });

    expect(result).toEqual({ outcome: "dead-lettered" });
    expect(sent[0]!.topic).toBe(DLQ_TOPIC);
    expect(await notificationsFor(organiser)).toHaveLength(0);
  });
});

describe("a failure that may pass, such as the database being unreachable", () => {
  const brokenDb = { begin: () => Promise.reject(new Error("connection terminated unexpectedly")) } as unknown as Sql;

  it("sends the message to the retry topic with the attempt count and when to try again", async () => {
    const { publish, sent } = recordingPublisher();
    const { message } = approval();

    const result = await handleMessage(message, { sql: brokenDb, publish, now: () => 1_000_000 });

    expect(result).toEqual({ outcome: "retried", attempt: 1 });
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ topic: RETRY_TOPIC, key: message.key, value: message.value });
    expect(sent[0]!.headers).toMatchObject({
      [ATTEMPT_HEADER]: "1",
      [NOT_BEFORE_HEADER]: String(1_000_000 + 5_000),
      "connectsphere-original-topic": EVENT_TOPIC,
      "connectsphere-error": "connection terminated unexpectedly",
    });
  });

  it("dead-letters the message once its retries are used up", async () => {
    const { publish, sent } = recordingPublisher();
    const { message } = approval();
    const third = {
      ...message,
      topic: RETRY_TOPIC,
      headers: { ...message.headers, [ATTEMPT_HEADER]: "3", "connectsphere-original-topic": EVENT_TOPIC },
    };

    expect(await handleMessage(third, { sql: brokenDb, publish })).toEqual({ outcome: "dead-lettered" });
    expect(sent[0]).toMatchObject({ topic: DLQ_TOPIC, value: message.value });
    expect(sent[0]!.headers).toMatchObject({ [ATTEMPT_HEADER]: "3", "connectsphere-original-topic": EVENT_TOPIC });
  });

  it("stores the notification when a retried message succeeds", async () => {
    const { publish, sent } = recordingPublisher();
    const { message, organiser } = approval();
    const retried = { ...message, topic: RETRY_TOPIC, headers: { ...message.headers, [ATTEMPT_HEADER]: "2" } };

    expect(await handleMessage(retried, { sql, publish })).toEqual({ outcome: "stored", notifications: 1 });
    expect(await notificationsFor(organiser)).toHaveLength(1);
    expect(sent).toEqual([]);
  });
});

describe("a message nobody needs to hear about", () => {
  it("is acknowledged without a notification or an inbox row", async () => {
    const { message, id } = approval();
    const event = JSON.parse(message.value);
    event.type = "event.submitted";
    event.data = {
      eventId: event.subject,
      eventReference: "EVT-TEST-0001",
      eventName: "Notification test",
      ownerId: event.data.ownerId,
      proposedStartAt: event.time,
      proposedEndAt: event.time,
      submittedAt: event.time,
    };
    const { publish, sent } = recordingPublisher();

    expect(await handleMessage({ ...message, value: JSON.stringify(event) }, { sql, publish })).toEqual({
      outcome: "ignored",
    });
    expect(await sql`select 1 from notification.consumed_messages where message_id = ${id}`).toHaveLength(0);
    expect(sent).toEqual([]);
  });
});
