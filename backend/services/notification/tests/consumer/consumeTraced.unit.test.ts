import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { SpanKind } from "@opentelemetry/api";
import type { Kafka } from "kafkajs";
import type { Sql } from "postgres";
import { instrumentSql, parentIdOf, startInMemoryTelemetry, withProducerSpans } from "@connectsphere/telemetry";
import { startConsumers } from "../../src/consumer/run.js";
import { NOT_BEFORE_HEADER } from "../../src/domain/retryPolicy.js";

/**
 * EN-08-T4: the notification consumer continues the trace of the message it handles. Kafka and the
 * database are stand-ins; what is real is the consumer wiring in run.ts, the span helpers and the
 * handler. The same path against a real Postgres is in the planning-core integration test d4Trace.test.ts.
 */

const t = startInMemoryTelemetry("notification-test");

const TOPIC = "connectsphere.event.v1";
const RETRY_TOPIC = "connectsphere.notification.retry.v1";
const GROUP = "connectsphere.notification.event-notifier";

/** A postgres.js Query as far as instrumentSql can tell: a Promise subclass carrying the template's strings. */
class FakeQuery extends Promise<unknown> {
  strings: string[] = [];
  static get [Symbol.species]() {
    return Promise;
  }
}

function fakeQuery(strings: readonly string[], outcome: "ok" | "fail", rows: unknown[]) {
  const query = new FakeQuery((resolve, reject) => {
    if (outcome === "ok") resolve(rows);
    else reject(new Error("connection terminated unexpectedly"));
  });
  query.catch(() => undefined);
  query.strings = Array.from(strings);
  return query;
}

/** A database whose inbox claim succeeds (`ok`) or whose transactions fail (`fail`). */
function database(outcome: "ok" | "fail") {
  const tx = (strings: TemplateStringsArray) => fakeQuery(strings, "ok", [{ message_id: "claimed" }]);
  const sql = Object.assign((strings: TemplateStringsArray) => fakeQuery(strings, outcome, []), {
    begin: async (fn: (tx: unknown) => Promise<unknown>) => {
      if (outcome === "fail") throw new Error("connection terminated unexpectedly");
      return fn(tx);
    },
  });
  return instrumentSql(sql) as unknown as Sql;
}

/** The Kafka client as startConsumers uses it, keeping each consumer's eachMessage callback and every send. */
function fakeKafka() {
  const handlers: Record<string, (payload: unknown) => Promise<void>> = {};
  const sent: Array<{ topic: string; messages: Array<{ key: string | null; value: string | null; headers: Record<string, string> }> }> = [];
  const client = {
    producer: () => ({
      connect: async () => undefined,
      disconnect: async () => undefined,
      send: async (record: (typeof sent)[number]) => void sent.push(record),
    }),
    consumer: ({ groupId }: { groupId: string }) => ({
      connect: async () => undefined,
      disconnect: async () => undefined,
      subscribe: async () => undefined,
      run: async ({ eachMessage }: { eachMessage: (payload: unknown) => Promise<void> }) => void (handlers[groupId] = eachMessage),
    }),
  } as unknown as Kafka;
  return { client, handlers, sent };
}

function approval() {
  const eventId = randomUUID();
  return {
    key: eventId,
    value: JSON.stringify({
      specversion: "1.0",
      id: randomUUID(),
      source: "/connectsphere/planning-core/event",
      type: "event.approved",
      subject: eventId,
      time: new Date().toISOString(),
      datacontenttype: "application/json",
      traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
      actor: "EVENT_COORDINATOR:00000000-0000-0000-0000-000000000002",
      data: {
        eventId,
        eventReference: "EVT-000001",
        eventName: "Annual Research Symposium",
        ownerId: randomUUID(),
        approvedBy: "00000000-0000-0000-0000-000000000002",
        approvedAt: new Date().toISOString(),
      },
    }),
  };
}

/** What the outbox relay does: publish under a PRODUCER span, and hand back the headers it sent. */
async function publishedHeaders(originTraceparent: string) {
  let headers: Record<string, string> = {};
  await withProducerSpans(TOPIC, [{ headers: { traceparent: originTraceparent } }], async ([sent]) => {
    headers = sent!.headers;
  }, { continueFromHeader: true });
  return headers;
}

function kafkaMessage(m: { key: string; value: string }, headers: Record<string, string>) {
  return {
    key: Buffer.from(m.key),
    value: Buffer.from(m.value),
    headers: Object.fromEntries(Object.entries(headers).map(([name, value]) => [name, Buffer.from(value)])),
    offset: "17",
    timestamp: String(Date.now() - 250),
  };
}

describe("the notification consumer", () => {
  it("EN-08-T4 handles a message in a CONSUMER span that is a child of the producer's, with its queries below it", async () => {
    t.spans.reset();
    const { client, handlers } = fakeKafka();
    await startConsumers(client, database("ok"), "");

    const origin = approval();
    const headers = await publishedHeaders("00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01");
    await handlers[GROUP]!({ topic: TOPIC, partition: 3, message: kafkaMessage(origin, headers) });

    const [producer] = t.byName(`${TOPIC} publish`);
    const [consumer] = t.byName(`${TOPIC} process`);
    expect(consumer!.kind).toBe(SpanKind.CONSUMER);
    expect(parentIdOf(consumer!)).toBe(producer!.spanContext().spanId);
    expect(consumer!.spanContext().traceId).toBe("4bf92f3577b34da6a3ce929d0e0e4736");
    expect(consumer!.attributes["connectsphere.outcome"]).toBe("stored");
    expect(consumer!.attributes["messaging.consumer.group.name"]).toBe(GROUP);

    const [transaction] = t.byName("db.transaction");
    expect(parentIdOf(transaction!)).toBe(consumer!.spanContext().spanId);
    const queries = t.finished().filter((s) => s.kind === SpanKind.CLIENT && s.name !== "db.transaction");
    expect(queries.length).toBeGreaterThanOrEqual(2);
    expect(queries.every((s) => parentIdOf(s) === transaction!.spanContext().spanId)).toBe(true);
    expect(new Set(t.finished().map((s) => s.spanContext().traceId))).toEqual(new Set(["4bf92f3577b34da6a3ce929d0e0e4736"]));
  });

  it("EN-08-T4 keeps a failing message in its trace: the retry is a PRODUCER span under the consumer span", async () => {
    t.spans.reset();
    const { client, handlers, sent } = fakeKafka();
    await startConsumers(client, database("fail"), "");

    const headers = await publishedHeaders("00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01");
    await handlers[GROUP]!({ topic: TOPIC, partition: 0, message: kafkaMessage(approval(), headers) });

    expect(sent.map((s) => s.topic)).toEqual([RETRY_TOPIC]);
    const [consumer] = t.byName(`${TOPIC} process`);
    const [retry] = t.byName(`${RETRY_TOPIC} publish`);
    expect(consumer!.attributes["connectsphere.outcome"]).toBe("retried");
    expect(parentIdOf(retry!)).toBe(consumer!.spanContext().spanId);
    // The retry message names its own publish span, so the retry worker's span is its child.
    expect(sent[0]!.messages[0]!.headers.traceparent).toBe(
      `00-${retry!.spanContext().traceId}-${retry!.spanContext().spanId}-01`,
    );
  });

  it("EN-08-T7 logs what it did inside the span, so the line carries the trace id", async () => {
    t.spans.reset();
    const lines: string[] = [];
    const original = console.log;
    console.log = (line: string) => void lines.push(line);
    try {
      const { client, handlers } = fakeKafka();
      await startConsumers(client, database("ok"), "");
      const headers = await publishedHeaders("00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01");
      await handlers[GROUP]!({ topic: TOPIC, partition: 0, message: kafkaMessage(approval(), headers) });
    } finally {
      console.log = original;
    }
    const stored = lines.map((l) => JSON.parse(l) as Record<string, unknown>).find((l) => l.message === "notifications stored");
    expect(stored).toMatchObject({ traceId: "4bf92f3577b34da6a3ce929d0e0e4736", correlationId: "4bf92f3577b34da6a3ce929d0e0e4736" });
  });

  it("EN-08-T10 counts the retry worker's lag from when the retry was due, not from when it was queued", async () => {
    t.spans.reset();
    const { client, handlers } = fakeKafka();
    await startConsumers(client, database("ok"), "");

    const headers = await publishedHeaders("00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01");
    // Queued an hour ago with a back-off that ended 200 ms ago: the hour is waiting, not lag.
    const dueAt = Date.now() - 200;
    const message = {
      ...kafkaMessage(approval(), { ...headers, [NOT_BEFORE_HEADER]: String(dueAt) }),
      timestamp: String(Date.now() - 3_600_000),
    };
    await handlers["connectsphere.notification.retry-worker"]!({ topic: RETRY_TOPIC, partition: 0, message, heartbeat: async () => undefined });

    const lag = await t.metric("kafka_consumer_lag_seconds");
    const point = lag!.dataPoints.find((p) => p.attributes.group === "connectsphere.notification.retry-worker")!;
    expect((point.value as { max: number }).max).toBeLessThan(5);
  });
});
