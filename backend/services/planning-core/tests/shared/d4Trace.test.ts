import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { SpanKind } from "@opentelemetry/api";
import type { ReadableSpan } from "@opentelemetry/sdk-trace-base";
import { instrumentSql, parentIdOf, startInMemoryTelemetry } from "@connectsphere/telemetry";

/**
 * EN-08-T11: one approval (D4, POST /api/v1/events/:id/approve) is one trace, from the HTTP request to
 * the notification it raises: server span, the transaction and its queries, the outbox relay's publish,
 * the notification service's consume and the queries it makes. Real Postgres (CI's throwaway one);
 * Kafka alone is a stand-in, because the relay hands its messages to a publisher this test supplies.
 *
 * The SDK starts first, with in-memory exporters, because the HTTP instrumentation patches `http` as it loads.
 */
const t = startInMemoryTelemetry("planning-core-it");

const { testDb } = await import("../support/testDb.js");
const { assignForTest } = await import("../support/assignment.js");
const { EVENT_END, EVENT_START } = await import("../support/eventDates.js");
const { default: request } = await import("supertest");

vi.mock("../../src/shared/auth/verifyJwt.js", () => ({
  verifyJwt: (
    req: { auth?: { supabaseUserId?: string }; header(name: string): string | undefined },
    _res: unknown,
    next: () => void
  ) => {
    req.auth = { supabaseUserId: "test-subject" };
    next();
  },
}));

vi.mock("../../src/modules/event/auth/identity.js", async () => {
  const actual = await vi.importActual<typeof import("../../src/modules/event/auth/identity.js")>(
    "../../src/modules/event/auth/identity.js"
  );
  return { ...actual, resolveCurrentUser: vi.fn(), resolveEventsScope: vi.fn() };
});

const { resolveCurrentUser, resolveEventsScope } = await import("../../src/modules/event/auth/identity.js");
const { app } = await import("../../src/app.js");
const { OutboxRelay } = await import("../../src/shared/outbox-relay.js");
const { consumeTraced } = await import("../../../notification/src/consumer/consumeTraced.js");

const sql = testDb();
// The notification service's own connection, traced as its db.ts would.
const notificationSql = instrumentSql(testDb());

const ORGANISER = "a8888888-0000-0000-0000-000000000001";
const COORDINATOR = "a8888888-0000-0000-0000-000000000002";
const POOL_COORDINATOR = "a8888888-0000-0000-0000-00000000000a";
const bearer = { Authorization: "Bearer test-token" };
const RELAY_TABLE = `public.d4_trace_outbox_${randomUUID().slice(0, 8)}`;

function signedInAs(userId: string, role: string) {
  vi.mocked(resolveCurrentUser).mockResolvedValue({ id: userId, email: "user@connectsphere.test", role: role as never });
  vi.mocked(resolveEventsScope).mockResolvedValue(
    role === "EVENT_COORDINATOR" ? { scopeType: "ALL" } : { scopeType: "OWNED_BY_USER", userId }
  );
}

async function cleanUp() {
  const ids = (await sql<Array<{ id: string }>>`select id from event.events where owner_id = ${ORGANISER}`).map((row) => row.id);
  await sql`delete from notification.notifications where recipient_user_id = ${ORGANISER}`;
  if (ids.length > 0) {
    await sql`delete from notification.consumed_messages where message_id in (
      select (envelope->>'id')::uuid from event.outbox where message_key in ${sql(ids)})`;
    await sql`delete from event.clarifications where event_id in ${sql(ids)}`;
    await sql`delete from event.event_history where event_id in ${sql(ids)}`;
    await sql`delete from event.assignments where event_id in ${sql(ids)}`;
    await sql`delete from event.outbox where message_key in ${sql(ids)}`;
  }
  await sql`delete from event.events where owner_id = ${ORGANISER}`;
}

beforeAll(async () => {
  await cleanUp();
  await sql.unsafe(`
    create table ${RELAY_TABLE} (
      id uuid primary key default gen_random_uuid(), seq bigint generated always as identity,
      topic text not null, message_key text not null, envelope jsonb not null,
      created_at timestamptz not null default now(), published_at timestamptz,
      attempts int not null default 0, last_error text)`);
});

afterAll(async () => {
  await cleanUp();
  await sql.unsafe(`drop table if exists ${RELAY_TABLE}`);
  await sql.end();
  await notificationSql.end();
  await t.telemetry.shutdown();
});

async function givenEventUnderReview() {
  signedInAs(ORGANISER, "EVENT_ORGANISER");
  const created = await request(app)
    .post("/api/v1/events")
    .set(bearer)
    .send({
      name: "Annual Research Symposium",
      purpose: "Share faculty research",
      description: "A one-day symposium.",
      proposedStartAt: EVENT_START,
      proposedEndAt: EVENT_END,
      expectedAttendance: 150,
      registrationRequired: false,
      equipmentRequired: false,
    });
  await assignForTest(sql, created.body, POOL_COORDINATOR);
  signedInAs(COORDINATOR, "EVENT_COORDINATOR");
  await request(app).get(`/api/v1/events/${created.body.id}`).set(bearer);
  return created.body as { id: string };
}

/** The spans below `root`, depth first, each as its name indented by its depth. */
function tree(spans: ReadableSpan[], root: ReadableSpan): string[] {
  const children = (parent: ReadableSpan) =>
    spans
      .filter((s) => parentIdOf(s) === parent.spanContext().spanId)
      .sort((a, b) => a.startTime[0] - b.startTime[0] || a.startTime[1] - b.startTime[1]);
  const lines: string[] = [];
  const visit = (span: ReadableSpan, depth: number) => {
    lines.push(`${"  ".repeat(depth)}${span.name}`);
    children(span).forEach((child) => visit(child, depth + 1));
  };
  visit(root, 0);
  return lines;
}

describe("one approval is one trace (D4)", () => {
  it("EN-08-T11 runs from the HTTP request, through the transaction and the outbox relay, into the notification consumer", async () => {
    const event = await givenEventUnderReview();
    t.spans.reset();
    const logged: Array<Record<string, unknown>> = [];
    const log = vi.spyOn(console, "log").mockImplementation((line: string) => {
      try {
        logged.push(JSON.parse(line));
      } catch {
        // Not one of ours.
      }
    });

    // 1. The approval.
    const res = await request(app).post(`/api/v1/events/${event.id}/approve`).set(bearer).send();
    // The "request completed" line is written when the response finishes, which can be just after supertest returns.
    await new Promise((resolve) => setTimeout(resolve, 50));
    log.mockRestore();
    expect(res.status).toBe(200);

    const [server] = t.finished().filter((s) => s.kind === SpanKind.SERVER && s.name === "POST /api/v1/events/:id/approve");
    expect(server).toBeDefined();
    const traceId = server!.spanContext().traceId;
    expect(server!.attributes["http.route"]).toBe("/api/v1/events/:id/approve");

    // T6: the correlation id is the trace id, on the response, in the log and in the message.
    expect(res.headers["x-correlation-id"]).toBe(traceId);
    expect(logged.find((l) => l.message === "request completed")).toMatchObject({ traceId, correlationId: traceId, outcome: "success" });

    const [transaction] = t.byName("db.transaction").filter((s) => parentIdOf(s) === server!.spanContext().spanId);
    expect(transaction).toBeDefined();
    const insideTransaction = t.finished().filter((s) => parentIdOf(s) === transaction!.spanContext().spanId).map((s) => s.name);
    expect(insideTransaction).toEqual(expect.arrayContaining(["INSERT event.event_history", "INSERT event.outbox"]));

    const [row] = await sql<Array<{ topic: string; message_key: string; envelope: Record<string, unknown> }>>`
      select topic, message_key, envelope from event.outbox
      where message_key = ${event.id} and envelope->>'type' = 'event.approved'`;
    expect(row!.envelope.correlationid).toBe(traceId);
    expect(row!.envelope.traceparent).toBe(`00-${traceId}-${transaction!.spanContext().spanId}-01`);

    // 2. The outbox relay publishes the row. It reads a copy of it, in a table of this test's own.
    await sql`
      insert into ${sql(RELAY_TABLE)} (topic, message_key, envelope)
      select topic, message_key, envelope from event.outbox
      where message_key = ${event.id} and envelope->>'type' = 'event.approved'`;
    const sent: Array<{ topic: string; key: string; value: string; headers: Record<string, string> }> = [];
    const relay = new OutboxRelay({
      sql,
      tables: [RELAY_TABLE],
      publisher: {
        async publish(topic, messages) {
          for (const message of messages) sent.push({ topic, ...message });
        },
      },
    });
    expect((await relay.runOnce()).published).toBe(1);

    const [producer] = t.byName(/ publish$/);
    expect(producer!.kind).toBe(SpanKind.PRODUCER);
    expect(parentIdOf(producer!)).toBe(transaction!.spanContext().spanId);
    expect(producer!.spanContext().traceId).toBe(traceId);
    expect(sent[0]!.headers.traceparent).toBe(`00-${traceId}-${producer!.spanContext().spanId}-01`);

    // 3. The notification service consumes it, with the header as Kafka delivers it.
    const outcome = await consumeTraced(
      {
        topic: sent[0]!.topic,
        partition: 0,
        group: "connectsphere.notification.event-notifier",
        message: {
          key: Buffer.from(sent[0]!.key),
          value: Buffer.from(sent[0]!.value),
          headers: Object.fromEntries(Object.entries(sent[0]!.headers).map(([name, value]) => [name, Buffer.from(value)])),
          offset: "1",
          timestamp: String(Date.now()),
        },
      },
      { sql: notificationSql, publish: async () => undefined },
    );
    expect(outcome).toEqual({ outcome: "stored", notifications: 1 });

    const [consumer] = t.byName(/ process$/);
    expect(consumer!.kind).toBe(SpanKind.CONSUMER);
    expect(parentIdOf(consumer!)).toBe(producer!.spanContext().spanId);
    expect(consumer!.spanContext().traceId).toBe(traceId);

    // The whole tree, one trace.
    const inTrace = t.finished().filter((s) => s.spanContext().traceId === traceId);
    const lines = tree(inTrace, server!);
    expect(lines[0]).toBe("POST /api/v1/events/:id/approve");
    expect(lines).toEqual(
      expect.arrayContaining([
        "  db.transaction",
        "    INSERT event.outbox",
        `    ${producer!.name}`,
        `      ${consumer!.name}`,
        "        db.transaction",
        "          INSERT notification.consumed_messages",
        "          INSERT notification.notifications",
      ]),
    );
    console.info(`The D4 trace (${traceId}):\n${lines.join("\n")}`);
  });
});
