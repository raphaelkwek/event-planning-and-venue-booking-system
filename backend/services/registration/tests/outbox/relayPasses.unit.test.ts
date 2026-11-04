import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Kafka } from "kafkajs";
import { OutboxRelay, kafkaPublisher, UNPUBLISHABLE_PREFIX, type OutboxPublisher } from "../../src/outbox/relay.js";
import { newTraceparent, writeRegistrationOutbox } from "../../src/outbox/write.js";
import { scriptedSql, type Step } from "../support/scriptedSql.js";

/**
 * EN-13 — the outbox relay's decisions pass by pass, and the message the outbox
 * write stores, with a scripted client for Postgres: what is published, what is
 * set aside for good, what stays pending after a failed send. The locking and
 * ordering against a real table run in relay.test.ts in CI.
 */

const TOPIC = "connectsphere.registration.v1";
const TRACE = "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01";

function row(over: { subject?: string; key?: string; topic?: string; type?: string } = {}) {
  const subject = over.subject ?? randomUUID();
  return {
    id: randomUUID(),
    topic: over.topic ?? TOPIC,
    message_key: over.key ?? subject,
    envelope: {
      specversion: "1.0",
      id: randomUUID(),
      source: "/connectsphere/registration",
      type: over.type ?? "registration.withdrawn",
      subject,
      time: "2026-12-03T02:00:00.000Z",
      datacontenttype: "application/json",
      traceparent: TRACE,
      actor: "ATTENDEE:00000000-0000-0000-0000-000000000005",
      data: {
        registrationId: subject,
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

const pass = (rows: ReturnType<typeof row>[], locked = true, extra: Step[] = []) =>
  scriptedSql([
    { match: /pg_try_advisory_xact_lock/, rows: [{ locked }] },
    { match: /select id, topic, message_key, envelope/, rows },
    ...extra,
  ]);

const publisherThat = (behaviour: "ok" | Error = "ok") => {
  const publish = vi.fn(async () => {
    if (behaviour !== "ok") throw behaviour;
  });
  return { publish } satisfies OutboxPublisher;
};

afterEach(() => vi.useRealTimers());

describe("OutboxRelay.runOnce", () => {
  it("skips the pass, touching no row, when another relay holds the table's lock", async () => {
    const sql = pass([row()], false);
    const publisher = publisherThat();
    const result = await new OutboxRelay({ sql, table: "registration.outbox", publisher }).runOnce();
    expect(result).toEqual({ published: 0, failed: 0, parked: 0, busy: true });
    expect(publisher.publish).not.toHaveBeenCalled();
    expect(sql.calls).toHaveLength(1);
  });

  it("publishes the claimed rows in order and marks exactly those published", async () => {
    const [a, b] = [row(), row()];
    const sql = pass([a, b], true, [{ match: /set published_at = now\(\)/ }]);
    const publisher = publisherThat();
    const result = await new OutboxRelay({ sql, table: "registration.outbox", publisher, batchSize: 50 }).runOnce();

    expect(result).toEqual({ published: 2, failed: 0, parked: 0, busy: false });
    expect(publisher.publish).toHaveBeenCalledOnce();
    expect(publisher.publish.mock.calls[0]![0]).toBe(TOPIC);
    const sent = publisher.publish.mock.calls[0]![1] as Array<{ key: string }>;
    expect(sent.map((m) => m.key)).toEqual([a.message_key, b.message_key]);
    const mark = sql.calls.find((c) => c.text.includes("set published_at"))!;
    expect(mark.values).toEqual([[a.id, b.id]]);
    // The claim is bounded by the batch size and skips rows locked by another pass.
    const claim = sql.calls.find((c) => c.text.includes("select id, topic"))!;
    expect(claim.text).toContain("for update skip locked");
    expect(claim.values).toEqual([`${UNPUBLISHABLE_PREFIX}%`, 50]);
  });

  it("sets aside a row that can never publish, with the reason, and still publishes the rest", async () => {
    const good = row();
    const wrongKey = row({ key: randomUUID() });
    const wrongTopic = row({ topic: "connectsphere.unknown.v9" });
    const sql = pass([wrongKey, good, wrongTopic], true, [{ match: /set attempts = attempts \+ 1, last_error = \?\s+where id = \?/ }, { match: /set published_at/ }]);
    const publisher = publisherThat();

    const result = await new OutboxRelay({ sql, table: "registration.outbox", publisher }).runOnce();

    expect(result).toEqual({ published: 1, failed: 0, parked: 2, busy: false });
    const parked = sql.calls.filter((c) => c.text.includes("set attempts = attempts + 1, last_error = ? where id = ?"));
    expect(parked.map((c) => c.values[1])).toEqual([wrongKey.id, wrongTopic.id]);
    expect(parked.every((c) => String(c.values[0]).startsWith(UNPUBLISHABLE_PREFIX))).toBe(true);
    expect(parked[0]!.values[0]).toContain("message_key is not the event's subject");
  });

  it("leaves the rows pending, counting the attempt and keeping the error, when the send fails", async () => {
    const [a, b] = [row(), row()];
    const sql = pass([a, b], true, [{ match: /set attempts = attempts \+ 1, last_error = \? where id in/ }]);
    const result = await new OutboxRelay({ sql, table: "registration.outbox", publisher: publisherThat(new Error("broker down")) }).runOnce();

    expect(result).toEqual({ published: 0, failed: 2, parked: 0, busy: false });
    const failure = sql.calls.find((c) => c.text.includes("where id in"))!;
    expect(failure.values).toEqual(["broker down", [a.id, b.id]]);
    expect(sql.calls.some((c) => c.text.includes("set published_at"))).toBe(false);
  });

  it("keeps a long broker error to 1000 characters", async () => {
    const sql = pass([row()], true, [{ match: /set attempts/ }]);
    await new OutboxRelay({ sql, table: "registration.outbox", publisher: publisherThat(new Error("x".repeat(5000))) }).runOnce();
    expect((sql.calls.find((c) => c.text.includes("set attempts"))!.values[0] as string).length).toBe(1000);
  });

  it("fails the pass, committing nothing, on an error that is not a row's fault", async () => {
    const sql = scriptedSql([{ match: /pg_try_advisory_xact_lock/, error: new Error("connection lost") }]);
    await expect(new OutboxRelay({ sql, table: "registration.outbox", publisher: publisherThat() }).runOnce()).rejects.toThrow("connection lost");
  });
});

describe("OutboxRelay.start and stop", () => {
  it("runs passes until stopped, waiting between idle ones, and stop lets the loop end", async () => {
    vi.useFakeTimers();
    const sql = pass([]);
    const relay = new OutboxRelay({ sql, table: "registration.outbox", publisher: publisherThat(), idleMs: 1000 });
    relay.start();
    relay.start(); // a second start changes nothing
    await vi.advanceTimersByTimeAsync(2500);
    const passes = sql.calls.filter((c) => c.text.includes("pg_try_advisory_xact_lock")).length;
    expect(passes).toBeGreaterThanOrEqual(3);
    const stopped = relay.stop();
    await vi.advanceTimersByTimeAsync(10);
    await stopped;
    const after = sql.calls.length;
    await vi.advanceTimersByTimeAsync(5000);
    expect(sql.calls).toHaveLength(after);
  });

  it("backs off after a failed pass and carries on after a thrown one", async () => {
    vi.useFakeTimers();
    let n = 0;
    const sql = scriptedSql([
      {
        match: /pg_try_advisory_xact_lock/,
        rows: () => {
          n += 1;
          if (n === 1) throw new Error("connection lost");
          return [{ locked: true }];
        },
      },
      { match: /select id, topic/, rows: [row()] },
      { match: /set attempts/ },
    ]);
    const publisher = publisherThat(new Error("broker down"));
    const relay = new OutboxRelay({ sql, table: "registration.outbox", publisher, idleMs: 100 });
    relay.start();
    await vi.advanceTimersByTimeAsync(900); // the thrown pass backs off 1 s
    expect(publisher.publish).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(300);
    expect(publisher.publish).toHaveBeenCalledOnce();
    const stopped = relay.stop();
    await vi.advanceTimersByTimeAsync(40_000);
    await stopped;
  });

  it("goes straight to the next pass after a full batch", async () => {
    vi.useFakeTimers();
    // The first pass fills the batch; the next finds the outbox empty, so the loop then idles.
    let claims = 0;
    const sql = scriptedSql([
      { match: /pg_try_advisory_xact_lock/, rows: [{ locked: true }] },
      { match: /select id, topic, message_key, envelope/, rows: () => (claims++ === 0 ? [row(), row()] : []) },
      { match: /set published_at/ },
    ]);
    const relay = new OutboxRelay({ sql, table: "registration.outbox", publisher: publisherThat(), batchSize: 2, idleMs: 60_000 });
    relay.start();
    await vi.advanceTimersByTimeAsync(50); // far less than idleMs, yet a second pass has run
    expect(claims).toBe(2);
    const stopped = relay.stop();
    await vi.advanceTimersByTimeAsync(50);
    await stopped;
  });
});

describe("kafkaPublisher", () => {
  const client = () => {
    const producer = { connect: vi.fn(async () => undefined), send: vi.fn(async () => []), disconnect: vi.fn(async () => undefined) };
    const factory = vi.fn(() => producer);
    return { producer, factory, kafka: { producer: factory } as unknown as Kafka };
  };

  it("connects once, sends with acks from every replica, one request at a time and no topic creation", async () => {
    const { producer, factory, kafka } = client();
    const publisher = kafkaPublisher(kafka);
    await publisher.publish(TOPIC, [{ key: "k", value: "v", headers: {} }]);
    await publisher.publish(TOPIC, [{ key: "k2", value: "v2", headers: {} }]);

    expect(factory).toHaveBeenCalledWith(expect.objectContaining({ allowAutoTopicCreation: false, maxInFlightRequests: 1 }));
    expect(producer.connect).toHaveBeenCalledOnce();
    expect(producer.send).toHaveBeenCalledTimes(2);
    expect(producer.send).toHaveBeenCalledWith({ topic: TOPIC, messages: [{ key: "k", value: "v", headers: {} }], acks: -1 });
    await publisher.disconnect();
    expect(producer.disconnect).toHaveBeenCalledOnce();
  });

  it("tries to connect again after a failed connection, and disconnects nothing it never connected", async () => {
    const { producer, kafka } = client();
    producer.connect.mockRejectedValueOnce(new Error("no broker"));
    const publisher = kafkaPublisher(kafka);
    await expect(publisher.publish(TOPIC, [])).rejects.toThrow("no broker");
    await publisher.publish(TOPIC, []);
    expect(producer.connect).toHaveBeenCalledTimes(2);

    const idle = client();
    await kafkaPublisher(idle.kafka).disconnect();
    expect(idle.producer.disconnect).not.toHaveBeenCalled();
  });
});

describe("writeRegistrationOutbox", () => {
  const message = {
    messageType: "registration.withdrawn" as const,
    subjectId: "11111111-1111-4111-8111-111111111111",
    actor: { userId: "00000000-0000-0000-0000-000000000005", role: "ATTENDEE" as const },
    data: {
      registrationId: "11111111-1111-4111-8111-111111111111",
      registrationReference: "REG-000042",
      eventId: "22222222-2222-4222-8222-222222222222",
      eventReference: "EVT-000123",
      eventName: "R Test Symposium",
      attendeeId: "00000000-0000-0000-0000-000000000005",
      registeredAt: "2026-12-01T02:00:00.000Z",
      withdrawnAt: "2026-12-03T02:00:00.000Z",
    },
  };

  it("stores a validated CloudEvent keyed by its subject on the registration topic, with the correlation id when there is one", async () => {
    const sql = scriptedSql([{ match: /insert into registration\.outbox/ }]);
    const id = await writeRegistrationOutbox(sql, { ...message, correlationId: "corr-1" });
    const [topic, key, envelope] = sql.calls[0]!.values as [string, string, Record<string, unknown>];
    expect(topic).toBe(TOPIC);
    expect(key).toBe(message.subjectId);
    expect(envelope).toMatchObject({ id, type: "registration.withdrawn", subject: message.subjectId, source: "/connectsphere/registration", correlationid: "corr-1" });
    expect(envelope.actor).toBe("ATTENDEE:00000000-0000-0000-0000-000000000005");
    expect(String(envelope.traceparent)).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
  });

  it("leaves out the correlation id when there is none", async () => {
    const sql = scriptedSql([{ match: /insert into registration\.outbox/ }]);
    await writeRegistrationOutbox(sql, { ...message, correlationId: null });
    expect(sql.calls[0]!.values[2]).not.toHaveProperty("correlationid");
  });

  it("refuses to store a message whose data does not match its type, writing nothing", async () => {
    const sql = scriptedSql([{ match: /insert/ }]);
    await expect(writeRegistrationOutbox(sql, { ...message, correlationId: null, data: { registrationId: "x" } })).rejects.toThrow();
    expect(sql.calls).toHaveLength(0);
  });

  it("makes a fresh, valid traceparent when no span is active", () => {
    expect(newTraceparent()).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
    expect(newTraceparent()).not.toBe(newTraceparent());
  });
});
