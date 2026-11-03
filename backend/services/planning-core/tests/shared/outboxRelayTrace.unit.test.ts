import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { context, SpanKind, trace } from "@opentelemetry/api";
import type { Sql } from "postgres";
import { parentIdOf, startInMemoryTelemetry } from "@connectsphere/telemetry";
import { OutboxRelay, type OutboxPublisher } from "../../src/shared/outbox-relay.js";
import { newTraceparent } from "../../src/shared/tracing.js";

/**
 * EN-08-T3: the relay publishes each outbox row under a PRODUCER span that continues the trace of the
 * transaction that wrote the row, and the Kafka message carries that span's traceparent. The database is
 * a stand-in that returns scripted rows; the real-Postgres version is d4Trace.test.ts.
 */

const t = startInMemoryTelemetry("planning-core-test");
const tracer = trace.getTracer("test");
const TOPIC = "connectsphere.event.v1";

/** A span standing for the transaction in which a request wrote its outbox row. */
function writingTransaction() {
  const span = tracer.startSpan("db.transaction", { kind: SpanKind.CLIENT });
  span.end();
  return span.spanContext();
}

function outboxRow(traceparent: string, overrides: { id?: string; messageKey?: string } = {}) {
  const eventId = randomUUID();
  return {
    id: overrides.id ?? randomUUID(),
    topic: TOPIC,
    message_key: overrides.messageKey ?? eventId,
    envelope: {
      specversion: "1.0",
      id: randomUUID(),
      source: "/connectsphere/planning-core/event",
      type: "event.approved",
      subject: eventId,
      time: new Date().toISOString(),
      datacontenttype: "application/json",
      traceparent,
      actor: "EVENT_COORDINATOR:00000000-0000-0000-0000-000000000002",
      data: {
        eventId,
        eventReference: "EVT-000001",
        eventName: "Annual Research Symposium",
        ownerId: randomUUID(),
        approvedBy: "00000000-0000-0000-0000-000000000002",
        approvedAt: new Date().toISOString(),
      },
    },
  };
}

/** The part of postgres.js the relay uses: a transaction whose tagged statements return what the relay expects. */
function databaseWith(rows: ReturnType<typeof outboxRow>[]) {
  const statements: string[] = [];
  const tx = (strings: TemplateStringsArray | string | unknown[]) => {
    if (typeof strings === "string" || !("raw" in (strings as object))) return { identifier: strings };
    const text = (strings as TemplateStringsArray).join("?");
    statements.push(text);
    if (text.includes("pg_try_advisory_xact_lock")) return Promise.resolve([{ locked: true }]);
    if (text.includes("select id, topic")) return Promise.resolve(rows);
    return Promise.resolve([]);
  };
  return { sql: { begin: async (fn: (tx: unknown) => Promise<unknown>) => fn(tx) } as unknown as Sql, statements };
}

function recordingPublisher(failWith?: Error) {
  const published: Array<{ topic: string; messages: Array<{ headers: Record<string, string> }> }> = [];
  const publisher: OutboxPublisher = {
    async publish(topic, messages) {
      if (failWith) throw failWith;
      published.push({ topic, messages });
    },
  };
  return { publisher, published };
}

describe("the outbox relay's trace", () => {
  it("EN-08-T3 sends each message with the traceparent of its own PRODUCER span, a child of the transaction that wrote the row", async () => {
    t.spans.reset();
    const first = writingTransaction();
    const second = writingTransaction();
    const toSend = [outboxRow(`00-${first.traceId}-${first.spanId}-01`), outboxRow(`00-${second.traceId}-${second.spanId}-01`)];
    const { sql } = databaseWith(toSend);
    const { publisher, published } = recordingPublisher();

    const result = await new OutboxRelay({ sql, tables: ["event.outbox"], publisher }).runOnce();

    expect(result).toMatchObject({ published: 2, failed: 0 });
    const producers = t.byName(`${TOPIC} publish`);
    expect(producers).toHaveLength(2);
    for (const [index, origin] of [first, second].entries()) {
      const producer = producers.find((span) => span.spanContext().traceId === origin.traceId)!;
      expect(producer.kind).toBe(SpanKind.PRODUCER);
      expect(parentIdOf(producer)).toBe(origin.spanId);
      expect(published[0]!.messages[index]!.headers.traceparent).toBe(`00-${origin.traceId}-${producer.spanContext().spanId}-01`);
    }
  });

  it("EN-08-T3 keeps the CloudEvent's own traceparent in the payload, and the content type header", async () => {
    t.spans.reset();
    const origin = writingTransaction();
    const row = outboxRow(`00-${origin.traceId}-${origin.spanId}-01`);
    const { sql } = databaseWith([row]);
    const { publisher, published } = recordingPublisher();

    await new OutboxRelay({ sql, tables: ["event.outbox"], publisher }).runOnce();

    const message = published[0]!.messages[0] as unknown as { value: string; headers: Record<string, string> };
    expect(JSON.parse(message.value).traceparent).toBe(row.envelope.traceparent);
    expect(message.headers["content-type"]).toBe("application/cloudevents+json; charset=UTF-8");
  });

  it("EN-08-T3 marks the producer spans failed when the broker refuses, and leaves the row pending", async () => {
    t.spans.reset();
    const origin = writingTransaction();
    const { sql, statements } = databaseWith([outboxRow(`00-${origin.traceId}-${origin.spanId}-01`)]);
    const { publisher } = recordingPublisher(new Error("broker not available"));

    const result = await new OutboxRelay({ sql, tables: ["event.outbox"], publisher }).runOnce();

    expect(result).toMatchObject({ published: 0, failed: 1 });
    const [producer] = t.byName(`${TOPIC} publish`);
    expect(producer!.status.code).toBe(2);
    expect(statements.some((s) => s.includes("attempts = attempts + 1"))).toBe(true);
  });

  it("EN-08-T3 makes no span for a row that can never be published", async () => {
    t.spans.reset();
    const origin = writingTransaction();
    const row = outboxRow(`00-${origin.traceId}-${origin.spanId}-01`, { messageKey: randomUUID() });
    const { sql } = databaseWith([row]);
    const { publisher, published } = recordingPublisher();

    const result = await new OutboxRelay({ sql, tables: ["event.outbox"], publisher }).runOnce();

    expect(result).toMatchObject({ published: 0, parked: 1 });
    expect(published).toHaveLength(0);
    expect(t.byName(`${TOPIC} publish`)).toHaveLength(0);
  });

  it("EN-08-T3 gives a row written with no active span a new valid traceparent, so the relay still publishes one", () => {
    expect(newTraceparent()).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
  });
});

describe("the traceparent a new message is written with", () => {
  it("EN-08-T3 is the active span's, so the message belongs to the request that caused it", () => {
    const span = tracer.startSpan("handler");
    const { traceId, spanId } = span.spanContext();
    const inside = context.with(trace.setSpan(context.active(), span), () => newTraceparent());
    span.end();
    expect(inside).toBe(`00-${traceId}-${spanId}-01`);
  });
});
