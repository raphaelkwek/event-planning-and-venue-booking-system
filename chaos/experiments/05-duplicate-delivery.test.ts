import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Sql } from "postgres";
import { KAFKA_TOPICS } from "@connectsphere/contracts";
import { OutboxRelay, kafkaPublisher } from "../../backend/services/registration/src/outbox/relay.js";
import { REGISTRATION_OUTBOX_TABLE } from "../../backend/services/registration/src/outbox/write.js";
import { register } from "../../backend/services/registration/src/service/register.js";
import { startConsumers as startRegistrationConsumers, type RunningConsumers } from "../../backend/services/registration/src/consumer/run.js";
import { consumerGroup as registrationGroup } from "../../backend/services/registration/src/consumer/kafkaMessages.js";
import { startConsumers as startNotificationConsumers } from "../../backend/services/notification/src/consumer/run.js";
import { consumerGroup as notificationGroup } from "../../backend/services/notification/src/consumer/kafkaMessages.js";
import { anEvent, approvalMessage, listingMessage } from "../../backend/services/registration/tests/support/fixtures.js";
import { createProxy, sleep, toxiproxyIsUp, waitFor, type Proxy } from "../support/toxiproxy.js";
import {
  DIRECT,
  PROXY_LISTEN,
  PROXY_UPSTREAM,
  VIA_PROXY,
  client,
  createTopics,
  endOffset,
  produce,
  readAll,
  waitForGroupsCaughtUp,
  waitForGroupsStable,
} from "../support/kafka.js";
import { connect } from "../../load/support/seed.js";
import { REPO_ROOT } from "../../load/support/stack.js";

/**
 * EN-20 experiment 5: duplicate delivery is harmless.
 *
 * Hypothesis: delivering a message again, however many times and whatever the cause, changes nothing.
 * The registration service's seat builder builds an event's seats once however often its approval
 * arrives, and the notification service stores one notification per registration however often the
 * registration message arrives (the inbox, ADR-0008).
 *
 * Both services' real consumers run against Redpanda, reaching it only through Toxiproxy. The messages go
 * through once. Toxiproxy then resets every connection (so the consumers rebuild their sessions and any
 * message not yet committed would be delivered again), and then every topic is replayed from its first
 * message, twice: each message is on the topic three times.
 */

const DATABASE_URL = process.env.DATABASE_URL!;
const ATTENDEES = 20;
const SEATS = 20;
const REPLAYS = 2;
const OUT = join(REPO_ROOT, "chaos/out");
const suffix = `chaos5-${Date.now()}`;

const WATCHED = [
  { groupId: registrationGroup("seat-builder", suffix), topic: KAFKA_TOPICS.venueBooking },
  { groupId: registrationGroup("event-listings", suffix), topic: KAFKA_TOPICS.event },
  { groupId: notificationGroup("event-notifier", suffix), topic: KAFKA_TOPICS.registration },
  { groupId: notificationGroup("event-notifier", suffix), topic: KAFKA_TOPICS.event },
  { groupId: notificationGroup("event-notifier", suffix), topic: KAFKA_TOPICS.venueBooking },
];
const REPLAYED_TOPICS = [KAFKA_TOPICS.event, KAFKA_TOPICS.venueBooking, KAFKA_TOPICS.registration];
const GROUP_IDS = [...new Set(WATCHED.map((w) => w.groupId)), notificationGroup("retry-worker", suffix)];

let sql: Sql;
let proxy: Proxy;
let relay: OutboxRelay;
let publisher: ReturnType<typeof kafkaPublisher>;
let registrationConsumers: RunningConsumers;
let notificationConsumers: RunningConsumers;
const admin = client(DIRECT, "chaos-admin-5").admin();

beforeAll(async () => {
  expect(await toxiproxyIsUp(), "Toxiproxy must be running").toBe(true);
  mkdirSync(OUT, { recursive: true });
  sql = connect(DATABASE_URL);
  proxy = await createProxy("kafka", PROXY_LISTEN, PROXY_UPSTREAM);
  await createTopics();
  await admin.connect();
  await sql`update registration.outbox set published_at = now() where published_at is null`;
  publisher = kafkaPublisher(client(VIA_PROXY, "registration-relay"));
  relay = new OutboxRelay({ sql, table: REGISTRATION_OUTBOX_TABLE, publisher, idleMs: 250 });
  registrationConsumers = await startRegistrationConsumers(client(VIA_PROXY, "registration"), sql, suffix);
  notificationConsumers = await startNotificationConsumers(client(VIA_PROXY, "notification"), sql, suffix);
  await waitForGroupsStable(admin, GROUP_IDS);
  relay.start();
});

afterAll(async () => {
  await relay?.stop();
  await publisher?.disconnect();
  await registrationConsumers?.stop();
  await notificationConsumers?.stop();
  await admin.disconnect();
  await sql?.end({ timeout: 5 });
  await proxy?.remove();
});

const seatsOf = async (eventId: string) =>
  (await sql<{ n: number; free: number }[]>`select count(*)::int as n, count(*) filter (where status = 'FREE')::int as free from registration.seats where event_id = ${eventId}`)[0]!;
const notificationsOf = async (eventId: string) =>
  (await sql<{ n: number; messages: number }[]>`select count(*)::int as n, count(distinct source_message_id)::int as messages from notification.notifications where event_id = ${eventId}`)[0]!;
const inboxOf = async (messageIds: string[]) =>
  (await sql<{ registration: number; notification: number }[]>`
    select (select count(*)::int from registration.consumed_messages where message_id in ${sql(messageIds)}) as registration,
           (select count(*)::int from notification.consumed_messages where message_id in ${sql(messageIds)}) as notification`)[0]!;

describe("Experiment 5: duplicate delivery is harmless", () => {
  it("replaying every topic twice, after a connection reset, builds no extra seats and sends no extra notifications (EN-20-T5)", async () => {
    // Event B reaches the seat builder as messages on Kafka: a listing, then an approval of a 20-seat venue.
    const eventB = randomUUID();
    const listing = listingMessage(eventB, `EVT-${900_000 + Math.floor(Math.random() * 99_999)}`, {
      opensAt: new Date(Date.now() - 3_600_000).toISOString(),
      closesAt: new Date(Date.now() + 86_400_000).toISOString(),
    });
    const approval = approvalMessage(eventB, { seats: SEATS });
    // Event A is registered for directly; the relay publishes its 20 confirmations.
    const eventA = await anEvent(sql, { seats: ATTENDEES, opensAt: new Date(Date.now() - 3_600_000).toISOString(), closesAt: new Date(Date.now() + 86_400_000).toISOString() });

    await produce(VIA_PROXY, KAFKA_TOPICS.event, [{ key: eventB, value: listing, headers: {} }]);
    await produce(VIA_PROXY, KAFKA_TOPICS.venueBooking, [{ key: eventB, value: approval.value, headers: {} }]);
    for (let i = 0; i < ATTENDEES; i++) {
      const outcome = await register(sql, { eventId: eventA.eventId, attendeeId: randomUUID(), now: new Date(), correlationId: null });
      expect(outcome.ok).toBe(true);
    }

    await waitFor("event B's 20 seats and event A's 20 notifications", async () => (await seatsOf(eventB)).n === SEATS && (await notificationsOf(eventA.eventId)).n === ATTENDEES, 120_000, 500);
    await waitForGroupsCaughtUp(admin, WATCHED);

    const before = { seatsB: await seatsOf(eventB), notificationsA: await notificationsOf(eventA.eventId) };
    const messageIds = [
      (JSON.parse(approval.value) as { id: string }).id,
      (JSON.parse(listing) as { id: string }).id,
      ...(await readAll(KAFKA_TOPICS.registration)).map((m) => (JSON.parse(m.value) as { id: string }).id),
    ];
    const inboxBefore = await inboxOf(messageIds);
    const endBefore = await Promise.all(REPLAYED_TOPICS.map((t) => endOffset(admin, t)));

    // A connection reset under the consumers, then the whole of every topic delivered again, twice.
    await proxy.addToxic({ name: "reset", type: "reset_peer", attributes: { timeout: 0 } });
    await sleep(3000);
    await proxy.removeToxic("reset");
    let replayed = 0;
    for (const topic of REPLAYED_TOPICS) {
      const originals = await readAll(topic); // read once, so each round delivers the originals again, not the earlier replays
      for (let round = 0; round < REPLAYS; round++) {
        await produce(VIA_PROXY, topic, originals);
        replayed += originals.length;
      }
    }
    await waitForGroupsStable(admin, GROUP_IDS, 120_000);
    await waitForGroupsCaughtUp(admin, WATCHED, 120_000);
    await sleep(2000);

    const endAfter = await Promise.all(REPLAYED_TOPICS.map((t) => endOffset(admin, t)));
    const after = { seatsB: await seatsOf(eventB), notificationsA: await notificationsOf(eventA.eventId) };
    const inboxAfter = await inboxOf(messageIds);
    const result = { experiment: 5, replayRounds: REPLAYS, messagesReplayed: replayed, topicEndOffsets: { before: endBefore, after: endAfter }, before, after, inbox: { before: inboxBefore, after: inboxAfter } };
    writeFileSync(join(OUT, "05-duplicate-delivery.json"), JSON.stringify(result, null, 2));
    console.log(`experiment 5: ${JSON.stringify(result)}`);

    endAfter.forEach((end, i) => expect(end, "each topic really did carry every message three times").toBe(endBefore[i]! * (1 + REPLAYS)));
    expect(after.seatsB.n, "the approval, delivered three times, built the seats once").toBe(SEATS);
    expect(after.seatsB.free).toBe(SEATS);
    expect(after.notificationsA.n, "one notification per registration").toBe(ATTENDEES);
    expect(after.notificationsA.messages).toBe(ATTENDEES);
    expect(inboxAfter, "the inboxes hold each message id once").toEqual(inboxBefore);
  });
});
