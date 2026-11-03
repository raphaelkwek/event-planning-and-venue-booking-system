import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { context, SpanKind, trace } from "@opentelemetry/api";
import type { Sql } from "postgres";
import { parentIdOf, startInMemoryTelemetry } from "@connectsphere/telemetry";
import { OutboxRelay, type OutboxPublisher } from "../../src/outbox/relay.js";
import { newTraceparent } from "../../src/outbox/write.js";

/**
 * EN-08-T3: registration's outbox relay publishes each row under a PRODUCER span that continues the trace of
 * the transaction that wrote it, and the Kafka message carries that span's traceparent. The database is a
 * stand-in returning scripted rows; against real Postgres the relay is covered by relay.test.ts.
 */

const t = startInMemoryTelemetry("registration-relay-test");
const tracer = trace.getTracer("test");
const TOPIC = "connectsphere.registration.v1";

function writingTransaction() {
  const span = tracer.startSpan("db.transaction", { kind: SpanKind.CLIENT });
  span.end();
  return span.spanContext();
}

function outboxRow(traceparent: string) {
  const registrationId = randomUUID();
  return {
    id: randomUUID(),
    topic: TOPIC,
    message_key: registrationId,
    envelope: {
      specversion: "1.0",
      id: randomUUID(),
      source: "/connectsphere/registration",
      type: "registration.withdrawn",
      subject: registrationId,
      time: new Date().toISOString(),
      datacontenttype: "application/json",
      traceparent,
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
    },
  };
}

function databaseWith(rows: ReturnType<typeof outboxRow>[]) {
  const tx = (strings: TemplateStringsArray | string | unknown[]) => {
    if (typeof strings === "string" || !("raw" in (strings as object))) return { identifier: strings };
    const text = (strings as TemplateStringsArray).join("?");
    if (text.includes("pg_try_advisory_xact_lock")) return Promise.resolve([{ locked: true }]);
    if (text.includes("select id, topic")) return Promise.resolve(rows);
    return Promise.resolve([]);
  };
  return { begin: async (fn: (tx: unknown) => Promise<unknown>) => fn(tx) } as unknown as Sql;
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

describe("the registration outbox relay's trace", () => {
  it("EN-08-T3 sends each message with the traceparent of its own PRODUCER span, a child of the transaction that wrote the row", async () => {
    t.spans.reset();
    const origin = writingTransaction();
    const { publisher, published } = recordingPublisher();

    const result = await new OutboxRelay({
      sql: databaseWith([outboxRow(`00-${origin.traceId}-${origin.spanId}-01`)]),
      table: "registration.outbox",
      publisher,
    }).runOnce();

    expect(result).toMatchObject({ published: 1, failed: 0 });
    const [producer] = t.byName(`${TOPIC} publish`);
    expect(producer!.kind).toBe(SpanKind.PRODUCER);
    expect(parentIdOf(producer!)).toBe(origin.spanId);
    expect(published[0]!.messages[0]!.headers.traceparent).toBe(`00-${origin.traceId}-${producer!.spanContext().spanId}-01`);
  });

  it("EN-08-T3 marks the producer span failed when the broker refuses", async () => {
    t.spans.reset();
    const origin = writingTransaction();
    const { publisher } = recordingPublisher(new Error("broker not available"));

    const result = await new OutboxRelay({
      sql: databaseWith([outboxRow(`00-${origin.traceId}-${origin.spanId}-01`)]),
      table: "registration.outbox",
      publisher,
    }).runOnce();

    expect(result).toMatchObject({ published: 0, failed: 1 });
    expect(t.byName(`${TOPIC} publish`)[0]!.status.code).toBe(2);
  });

  it("EN-08-T3 writes a row with the active span's traceparent, or a new valid one when there is none", () => {
    expect(newTraceparent()).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
    const span = tracer.startSpan("handler");
    const { traceId, spanId } = span.spanContext();
    const inside = context.with(trace.setSpan(context.active(), span), () => newTraceparent());
    span.end();
    expect(inside).toBe(`00-${traceId}-${spanId}-01`);
  });
});
