import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Partitioners, type Kafka } from "kafkajs";
import type { Sql } from "postgres";
import { kafkaPublisher } from "../../src/shared/kafka/client.js";
import { logger } from "../../src/shared/logger.js";
import { OutboxRelay, type PassResult } from "../../src/shared/outbox-relay.js";

/** EN-04.2: the relay's publisher and its run loop. Building the client is tested in @connectsphere/kafka. */

function fakeClient(options: { failFirstConnect?: boolean } = {}) {
  const producer = {
    connects: 0,
    sends: [] as unknown[],
    disconnects: 0,
    async connect() {
      producer.connects += 1;
      if (options.failFirstConnect && producer.connects === 1) throw new Error("broker down");
    },
    async send(record: unknown) {
      producer.sends.push(record);
    },
    async disconnect() {
      producer.disconnects += 1;
    },
  };
  const client = { producer: vi.fn(() => producer) } as unknown as Kafka;
  return { client, producer };
}

describe("kafkaPublisher", () => {
  const message = { key: "k", value: "{}", headers: { "content-type": "application/cloudevents+json" } };

  it("never creates a topic, keeps one request in flight so a retry cannot overtake, and hashes keys like the Java client", () => {
    const { client } = fakeClient();
    kafkaPublisher(client);
    expect(client.producer).toHaveBeenCalledWith({
      allowAutoTopicCreation: false,
      maxInFlightRequests: 1,
      createPartitioner: Partitioners.DefaultPartitioner,
    });
  });

  it("connects once, then sends each batch to its topic with every replica's acknowledgement", async () => {
    const { client, producer } = fakeClient();
    const publisher = kafkaPublisher(client);
    await publisher.publish("connectsphere.event.v1", [message]);
    await publisher.publish("connectsphere.event.v1", [message]);
    expect(producer.connects).toBe(1);
    expect(producer.sends).toEqual([
      { topic: "connectsphere.event.v1", messages: [message], acks: -1 },
      { topic: "connectsphere.event.v1", messages: [message], acks: -1 },
    ]);
  });

  it("tries to connect again on the next publish after a failed connection", async () => {
    const { client, producer } = fakeClient({ failFirstConnect: true });
    const publisher = kafkaPublisher(client);
    await expect(publisher.publish("t", [message])).rejects.toThrow("broker down");
    await publisher.publish("t", [message]);
    expect(producer.connects).toBe(2);
    expect(producer.sends).toHaveLength(1);
  });

  it("disconnects only a producer that connected", async () => {
    const idle = fakeClient();
    await kafkaPublisher(idle.client).disconnect();
    expect(idle.producer.disconnects).toBe(0);

    const used = fakeClient();
    const publisher = kafkaPublisher(used.client);
    await publisher.publish("t", [message]);
    await publisher.disconnect();
    expect(used.producer.disconnects).toBe(1);
  });
});

/** A relay whose passes return scripted results instead of touching a database. */
class ScriptedRelay extends OutboxRelay {
  calls = 0;
  constructor(private readonly script: Array<Partial<PassResult> | Error>) {
    super({ sql: {} as Sql, tables: [], publisher: { publish: async () => undefined }, batchSize: 100, idleMs: 1000 });
  }
  override async runOnce(): Promise<PassResult> {
    const next = this.script[Math.min(this.calls, this.script.length - 1)]!;
    this.calls += 1;
    if (next instanceof Error) throw next;
    return { published: 0, failed: 0, parked: 0, busy: 0, ...next };
  }
}

describe("the relay's run loop", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("goes again at once after a full batch, and waits idleMs when there was nothing to do", async () => {
    const relay = new ScriptedRelay([{ published: 100 }, { published: 0 }]);
    relay.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(relay.calls).toBe(2);
    await vi.advanceTimersByTimeAsync(999);
    expect(relay.calls).toBe(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(relay.calls).toBe(3);
    await relay.stop();
  });

  it("backs off after failed sends: one second, then two", async () => {
    const relay = new ScriptedRelay([{ failed: 1 }, { failed: 1 }, { published: 0 }]);
    relay.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(relay.calls).toBe(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(relay.calls).toBe(2);
    await vi.advanceTimersByTimeAsync(1999);
    expect(relay.calls).toBe(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(relay.calls).toBe(3);
    await relay.stop();
  });

  it("keeps running after a pass throws, such as the database going away, backing off and logging it", async () => {
    const error = vi.spyOn(logger, "error").mockImplementation(() => undefined);
    const relay = new ScriptedRelay([new Error("connection terminated"), { published: 0 }]);
    relay.start();
    await vi.advanceTimersByTimeAsync(1000);
    expect(relay.calls).toBe(2);
    expect(error).toHaveBeenCalledWith("outbox relay pass failed", { error: "connection terminated" });
    await relay.stop();
    error.mockRestore();
  });

  it("stops at once when stopped while waiting, and runs no further pass", async () => {
    const relay = new ScriptedRelay([{ published: 0 }]);
    relay.start();
    await vi.advanceTimersByTimeAsync(0);
    await relay.stop();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(relay.calls).toBe(1);
  });

  it("starts one loop however often start() is called", async () => {
    const relay = new ScriptedRelay([{ published: 0 }]);
    relay.start();
    relay.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(relay.calls).toBe(1);
    await relay.stop();
  });
});
