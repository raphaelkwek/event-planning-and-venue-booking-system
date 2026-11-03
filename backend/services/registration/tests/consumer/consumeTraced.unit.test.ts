import { describe, expect, it } from "vitest";
import { SpanKind } from "@opentelemetry/api";
import type { Kafka } from "kafkajs";
import type { Sql } from "postgres";
import { instrumentSql, parentIdOf, startInMemoryTelemetry, withProducerSpans } from "@connectsphere/telemetry";
import { startConsumers } from "../../src/consumer/run.js";

/**
 * EN-08-T5: the registration consumer continues the trace of the approval it handles. Kafka and the
 * database are stand-ins; what is real is the consumer wiring in run.ts, the span helpers and the
 * handler. Against a real Postgres the same path is covered by the planning-core integration test.
 */

const t = startInMemoryTelemetry("registration-test");

const TOPIC = "connectsphere.venue-booking.v1";
const GROUP = "connectsphere.registration.seat-builder";
const ORIGIN = "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01";

/** A postgres.js Query as far as instrumentSql can tell: a Promise subclass carrying the template's strings. */
class FakeQuery extends Promise<unknown> {
  strings: string[] = [];
  static get [Symbol.species]() {
    return Promise;
  }
}

function fakeQuery(strings: readonly string[], rows: unknown[]) {
  const query = new FakeQuery((resolve) => resolve(rows));
  query.strings = Array.from(strings);
  return query;
}

/**
 * The inbox claim finds the message new, and every other statement (the seats' insert) succeeds. The
 * handler awaits the inbox claim, then createSeats, which is given empty results here.
 */
function database() {
  const tx = (strings: TemplateStringsArray) => fakeQuery(strings, strings.join("").includes("consumed_messages") ? [{ message_id: "claimed" }] : []);
  return instrumentSql(Object.assign(tx, { begin: async (fn: (tx: unknown) => Promise<unknown>) => fn(tx) })) as unknown as Sql;
}

function fakeKafka() {
  const handlers: Record<string, (payload: unknown) => Promise<void>> = {};
  const client = {
    consumer: ({ groupId }: { groupId: string }) => ({
      connect: async () => undefined,
      disconnect: async () => undefined,
      subscribe: async () => undefined,
      run: async ({ eachMessage }: { eachMessage: (payload: unknown) => Promise<void> }) => void (handlers[groupId] = eachMessage),
    }),
  } as unknown as Kafka;
  return { client, handlers };
}

/** An approval that names no layout capacity: the handler ignores it, which needs no seat SQL. */
const approvalWithoutLayout = JSON.stringify({
  specversion: "1.0",
  id: "44444444-4444-4444-8444-444444444444",
  source: "/connectsphere/planning-core/venue",
  type: "venue-booking.request-approved",
  subject: "11111111-1111-4111-8111-111111111111",
  time: "2026-10-18T02:00:00.000Z",
  datacontenttype: "application/json",
  traceparent: ORIGIN,
  actor: "VENUE_STAFF:00000000-0000-0000-0000-000000000003",
  data: {
    bookingRequestId: "11111111-1111-4111-8111-111111111111",
    reference: "BKR-000001",
    eventId: "22222222-2222-4222-8222-222222222222",
    eventReference: "EVT-000123",
    eventName: "Annual Research Symposium",
    venueId: "33333333-3333-4333-8333-333333333333",
    venueName: "Lee Kong Chian Auditorium",
    startsAt: "2026-12-02T06:00:00.000Z",
    endsAt: "2026-12-02T10:00:00.000Z",
    coordinatorId: "00000000-0000-0000-0000-000000000002",
    ownerId: "00000000-0000-0000-0000-000000000001",
    decidedBy: "00000000-0000-0000-0000-000000000003",
    decidedAt: "2026-10-18T02:00:00.000Z",
    bookingId: "55555555-5555-4555-8555-555555555555",
    replacedBookingId: null,
  },
});

async function publishedHeaders() {
  let headers: Record<string, string> = {};
  await withProducerSpans(TOPIC, [{ headers: { traceparent: ORIGIN } }], async ([sent]) => {
    headers = sent!.headers;
  }, { continueFromHeader: true });
  return headers;
}

describe("the registration consumer", () => {
  it("EN-08-T5 handles an approval in a CONSUMER span that is a child of the producer's, in the approval's trace", async () => {
    t.spans.reset();
    const { client, handlers } = fakeKafka();
    await startConsumers(client, database(), "");

    const headers = await publishedHeaders();
    await handlers[GROUP]!({
      topic: TOPIC,
      partition: 1,
      message: {
        key: Buffer.from("11111111-1111-4111-8111-111111111111"),
        value: Buffer.from(approvalWithoutLayout),
        headers: { traceparent: Buffer.from(headers.traceparent!) },
        offset: "9",
        timestamp: String(Date.now() - 100),
      },
    });

    const [producer] = t.byName(`${TOPIC} publish`);
    const [consumer] = t.byName(`${TOPIC} process`);
    expect(consumer!.kind).toBe(SpanKind.CONSUMER);
    expect(parentIdOf(consumer!)).toBe(producer!.spanContext().spanId);
    expect(consumer!.spanContext().traceId).toBe("0af7651916cd43dd8448eb211c80319c");
    expect(consumer!.attributes["messaging.consumer.group.name"]).toBe(GROUP);
    expect(consumer!.attributes["connectsphere.outcome"]).toBe("ignored");
  });

  it("EN-08-T5 continues from the CloudEvent's own traceparent when the message has no header", async () => {
    t.spans.reset();
    const { client, handlers } = fakeKafka();
    await startConsumers(client, database(), "");

    await handlers[GROUP]!({
      topic: TOPIC,
      partition: 0,
      message: { key: null, value: Buffer.from(approvalWithoutLayout), headers: undefined, offset: "1", timestamp: String(Date.now()) },
    });

    const [consumer] = t.byName(`${TOPIC} process`);
    expect(parentIdOf(consumer!)).toBe("b7ad6b7169203331");
    expect(consumer!.spanContext().traceId).toBe("0af7651916cd43dd8448eb211c80319c");
  });

  it("EN-08-T5 handles a message in the event-listings consumer under a CONSUMER span as well, in the message's trace", async () => {
    t.spans.reset();
    const { client, handlers } = fakeKafka();
    await startConsumers(client, database(), "");

    const headers = await publishedHeaders();
    // Not a listing message, so the handler skips it without touching the database; the span is what is checked.
    await handlers["connectsphere.registration.event-listings"]!({
      topic: "connectsphere.event.v1",
      partition: 0,
      message: {
        key: Buffer.from("11111111-1111-4111-8111-111111111111"),
        value: Buffer.from(approvalWithoutLayout),
        headers: { traceparent: Buffer.from(headers.traceparent!) },
        offset: "3",
        timestamp: String(Date.now()),
      },
    });

    const [consumer] = t.byName("connectsphere.event.v1 process");
    expect(consumer!.kind).toBe(SpanKind.CONSUMER);
    expect(consumer!.spanContext().traceId).toBe("0af7651916cd43dd8448eb211c80319c");
    expect(consumer!.attributes["messaging.consumer.group.name"]).toBe("connectsphere.registration.event-listings");
    expect(consumer!.attributes["connectsphere.outcome"]).toBe("ignored");
  });
});
