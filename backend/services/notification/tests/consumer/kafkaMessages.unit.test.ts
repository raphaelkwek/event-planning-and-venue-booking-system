import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { consumerGroup, toIncoming, waitUntilDue } from "../../src/consumer/kafkaMessages.js";

/** EN-04.3: the consumer's Kafka plumbing that needs no broker to test. */

describe("consumerGroup", () => {
  it("is connectsphere.notification.<consumer> when deployed (implementation.md §3.1)", () => {
    expect(consumerGroup("event-notifier", "")).toBe("connectsphere.notification.event-notifier");
  });

  it("adds the laptop's KAFKA_GROUP_SUFFIX, so a local consumer never takes the deployed one's partitions", () => {
    expect(consumerGroup("retry-worker", "dev-sk")).toBe("connectsphere.notification.retry-worker.dev-sk");
  });
});

describe("toIncoming", () => {
  it("turns kafkajs's buffers into strings for the handler", () => {
    expect(
      toIncoming("connectsphere.event.v1", {
        key: Buffer.from("event-1"),
        value: Buffer.from("{}"),
        headers: { "content-type": Buffer.from("application/cloudevents+json"), retries: ["1", "2"] },
      }),
    ).toEqual({
      topic: "connectsphere.event.v1",
      key: "event-1",
      value: "{}",
      headers: { "content-type": "application/cloudevents+json", retries: "1,2" },
    });
  });

  it("keeps a missing key, value or header set as absent", () => {
    expect(toIncoming("t", { key: null, value: null })).toEqual({ topic: "t", key: null, value: null, headers: {} });
  });

  it("drops a header with no value", () => {
    expect(toIncoming("t", { key: null, value: null, headers: { empty: undefined } }).headers).toEqual({});
  });
});

describe("waitUntilDue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns at once for a message already due", async () => {
    const heartbeat = vi.fn(async () => undefined);
    await waitUntilDue(Date.now() - 1, heartbeat, () => false);
    expect(heartbeat).not.toHaveBeenCalled();
  });

  it("waits until the message is due, heartbeating so the group does not think it died", async () => {
    const heartbeat = vi.fn(async () => undefined);
    let done = false;
    void waitUntilDue(Date.now() + 10_000, heartbeat, () => false).then(() => (done = true));
    await vi.advanceTimersByTimeAsync(9_000);
    expect(done).toBe(false);
    expect(heartbeat.mock.calls.length).toBeGreaterThanOrEqual(3);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(done).toBe(true);
  });

  it("gives up when the service is stopping, so the message is not committed unhandled", async () => {
    let stopping = false;
    const waiting = waitUntilDue(Date.now() + 60_000, async () => undefined, () => stopping);
    const failed = expect(waiting).rejects.toThrow(/stopping/);
    stopping = true;
    await vi.advanceTimersByTimeAsync(3_000);
    await failed;
  });
});
