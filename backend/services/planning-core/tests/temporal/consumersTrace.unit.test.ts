import { describe, expect, it } from "vitest";
import { SpanKind } from "@opentelemetry/api";
import type { Kafka } from "kafkajs";
import { parentIdOf, startInMemoryTelemetry } from "@connectsphere/telemetry";
import { startCompletionConsumer } from "../../src/temporal/runCompletionConsumer.js";
import { startHoldExpiryConsumer } from "../../src/temporal/runHoldExpiryConsumer.js";

/**
 * EN-08-T4: the Temporal worker's two Kafka consumers handle each message in a CONSUMER span that
 * continues the trace in its traceparent header. Kafka and Temporal are stand-ins; the messages are
 * ones the handlers skip as invalid, which needs no scheduler.
 */

const t = startInMemoryTelemetry("worker-test");
const ORIGIN = "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01";

function fakeKafka() {
  let eachMessage: ((payload: unknown) => Promise<void>) | undefined;
  const client = {
    consumer: () => ({
      connect: async () => undefined,
      disconnect: async () => undefined,
      subscribe: async () => undefined,
      run: async (config: { eachMessage: (payload: unknown) => Promise<void> }) => void (eachMessage = config.eachMessage),
    }),
  } as unknown as Kafka;
  return { client, deliver: (payload: unknown) => eachMessage!(payload) };
}

const message = { key: Buffer.from("k"), value: Buffer.from("not json"), headers: { traceparent: Buffer.from(ORIGIN) }, offset: "5", timestamp: String(Date.now()) };

describe("the Temporal worker's Kafka consumers", () => {
  it("EN-08-T4 handle an event-topic message in a CONSUMER span, a child of the traceparent in its header", async () => {
    t.spans.reset();
    const { client, deliver } = fakeKafka();
    await startCompletionConsumer(client, {} as never, "");
    await deliver({ topic: "connectsphere.event.v1", partition: 0, message });
    const [consumer] = t.byName("connectsphere.event.v1 process");
    expect(consumer!.kind).toBe(SpanKind.CONSUMER);
    expect(parentIdOf(consumer!)).toBe("b7ad6b7169203331");
    expect(consumer!.spanContext().traceId).toBe("0af7651916cd43dd8448eb211c80319c");
    expect(consumer!.attributes["connectsphere.outcome"]).toBe("invalid");
  });

  it("EN-08-T4 handle a venue-booking message in a CONSUMER span, a child of the traceparent in its header", async () => {
    t.spans.reset();
    const { client, deliver } = fakeKafka();
    await startHoldExpiryConsumer(client, {} as never, "");
    await deliver({ topic: "connectsphere.venue-booking.v1", partition: 1, message });
    const [consumer] = t.byName("connectsphere.venue-booking.v1 process");
    expect(parentIdOf(consumer!)).toBe("b7ad6b7169203331");
    expect(consumer!.attributes["messaging.consumer.group.name"]).toMatch(/^connectsphere\./);
  });
});
