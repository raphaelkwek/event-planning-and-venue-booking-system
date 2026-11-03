import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { OutboxRelay, UNPUBLISHABLE_PREFIX, type OutboxPublisher } from "../../src/outbox/relay.js";

/**
 * The registration outbox relay (implementation.md §3.4), against real
 * Postgres: rows go out in write order, each once even with two relays, a
 * broker failure leaves them pending, and a row that can never publish is set
 * aside. It is pointed at a throwaway table with registration.outbox's shape,
 * never the real one, so a relay running elsewhere cannot take these rows.
 */

const sql = postgres(process.env.DATABASE_URL!, { max: 4, prepare: false });
const TABLE = `public.registration_relay_test_${randomUUID().slice(0, 8)}`;

beforeAll(async () => {
  await sql.unsafe(`
    create table ${TABLE} (
      id uuid primary key default gen_random_uuid(),
      seq bigint generated always as identity,
      topic text not null,
      message_key text not null,
      envelope jsonb not null,
      created_at timestamptz not null default now(),
      published_at timestamptz,
      attempts int not null default 0,
      last_error text
    )`);
});
beforeEach(() => sql.unsafe(`truncate ${TABLE}`));
afterAll(async () => {
  await sql.unsafe(`drop table if exists ${TABLE}`);
  await sql.end();
});

function withdrawn(registrationId: string) {
  return {
    specversion: "1.0",
    id: randomUUID(),
    source: "/connectsphere/registration",
    type: "registration.withdrawn",
    subject: registrationId,
    time: new Date().toISOString(),
    datacontenttype: "application/json",
    traceparent: "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01",
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
  };
}

async function insertRows(n: number, envelope = withdrawn) {
  const keys: string[] = [];
  for (let i = 0; i < n; i++) {
    const key = randomUUID();
    keys.push(key);
    // sql.json, not a JSON string: a string bound to jsonb is stored as a JSON string, which the relay rightly sets aside.
    await sql`insert into ${sql.unsafe(TABLE)} (topic, message_key, envelope) values (${"connectsphere.registration.v1"}, ${key}, ${sql.json(envelope(key) as never)})`;
  }
  return keys;
}

const recorder = () => {
  const sent: { topic: string; key: string }[] = [];
  const publisher: OutboxPublisher = {
    async publish(topic, messages) {
      for (const m of messages) sent.push({ topic, key: m.key });
    },
  };
  return { sent, publisher };
};

describe("OutboxRelay (registration)", () => {
  it("publishes the rows in write order, keyed by registration, and marks them published", async () => {
    const keys = await insertRows(3);
    const { sent, publisher } = recorder();

    expect(await new OutboxRelay({ sql, table: TABLE, publisher }).runOnce()).toEqual({ published: 3, failed: 0, parked: 0, busy: false });

    expect(sent).toEqual(keys.map((key) => ({ topic: "connectsphere.registration.v1", key })));
    const [pending] = await sql.unsafe(`select count(*)::int as n from ${TABLE} where published_at is null`);
    expect(pending!.n).toBe(0);
  });

  it("publishes each row once when two relays run at the same time", async () => {
    const keys = await insertRows(20);
    const { sent, publisher } = recorder();

    await Promise.all([new OutboxRelay({ sql, table: TABLE, publisher }).runOnce(), new OutboxRelay({ sql, table: TABLE, publisher }).runOnce()]);
    await new OutboxRelay({ sql, table: TABLE, publisher }).runOnce();

    expect(sent.map((s) => s.key).sort()).toEqual([...keys].sort());
  });

  it("leaves the rows pending, counting the attempt, when the broker fails, and sends them on the next pass", async () => {
    await insertRows(2);
    const failing: OutboxPublisher = {
      async publish() {
        throw new Error("broker unavailable");
      },
    };

    expect(await new OutboxRelay({ sql, table: TABLE, publisher: failing }).runOnce()).toMatchObject({ published: 0, failed: 2 });
    const rows = await sql.unsafe(`select attempts, last_error from ${TABLE} order by seq`);
    expect(rows.map((r) => [r.attempts, r.last_error])).toEqual([
      [1, "broker unavailable"],
      [1, "broker unavailable"],
    ]);
    expect(await new OutboxRelay({ sql, table: TABLE, publisher: recorder().publisher }).runOnce()).toMatchObject({ published: 2 });
  });

  it("sets aside a row that can never publish, so the rows behind it still go", async () => {
    await insertRows(1, (key) => ({ ...withdrawn(key), data: {} }) as never);
    await insertRows(1);
    const { sent, publisher } = recorder();

    expect(await new OutboxRelay({ sql, table: TABLE, publisher }).runOnce()).toMatchObject({ published: 1, parked: 1 });
    expect(await new OutboxRelay({ sql, table: TABLE, publisher }).runOnce()).toMatchObject({ published: 0, parked: 0 });
    expect(sent).toHaveLength(1);
    const [parked] = await sql.unsafe(`select last_error from ${TABLE} where published_at is null`);
    expect(parked!.last_error.startsWith(UNPUBLISHABLE_PREFIX)).toBe(true);
  });

  it("runs until stopped, finishing the pass in hand", async () => {
    await insertRows(2);
    const { sent, publisher } = recorder();
    const relay = new OutboxRelay({ sql, table: TABLE, publisher, idleMs: 10 });

    relay.start();
    relay.start();
    for (let i = 0; i < 100 && sent.length < 2; i++) await new Promise((r) => setTimeout(r, 20));
    await relay.stop();

    expect(sent).toHaveLength(2);
  });
});
