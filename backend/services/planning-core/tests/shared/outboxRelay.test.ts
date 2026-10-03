import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { parseCloudEvent } from "@connectsphere/contracts";
import { testDb } from "../support/testDb.js";
import { OutboxRelay, type OutboxPublisher } from "../../src/shared/outbox-relay.js";

/**
 * EN-04.2 done-checks, against real Postgres: two relays publish each row
 * exactly once, and a broker outage leaves rows pending until it recovers.
 *
 * The relay is pointed at throwaway outbox tables created for this run, never
 * at event.outbox: a teammate's relay running against the shared database
 * would otherwise take these rows, and these tests would take theirs.
 */

const sql = testDb();
const suffix = randomUUID().slice(0, 8);
const TABLE = `public.relay_test_outbox_${suffix}`;
const SECOND_TABLE = `public.relay_test_outbox_${suffix}_b`;

async function createOutbox(table: string) {
  await sql.unsafe(`
    create table ${table} (
      id           uuid primary key default gen_random_uuid(),
      seq          bigint generated always as identity,
      topic        text        not null,
      message_key  text        not null,
      envelope     jsonb       not null,
      created_at   timestamptz not null default now(),
      published_at timestamptz,
      attempts     int         not null default 0,
      last_error   text
    )`);
}

beforeAll(async () => {
  await createOutbox(TABLE);
  await createOutbox(SECOND_TABLE);
});

beforeEach(async () => {
  await sql.unsafe(`truncate ${TABLE}, ${SECOND_TABLE}`);
});

afterAll(async () => {
  await sql.unsafe(`drop table if exists ${TABLE}, ${SECOND_TABLE}`);
  await sql.end();
});

const coordinator = "00000000-0000-0000-0000-000000000002";

function approvedEvent(eventId: string) {
  return {
    specversion: "1.0",
    id: randomUUID(),
    source: "/connectsphere/planning-core/event",
    type: "event.approved",
    subject: eventId,
    time: new Date().toISOString(),
    datacontenttype: "application/json",
    traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
    actor: `EVENT_COORDINATOR:${coordinator}`,
    data: {
      eventId,
      eventReference: "EVT-TEST",
      eventName: "Relay test",
      ownerId: "00000000-0000-0000-0000-000000000001",
      approvedBy: coordinator,
      approvedAt: new Date().toISOString(),
    },
  };
}

/** Inserts messages one by one, so their outbox order is the order written. Returns their ids per aggregate. */
async function seed(table: string, aggregates: number, perAggregate: number) {
  const ids = Array.from({ length: aggregates }, () => randomUUID());
  const written = new Map<string, string[]>(ids.map((id) => [id, []]));
  for (let i = 0; i < perAggregate; i++) {
    for (const aggregateId of ids) {
      const event = approvedEvent(aggregateId);
      await sql.unsafe(`insert into ${table} (topic, message_key, envelope) values ($1, $2, $3)`, [
        "connectsphere.event.v1",
        aggregateId,
        sql.json(event) as never,
      ]);
      written.get(aggregateId)!.push(event.id);
    }
  }
  return written;
}

interface Sent {
  topic: string;
  key: string;
  value: string;
  headers: Record<string, string>;
}

/** Records what it is asked to send. `down` makes it fail the way kafkajs does when no broker answers. */
function recordingPublisher(sent: Sent[], options: { delayMs?: number } = {}) {
  const publisher = {
    down: false,
    calls: 0,
    async publish(topic: string, messages: Omit<Sent, "topic">[]) {
      publisher.calls += 1;
      if (options.delayMs) await new Promise((resolve) => setTimeout(resolve, options.delayMs));
      if (publisher.down) throw new Error("KafkaJSConnectionError: Connection error: connect ECONNREFUSED");
      sent.push(...messages.map((m) => ({ topic, ...m })));
    },
  } satisfies OutboxPublisher & Record<string, unknown>;
  return publisher;
}

async function pending(table: string) {
  const [row] = await sql.unsafe(`select count(*)::int as n from ${table} where published_at is null`);
  return row!.n as number;
}

async function rows(table: string) {
  return sql.unsafe(`select message_key, published_at, attempts, last_error from ${table} order by seq`);
}

describe("two relays running at once", () => {
  it("publish every row exactly once, and each aggregate's messages in the order they were written", async () => {
    const written = await seed(TABLE, 5, 40);
    const sent: Sent[] = [];
    const dbA = testDb();
    const dbB = testDb();

    // Relay A takes the first batch and is still publishing it while relay B
    // runs. A waits until B has published something, or half a second passes.
    // If B could take the next batch meanwhile, it would publish later
    // messages of the same events before A's earlier ones.
    let aHolding!: () => void;
    const aIsHolding = new Promise<void>((resolve) => (aHolding = resolve));
    let bPublished!: () => void;
    const bHasPublished = new Promise<void>((resolve) => (bPublished = resolve));
    const publisherA: OutboxPublisher = {
      async publish(topic, messages) {
        aHolding();
        await Promise.race([bHasPublished, new Promise((resolve) => setTimeout(resolve, 500))]);
        sent.push(...messages.map((m) => ({ topic, ...m })));
      },
    };
    const publisherB: OutboxPublisher = {
      async publish(topic, messages) {
        sent.push(...messages.map((m) => ({ topic, ...m })));
        bPublished();
      },
    };
    const relayA = new OutboxRelay({ sql: dbA, tables: [TABLE], publisher: publisherA });
    const relayB = new OutboxRelay({ sql: dbB, tables: [TABLE], publisher: publisherB });

    let bFoundTableBusy = 0;
    const drain = async (relay: OutboxRelay, onPass: (busy: number) => void = () => undefined) => {
      for (let pass = 0; pass < 200 && (await pending(TABLE)) > 0; pass++) onPass((await relay.runOnce()).busy);
    };
    const firstPassOfA = relayA.runOnce();
    await aIsHolding;
    await Promise.all([
      firstPassOfA.then(() => drain(relayA)),
      drain(relayB, (busy) => (bFoundTableBusy += busy)),
    ]);
    await Promise.all([dbA.end(), dbB.end()]);

    const sentIds = sent.map((m) => JSON.parse(m.value).id as string);
    expect(sentIds).toHaveLength(200);
    expect(new Set(sentIds).size).toBe(200);
    for (const [aggregateId, ids] of written) {
      const order = sent.filter((m) => m.key === aggregateId).map((m) => JSON.parse(m.value).id);
      expect(order).toEqual(ids);
    }
    expect(await pending(TABLE)).toBe(0);
    // The scenario happened: B ran while A held the table.
    expect(bFoundTableBusy).toBeGreaterThan(0);
  });
});

describe("when the broker is down", () => {
  it("leaves every row pending, counting the attempt and recording the error", async () => {
    await seed(TABLE, 1, 3);
    const publisher = recordingPublisher([]);
    publisher.down = true;
    const relay = new OutboxRelay({ sql, tables: [TABLE], publisher });

    const result = await relay.runOnce();

    expect(result).toMatchObject({ published: 0, failed: 3 });
    for (const row of await rows(TABLE)) {
      expect(row.published_at).toBeNull();
      expect(row.attempts).toBe(1);
      expect(row.last_error).toContain("ECONNREFUSED");
    }
  });

  it("publishes the waiting rows, once each, after the broker recovers", async () => {
    const written = await seed(TABLE, 1, 3);
    const sent: Sent[] = [];
    const publisher = recordingPublisher(sent);
    const relay = new OutboxRelay({ sql, tables: [TABLE], publisher });

    publisher.down = true;
    await relay.runOnce();
    await relay.runOnce();
    publisher.down = false;
    const result = await relay.runOnce();

    expect(result).toMatchObject({ published: 3, failed: 0 });
    expect(sent.map((m) => JSON.parse(m.value).id)).toEqual([...written.values()][0]);
    for (const row of await rows(TABLE)) {
      expect(row.published_at).not.toBeNull();
      expect(row.attempts).toBe(2);
    }
    expect(await relay.runOnce()).toMatchObject({ published: 0 });
  });
});

describe("rows the relay can never publish", () => {
  it("are set aside, without holding up the rows behind them", async () => {
    await sql.unsafe(`insert into ${TABLE} (topic, message_key, envelope) values ($1, $2, $3)`, [
      "connectsphere.event.v1",
      randomUUID(),
      sql.json({ not: "a message" }) as never,
    ]);
    await seed(TABLE, 1, 2);
    const sent: Sent[] = [];
    const relay = new OutboxRelay({ sql, tables: [TABLE], publisher: recordingPublisher(sent) });

    expect(await relay.runOnce()).toMatchObject({ published: 2, parked: 1 });
    expect(await relay.runOnce()).toMatchObject({ published: 0, parked: 0 });

    const [bad] = await rows(TABLE);
    expect(bad!.published_at).toBeNull();
    expect(bad!.attempts).toBe(1);
    expect(bad!.last_error).toMatch(/^unpublishable: /);
    expect(sent).toHaveLength(2);
  });
});

describe("what goes on the wire", () => {
  it("converts a row written before CloudEvents, under its old topic, into a CloudEvent on the aggregate's topic", async () => {
    const eventId = randomUUID();
    const legacy = {
      messageId: randomUUID(),
      messageType: "event.coordinator-assigned",
      schemaVersion: 1,
      occurredAt: new Date().toISOString(),
      producer: "event-service",
      correlationId: null,
      causationId: null,
      actor: { userId: null, role: "SYSTEM" },
      aggregate: { type: "EVENT", id: eventId },
      payload: {
        eventId,
        eventReference: "EVT-TEST",
        eventName: "Relay test",
        coordinatorId: coordinator,
        assignmentRule: "ROUND_ROBIN",
        assignedAt: new Date().toISOString(),
      },
    };
    await sql.unsafe(`insert into ${TABLE} (topic, message_key, envelope) values ($1, $2, $3)`, [
      "connectsphere.event.coordinator-assigned.v1",
      eventId,
      sql.json(legacy) as never,
    ]);
    const sent: Sent[] = [];
    await new OutboxRelay({ sql, tables: [TABLE], publisher: recordingPublisher(sent) }).runOnce();

    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      topic: "connectsphere.event.v1",
      key: eventId,
      headers: { "content-type": "application/cloudevents+json; charset=UTF-8" },
    });
    const message = parseCloudEvent(JSON.parse(sent[0]!.value));
    expect(message).toMatchObject({ id: legacy.messageId, type: "event.coordinator-assigned", actor: "SYSTEM" });
  });

  it("polls every outbox it is given", async () => {
    await seed(TABLE, 1, 1);
    await seed(SECOND_TABLE, 1, 2);
    const sent: Sent[] = [];
    const result = await new OutboxRelay({
      sql,
      tables: [TABLE, SECOND_TABLE],
      publisher: recordingPublisher(sent),
    }).runOnce();
    expect(result.published).toBe(3);
  });
});

describe("shutting down", () => {
  it("finishes the batch it is publishing, then stops taking rows", async () => {
    await seed(TABLE, 1, 3);
    const sent: Sent[] = [];
    const publisher = recordingPublisher(sent, { delayMs: 300 });
    const relay = new OutboxRelay({ sql, tables: [TABLE], publisher, idleMs: 20 });

    relay.start();
    while (publisher.calls === 0) await new Promise((resolve) => setTimeout(resolve, 10));
    await relay.stop();

    expect(sent).toHaveLength(3);
    expect(await pending(TABLE)).toBe(0);

    await seed(TABLE, 1, 1);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(publisher.calls).toBe(1);
    expect(await pending(TABLE)).toBe(1);
  });
});
