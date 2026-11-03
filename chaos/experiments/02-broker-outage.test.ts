import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Sql } from "postgres";
import { KAFKA_TOPICS } from "@connectsphere/contracts";
import { OutboxRelay, kafkaPublisher } from "../../backend/services/registration/src/outbox/relay.js";
import { REGISTRATION_OUTBOX_TABLE } from "../../backend/services/registration/src/outbox/write.js";
import { register } from "../../backend/services/registration/src/service/register.js";
import { startConsumers, type RunningConsumers } from "../../backend/services/notification/src/consumer/run.js";
import { consumerGroup } from "../../backend/services/notification/src/consumer/kafkaMessages.js";
import { createProxy, sleep, timed, toxiproxyIsUp, waitFor, type Proxy } from "../support/toxiproxy.js";
import { DIRECT, PROXY_LISTEN, PROXY_UPSTREAM, VIA_PROXY, client, createTopics, readAll, waitForGroupsStable } from "../support/kafka.js";
import { connect, seedEvent } from "../../load/support/seed.js";
import { REPO_ROOT } from "../../load/support/stack.js";

/**
 * EN-20 experiment 2: a broker outage loses no notifications.
 *
 * Hypothesis: with Kafka unreachable, registrations still commit and their messages wait in the outbox;
 * when Kafka is back every message is published exactly once and the notification service stores exactly
 * one notification per registration.
 *
 * What runs is the real registration outbox relay (publisher included) and the real notification consumers,
 * both reaching a Redpanda broker only through Toxiproxy. The outage is the proxy switched off for
 * OUTAGE_MS: the design's 10 minutes is too long for a CI job, and the relay's backoff tops out at
 * 30 s, so a short outage exercises the same path (a failed send, a retry, a recovery).
 */

const DATABASE_URL = process.env.DATABASE_URL!;
const ATTENDEES = 50;
const OUTAGE_MS = 20_000;
const OUT = join(REPO_ROOT, "chaos/out");

const suffix = `chaos2-${Date.now()}`;
const GROUPS = [consumerGroup("event-notifier", suffix), consumerGroup("retry-worker", suffix)];

let sql: Sql;
let proxy: Proxy;
let relay: OutboxRelay;
let publisher: ReturnType<typeof kafkaPublisher>;
let consumers: RunningConsumers;
const admin = client(DIRECT, "chaos-admin-2").admin();

beforeAll(async () => {
  expect(await toxiproxyIsUp(), "Toxiproxy must be running").toBe(true);
  mkdirSync(OUT, { recursive: true });
  sql = connect(DATABASE_URL);
  proxy = await createProxy("kafka", PROXY_LISTEN, PROXY_UPSTREAM);
  await createTopics();
  await admin.connect();
  // Rows left in the outbox by other tests are not this experiment's to publish.
  await sql`update registration.outbox set published_at = now() where published_at is null`;
  publisher = kafkaPublisher(client(VIA_PROXY, "registration-relay"));
  relay = new OutboxRelay({ sql, table: REGISTRATION_OUTBOX_TABLE, publisher, idleMs: 250 });
  consumers = await startConsumers(client(VIA_PROXY, "notification"), sql, suffix);
  await waitForGroupsStable(admin, GROUPS);
  relay.start();
});

afterAll(async () => {
  await relay?.stop();
  await publisher?.disconnect();
  await consumers?.stop();
  await admin.disconnect();
  await sql?.end({ timeout: 5 });
  await proxy?.remove();
});

const pendingFor = (eventId: string) => sql<{ pending: number; retried: number; lastError: string | null }[]>`
  select count(*) filter (where published_at is null)::int as pending,
         count(*) filter (where attempts > 0 and published_at is null)::int as retried,
         max(last_error) as "lastError"
  from registration.outbox
  where message_key in (select id::text from registration.registrations where event_id = ${eventId})`;

const notificationsFor = async (eventId: string) =>
  (await sql<{ n: number; distinct: number }[]>`
    select count(*)::int as n, count(distinct source_message_id)::int as distinct
    from notification.notifications where event_id = ${eventId}`)[0]!;

describe("Experiment 2: a broker outage loses no notifications", () => {
  it("registrations commit during the outage, and after it every message is published and notified exactly once (EN-20-T2)", async () => {
    const event = await seedEvent(sql, ATTENDEES);

    await proxy.setEnabled(false);
    const outageStartedAt = Date.now();
    await sleep(500);

    // Writes during the outage.
    const attendees = Array.from({ length: ATTENDEES }, () => randomUUID());
    const outcomes = await Promise.all(attendees.map((attendeeId) => register(sql, { eventId: event.eventId, attendeeId, now: new Date(), correlationId: null })));
    expect(outcomes.every((o) => o.ok), "every registration committed with the broker down").toBe(true);

    await sleep(Math.max(0, OUTAGE_MS - (Date.now() - outageStartedAt)));
    const [during] = await pendingFor(event.eventId);
    expect(during!.pending, "every confirmation message is still waiting in the outbox").toBe(ATTENDEES);
    expect(during!.retried, "the relay tried and failed, rather than not trying").toBeGreaterThan(0);
    expect((await notificationsFor(event.eventId)).n, "nothing was notified while the broker was down").toBe(0);

    await proxy.setEnabled(true);
    const recoveredAt = Date.now();
    await waitFor("the outbox to drain", async () => (await pendingFor(event.eventId))[0]!.pending === 0, 120_000, 500);
    const drainSeconds = (Date.now() - recoveredAt) / 1000;

    const { ms: notifiedAfterMs } = await timed(() => waitFor(`${ATTENDEES} notifications`, async () => (await notificationsFor(event.eventId)).n >= ATTENDEES, 120_000, 500));
    await sleep(3000); // a duplicate, if there were one, would have landed by now
    const notifications = await notificationsFor(event.eventId);

    const registrationIds = new Set((await sql<{ id: string }[]>`select id from registration.registrations where event_id = ${event.eventId}`).map((r) => r.id));
    const onTopic = (await readAll(KAFKA_TOPICS.registration)).filter((m) => m.key !== null && registrationIds.has(m.key));
    const eventIds = onTopic.map((m) => (JSON.parse(m.value) as { id: string }).id);

    const result = {
      experiment: 2,
      attendees: ATTENDEES,
      outageSeconds: OUTAGE_MS / 1000,
      outbox: { pendingDuringOutage: during!.pending, rowsRetriedDuringOutage: during!.retried, lastErrorDuringOutage: during!.lastError },
      drainSecondsAfterRestore: drainSeconds,
      notifiedSecondsAfterDrain: notifiedAfterMs / 1000,
      messagesOnTopic: onTopic.length,
      distinctMessageIds: new Set(eventIds).size,
      notifications,
    };
    writeFileSync(join(OUT, "02-broker-outage.json"), JSON.stringify(result, null, 2));
    console.log(`experiment 2: ${JSON.stringify(result)}`);

    expect(onTopic.length, "each message published once").toBe(ATTENDEES);
    expect(new Set(eventIds).size, "no duplicate message ids on the topic").toBe(ATTENDEES);
    expect(notifications.n, "one notification per registration").toBe(ATTENDEES);
    expect(notifications.distinct, "each from a different message").toBe(ATTENDEES);
  });
});
