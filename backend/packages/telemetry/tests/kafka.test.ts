import { describe, expect, it } from "vitest";
import { context, SpanKind, trace } from "@opentelemetry/api";
import { parentIdOf, startForTest } from "./support/testTelemetry.js";
import {
  incomingTraceparent,
  kafkaHeaders,
  parseTraceparent,
  withConsumerSpan,
  withProducerSpans,
  type ConsumedMessage,
} from "../src/index.js";

const t = startForTest("kafka-test");
const tracer = trace.getTracer("test");

const TOPIC = "connectsphere.event.v1";
const GROUP = "connectsphere.notification.event-notifier";

/** A span standing for the transaction that wrote an outbox row. */
function originatingSpan() {
  const span = tracer.startSpan("db.transaction", { kind: SpanKind.CLIENT });
  span.end();
  const { traceId, spanId } = span.spanContext();
  return { traceId, spanId, traceparent: `00-${traceId}-${spanId}-01` };
}

const message = (headers: Record<string, string>, value: string | null = "{}"): ConsumedMessage => ({
  topic: TOPIC,
  group: GROUP,
  partition: 2,
  offset: "41",
  key: "5b1d3f0e-0000-4000-8000-000000000001",
  timestamp: String(Date.now() - 1500),
  headers,
  value,
});

describe("publishing", () => {
  it("EN-08-T3 gives each message its own PRODUCER span, a child of the transaction in its own traceparent, and that span's traceparent as the header", async () => {
    t.spans.reset();
    const first = originatingSpan();
    const second = originatingSpan();
    let sent: Array<{ headers: Record<string, string> }> = [];

    await withProducerSpans(
      TOPIC,
      [
        { key: "a", headers: { traceparent: first.traceparent, "content-type": "application/json" } },
        { key: "b", headers: { traceparent: second.traceparent } },
      ],
      async (messages) => {
        sent = messages;
      },
      { continueFromHeader: true },
    );

    const producers = t.byName(`${TOPIC} publish`);
    expect(producers).toHaveLength(2);
    for (const [index, origin] of [first, second].entries()) {
      const span = producers.find((s) => s.spanContext().traceId === origin.traceId)!;
      expect(span.kind).toBe(SpanKind.PRODUCER);
      expect(parentIdOf(span)).toBe(origin.spanId);
      expect(span.attributes["messaging.system"]).toBe("kafka");
      expect(span.attributes["messaging.destination.name"]).toBe(TOPIC);
      expect(sent[index]!.headers.traceparent).toBe(`00-${origin.traceId}-${span.spanContext().spanId}-01`);
    }
    // Other headers are kept.
    expect(sent[0]!.headers["content-type"]).toBe("application/json");
  });

  it("EN-08-T3 makes the publish a child of the active span when it is not told to continue a header (a consumer's retry)", async () => {
    t.spans.reset();
    const parent = tracer.startSpan("consumer", { kind: SpanKind.CONSUMER });
    let sent: Array<{ headers: Record<string, string> }> = [];
    await context.with(trace.setSpan(context.active(), parent), () =>
      withProducerSpans(TOPIC, [{ headers: { traceparent: "00-" + "1".repeat(32) + "-" + "2".repeat(16) + "-01" } }], async (messages) => {
        sent = messages;
      }),
    );
    parent.end();
    const [producer] = t.byName(`${TOPIC} publish`);
    expect(parentIdOf(producer!)).toBe(parent.spanContext().spanId);
    expect(producer!.spanContext().traceId).toBe(parent.spanContext().traceId);
    // The header now names the publish span, not the stale one the message arrived with.
    expect(parseTraceparent(sent[0]!.headers.traceparent)?.spanId).toBe(producer!.spanContext().spanId);
  });

  it("EN-08-T3 marks every span of a failed send as an error, rethrows, and counts the failure", async () => {
    t.spans.reset();
    const origin = originatingSpan();
    await expect(
      withProducerSpans(
        TOPIC,
        [{ headers: { traceparent: origin.traceparent } }, { headers: { traceparent: origin.traceparent } }],
        async () => {
          throw new Error("broker not available");
        },
        { continueFromHeader: true },
      ),
    ).rejects.toThrow("broker not available");

    const producers = t.byName(`${TOPIC} publish`);
    expect(producers).toHaveLength(2);
    expect(producers.every((s) => s.status.code === 2 && s.status.message === "broker not available")).toBe(true);

    const published = await t.metric("kafka_messages_published_total");
    const failed = published!.dataPoints.find((p) => p.attributes.result === "error" && p.attributes.topic === TOPIC);
    expect(failed!.value).toBe(2);
  });

  it("EN-08-T3 starts a new trace for a message whose header is missing or unusable", async () => {
    t.spans.reset();
    let sent: Array<{ headers: Record<string, string> }> = [];
    await withProducerSpans(TOPIC, [{ headers: {} }, { headers: { traceparent: "not-a-traceparent" } }], async (messages) => {
      sent = messages;
    }, { continueFromHeader: true });
    const producers = t.byName(`${TOPIC} publish`);
    expect(producers.every((s) => parentIdOf(s) === undefined)).toBe(true);
    expect(sent.map((m) => parseTraceparent(m.headers.traceparent) !== null)).toEqual([true, true]);
  });
});

describe("consuming", () => {
  it("EN-08-T4 makes the consumer span a child of the producer span named in the header, in the same trace", async () => {
    t.spans.reset();
    const origin = originatingSpan();
    let headers: Record<string, string> = {};
    await withProducerSpans(TOPIC, [{ headers: { traceparent: origin.traceparent } }], async ([sent]) => {
      headers = sent!.headers;
    }, { continueFromHeader: true });
    const [producer] = t.byName(`${TOPIC} publish`);

    let seenInside: string | undefined;
    await withConsumerSpan(message(headers), async () => {
      seenInside = trace.getActiveSpan()?.spanContext().traceId;
    });

    const [consumer] = t.byName(`${TOPIC} process`);
    expect(consumer!.kind).toBe(SpanKind.CONSUMER);
    expect(parentIdOf(consumer!)).toBe(producer!.spanContext().spanId);
    expect(consumer!.spanContext().traceId).toBe(origin.traceId);
    expect(seenInside).toBe(origin.traceId);
    expect(consumer!.attributes["messaging.consumer.group.name"]).toBe(GROUP);
    expect(consumer!.attributes["messaging.destination.partition.id"]).toBe("2");
    expect(consumer!.attributes["messaging.kafka.offset"]).toBe(41);
  });

  it("EN-08-T4 falls back to the CloudEvent's own traceparent when a message has no header", async () => {
    t.spans.reset();
    const origin = originatingSpan();
    await withConsumerSpan(message({}, JSON.stringify({ id: "x", traceparent: origin.traceparent })), async () => undefined);
    const [consumer] = t.byName(`${TOPIC} process`);
    expect(parentIdOf(consumer!)).toBe(origin.spanId);
    expect(consumer!.spanContext().traceId).toBe(origin.traceId);
  });

  it("EN-08-T4 starts a new trace for a message that names no usable parent", async () => {
    t.spans.reset();
    for (const value of ["not json", "{}", JSON.stringify({ traceparent: "garbage" }), null]) {
      await withConsumerSpan(message({ traceparent: "garbage" }, value), async () => undefined);
    }
    const consumers = t.byName(`${TOPIC} process`);
    expect(consumers).toHaveLength(4);
    expect(consumers.every((s) => parentIdOf(s) === undefined)).toBe(true);
    expect(incomingTraceparent(message({}, "not json"))).toBeUndefined();
  });

  it("EN-08-T4 marks the span failed and rethrows when the handler throws", async () => {
    t.spans.reset();
    await expect(
      withConsumerSpan(message({}), async () => {
        throw new Error("database unavailable");
      }),
    ).rejects.toThrow("database unavailable");
    const [consumer] = t.byName(`${TOPIC} process`);
    expect(consumer!.status.code).toBe(2);
    expect(consumer!.events.some((e) => e.name === "exception")).toBe(true);
  });

  it("EN-08-T10 records processing time by outcome and lag from the broker's timestamp", async () => {
    await withConsumerSpan(message({}), async () => "stored", (result) => result);
    await withConsumerSpan({ ...message({}), timestamp: undefined }, async () => "duplicate", (result) => result);

    const processing = await t.metric("kafka_consumer_processing_duration_seconds");
    const outcomes = processing!.dataPoints.map((p) => p.attributes.outcome);
    expect(outcomes).toEqual(expect.arrayContaining(["stored", "duplicate", "error"]));
    expect(processing!.dataPoints[0]!.attributes).toMatchObject({ topic: TOPIC, group: GROUP });

    const lag = await t.metric("kafka_consumer_lag_seconds");
    const point = lag!.dataPoints.find((p) => p.attributes.topic === TOPIC)!;
    const histogram = point.value as { min: number; count: number };
    expect(histogram.min).toBeGreaterThanOrEqual(1.4);
    // The message without a timestamp adds no lag observation.
    expect(histogram.count).toBeGreaterThanOrEqual(1);
  });
});

describe("Kafka headers", () => {
  it("decodes buffers, strings and arrays, and leaves out absent values", () => {
    expect(
      kafkaHeaders({
        a: Buffer.from("one"),
        b: "two",
        c: [Buffer.from("x"), "y"],
        d: undefined,
      }),
    ).toEqual({ a: "one", b: "two", c: "x,y" });
    expect(kafkaHeaders(undefined)).toEqual({});
  });
});
