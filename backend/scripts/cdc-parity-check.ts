#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import { deepStrictEqual } from "node:assert";
import { Kafka, logLevel } from "kafkajs";
import postgres from "postgres";
import { KAFKA_TOPICS, MESSAGE_DATA_SCHEMAS, parseCloudEvent, type MessageType } from "@connectsphere/contracts";
import { toJsonSchema } from "../packages/contracts/src/compat/snapshot.js";
import {
  instanceOf,
  MINIMAL_REFUSED_BY_A_REFINEMENT,
  type Variant,
} from "../packages/contracts/tests/helpers/schemaInstances.js";
import { prepareRow } from "../services/planning-core/src/shared/outbox/messages.js";
import { prepareRow as prepareRegistrationRow } from "../services/registration/src/outbox/messages.js";
import { newTraceparent } from "../services/planning-core/src/shared/tracing.js";

// EN-05 (SPM-123), CI only. Proves that Debezium Server with the outbox router
// (deploy/k8s/components/cdc) puts on Kafka exactly what the polling relay does.
//
// For one message of every type, in a full and a minimal shape (absent
// properties, nulls, empty arrays), it writes a CloudEvent to the outbox table
// of its module the way the module's writer does, reads what Debezium Server
// published, and compares it with `prepareRow`, the relay's own function:
// topic, key, JSON value and the content-type header. It then checks that
// messages about one event keep their order, and that updating a row (which the
// relay does to mark it published) publishes nothing.
//
// Only ever run against the throwaway Postgres and Redpanda CI starts on the
// runner (it refuses any other DATABASE_URL).

const databaseUrl = process.env.DATABASE_URL ?? "";
if (!/^postgres:\/\/[^@]*@(127\.0\.0\.1|localhost):\d+\//.test(databaseUrl)) {
  console.error("DATABASE_URL must point at the runner's own Postgres. This check never touches a shared database.");
  process.exit(2);
}
const brokers = (process.env.KAFKA_BROKERS ?? "127.0.0.1:9092").split(",");
const healthUrl = process.env.DEBEZIUM_HEALTH_URL ?? "http://127.0.0.1:8089/q/health";
const SLOT = "connectsphere_outbox";
const TIMEOUT_MS = 120_000;
const CONTENT_TYPE = "application/cloudevents+json; charset=UTF-8";

const MODULES = [
  { prefix: "event.", table: "event.outbox", topic: KAFKA_TOPICS.event, source: "/connectsphere/planning-core/event" },
  { prefix: "equipment-request.", table: "equipment.outbox", topic: KAFKA_TOPICS.equipmentRequest, source: "/connectsphere/planning-core/equipment" },
  { prefix: "change-request.", table: "change.outbox", topic: KAFKA_TOPICS.event, source: "/connectsphere/planning-core/change" },
  { prefix: "venue-booking.", table: "venue.outbox", topic: KAFKA_TOPICS.venueBooking, source: "/connectsphere/planning-core/venue" },
  // The registration service has its own outbox and its own relay (src/outbox/messages.ts), so its rows are compared with that one.
  { prefix: "registration.", table: "registration.outbox", topic: KAFKA_TOPICS.registration, source: "/connectsphere/registration" },
  // R5 to R7: the waitlist's messages are the registration service's too, in the same outbox and on the same topic.
  { prefix: "waitlist.", table: "registration.outbox", topic: KAFKA_TOPICS.registration, source: "/connectsphere/registration" },
] as const;

interface Expected {
  label: string;
  rowId: string;
  topic: string;
  key: string;
  value: unknown;
  eventId: string;
}

interface Received {
  topic: string;
  partition: number;
  offset: number;
  key: string;
  value: string;
  headers: Record<string, string>;
}

const sql = postgres(databaseUrl, { max: 2 });

/** The CloudEvent a module's writer would validate and store. */
function eventOf(type: MessageType, variant: Variant, source: string, subject: string) {
  const data = instanceOf(toJsonSchema(MESSAGE_DATA_SCHEMAS[type]), variant);
  return parseCloudEvent({
    specversion: "1.0",
    id: randomUUID(),
    source,
    type,
    subject,
    time: new Date().toISOString(),
    datacontenttype: "application/json",
    ...(variant === "full" ? { correlationid: randomUUID() } : {}),
    traceparent: newTraceparent(),
    actor: "SYSTEM",
    data,
  });
}

/** Inserts one outbox row in a transaction of its own, like a module does, and says what the relay would publish for it. */
async function writeRow(label: string, type: MessageType, variant: Variant, subject: string = randomUUID()): Promise<Expected> {
  const module = MODULES.find((candidate) => type.startsWith(candidate.prefix));
  if (!module) throw new Error(`No outbox module is known for ${type}`);
  const event = eventOf(type, variant, module.source, subject);
  const [row] = await sql.begin(
    (tx) => tx<{ id: string }[]>`
      insert into ${tx(module.table)} (topic, message_key, envelope)
      values (${module.topic}, ${subject}, ${tx.json(event as never)})
      returning id
    `,
  );
  const outboxRow = { id: row!.id, topic: module.topic, message_key: subject, envelope: event };
  const prepared = module.prefix === "registration." ? prepareRegistrationRow(outboxRow) : prepareRow(outboxRow, newTraceparent);
  return { label, rowId: row!.id, topic: module.topic, key: subject, value: JSON.parse(prepared.value), eventId: event.id };
}

async function waitFor(what: string, done: () => boolean | Promise<boolean>, timeoutMs = TIMEOUT_MS): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await done()) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${what}.`);
}

/** The header as a plain string: Debezium Server writes header values as JSON, so the text arrives in quotes. */
function plainHeader(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === "string" ? parsed : raw;
  } catch {
    return raw;
  }
}

async function main(): Promise<number> {
  const problems: string[] = [];
  let headerNoteShown = false;

  // Debezium creates its slot a moment after its health check passes; rows written before that are not captured.
  await waitFor(`replication slot ${SLOT} to be active`, async () => {
    const [slot] = await sql<{ active: boolean }[]>`select active from pg_replication_slots where slot_name = ${SLOT}`;
    return slot?.active === true;
  });
  try {
    const health = await fetch(healthUrl);
    console.log(`Debezium Server health: HTTP ${health.status} ${(await health.text()).replace(/\s+/g, " ").slice(0, 120)}`);
  } catch (error) {
    console.log(`Debezium Server health was not readable: ${(error as Error).message}`);
  }

  const kafka = new Kafka({ clientId: "cdc-parity-check", brokers, logLevel: logLevel.ERROR });
  const admin = kafka.admin();
  await admin.connect();
  const topics = [...new Set(MODULES.map((module) => module.topic))];
  await admin.createTopics({ topics: topics.map((topic) => ({ topic, numPartitions: 3 })) });
  await admin.disconnect();

  const received: Received[] = [];
  const consumer = kafka.consumer({ groupId: `cdc-parity-${Date.now()}` });
  await consumer.connect();
  await consumer.subscribe({ topics, fromBeginning: true });
  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      const headers: Record<string, string> = {};
      for (const [name, value] of Object.entries(message.headers ?? {})) headers[name] = Array.isArray(value) ? value.map(String).join(",") : String(value);
      received.push({ topic, partition, offset: Number(message.offset), key: String(message.key ?? ""), value: String(message.value ?? ""), headers });
    },
  });

  // 1. One message of every type, in each shape contracts accepts.
  const expected: Expected[] = [];
  for (const type of Object.keys(MESSAGE_DATA_SCHEMAS).sort() as MessageType[]) {
    for (const variant of ["full", "minimal"] as Variant[]) {
      if (variant === "minimal" && MINIMAL_REFUSED_BY_A_REFINEMENT.has(type)) continue;
      expected.push(await writeRow(`${type} (${variant})`, type, variant));
    }
  }

  // 2. Five messages about one event, to see their order kept.
  const orderedSubject = randomUUID();
  const ordered: Expected[] = [];
  for (let i = 0; i < 5; i += 1) ordered.push(await writeRow(`ordered #${i + 1}`, "event.status-changed", "full", orderedSubject));

  const all = [...expected, ...ordered];
  await waitFor(`${all.length} messages from Debezium Server`, () => received.length >= all.length);

  for (const want of all) {
    const got = received.filter((message) => {
      try {
        return (JSON.parse(message.value) as { id?: string }).id === want.eventId;
      } catch {
        return false;
      }
    });
    if (got.length !== 1) {
      problems.push(`${want.label}: expected 1 message, found ${got.length}`);
      continue;
    }
    const message = got[0]!;
    const differences: string[] = [];
    if (message.topic !== want.topic) differences.push(`topic ${message.topic} != ${want.topic}`);
    if (message.key !== want.key) differences.push(`key ${JSON.stringify(message.key)} != ${JSON.stringify(want.key)}`);
    if (message.headers["content-type"] !== undefined && message.headers["content-type"] !== CONTENT_TYPE && !headerNoteShown) {
      headerNoteShown = true;
      console.log(`note: the content-type header is ${message.headers["content-type"]}, JSON-encoded by Debezium Server; the relay sets the bare text.`);
    }
    if (plainHeader(message.headers["content-type"]) !== CONTENT_TYPE) {
      differences.push(`content-type header ${JSON.stringify(message.headers["content-type"])} != ${JSON.stringify(CONTENT_TYPE)}`);
    }
    try {
      deepStrictEqual(JSON.parse(message.value), want.value);
      parseCloudEvent(JSON.parse(message.value));
    } catch (error) {
      differences.push(`value differs or is not a valid CloudEvent: ${(error as Error).message.split("\n").slice(0, 6).join(" | ")}; got ${message.value.slice(0, 300)}`);
    }
    console.log(`${differences.length === 0 ? "same    " : "DIFFERS "} ${want.label}`);
    if (differences.length > 0) problems.push(`${want.label}: ${differences.join("; ")}`);
  }

  // 3. The five messages about one event arrive in the order they were written.
  const arrivals = received
    .filter((message) => message.key === orderedSubject)
    .sort((a, b) => a.partition - b.partition || a.offset - b.offset)
    .map((message) => (JSON.parse(message.value) as { id: string }).id);
  try {
    deepStrictEqual(arrivals, ordered.map((row) => row.eventId));
    console.log("same     messages about one event keep their order");
  } catch {
    problems.push("messages about one event did not arrive in the order they were written");
  }

  // 4. An update, which is what marks a row published, publishes nothing. A later message with the same key
  //    is on the same partition, so once it arrives an earlier one from the update would have too.
  const touched = expected[0]!;
  const touchedTable = MODULES.find((module) => module.topic === touched.topic && touched.label.startsWith(module.prefix))!.table;
  await sql`update ${sql(touchedTable)} set published_at = now(), attempts = attempts + 1 where id = ${touched.rowId}`;
  const sentinel = await writeRow("sentinel after an update", "event.status-changed", "full", touched.key);
  await waitFor("the message written after the update", () => received.some((message) => message.value.includes(sentinel.eventId)));
  const afterUpdate = received.filter((message) => message.value.includes(touched.eventId)).length;
  if (afterUpdate === 1 && received.length === all.length + 1) console.log("same     an update publishes nothing");
  else problems.push(`an update published something: ${afterUpdate} messages for the updated row, ${received.length} in all, expected ${all.length + 1}`);

  await consumer.disconnect();
  await sql.end();

  if (problems.length === 0) {
    console.log(`\nDebezium Server published ${all.length} messages identical to the relay's, in order.`);
    return 0;
  }
  console.error(`\n${problems.length} problem(s):`);
  for (const problem of problems) console.error(`  ${problem}`);
  return 1;
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (error: Error) => {
    console.error(error.message);
    // Exit now: the Kafka consumer and the Postgres pool are still open, and would keep the process
    // (and the CI job) waiting until its timeout instead of failing here.
    process.exit(2);
  },
);
