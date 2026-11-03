import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import request from "supertest";
import type { Sql } from "postgres";
import { app } from "../src/app.js";
import { handleMessage } from "../src/consumer/handleMessage.js";
import { metrics, recordVisibilityLag } from "../src/metrics.js";

/** EN-17: notification /metrics and the freshness histogram. */

/** A transaction stand-in: the inbox insert answers with a row only when the message is new. */
function fakeSql(isNew: boolean): Sql {
  const tx = (strings: TemplateStringsArray) =>
    Promise.resolve(strings.join("").includes("consumed_messages") && isNew ? [{ message_id: "m" }] : []);
  return { begin: (fn: (t: unknown) => Promise<unknown>) => fn(tx) } as unknown as Sql;
}

function approval(time: string) {
  const eventId = randomUUID();
  const event = {
    specversion: "1.0",
    id: randomUUID(),
    source: "/connectsphere/planning-core/event",
    type: "event.approved",
    subject: eventId,
    time,
    datacontenttype: "application/json",
    traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
    actor: "EVENT_COORDINATOR:00000000-0000-0000-0000-000000000002",
    data: {
      eventId,
      eventReference: "EVT-TEST-0001",
      eventName: "Freshness test",
      ownerId: randomUUID(),
      approvedBy: "00000000-0000-0000-0000-000000000002",
      approvedAt: time,
    },
  };
  return { topic: "connectsphere.event.v1", key: eventId, value: JSON.stringify(event), headers: {} };
}

async function lagTotals() {
  const hist = (await metrics.registry.getMetricsAsJSON()).find((m) => m.name === "notification_visibility_lag_seconds")!;
  const valueOf = (suffix: string) =>
    hist.values.find((v) => (v as { metricName?: string }).metricName === `notification_visibility_lag_seconds_${suffix}`)?.value ?? 0;
  return { sum: valueOf("sum"), count: valueOf("count") };
}

describe("notification metrics", () => {
  it("EN-17-T3 /metrics shows the HTTP metrics", async () => {
    await request(app).get("/healthz");
    const res = await request(app).get("/metrics");
    expect(res.status).toBe(200);
    expect(res.text).toContain('http_requests_total{method="GET",route="/healthz",status="2xx",service="notification"} 1');
  });

  it("EN-17-T6 a stored notification records its lag once, and a duplicate records nothing", async () => {
    const now = Date.parse("2026-11-02T10:00:03.000Z");
    const publish = async () => {};
    const before = await lagTotals();
    const stored = await handleMessage(approval("2026-11-02T10:00:00.000Z"), { sql: fakeSql(true), publish, now: () => now });
    expect(stored.outcome).toBe("stored");
    const afterStored = await lagTotals();
    expect(afterStored.count - before.count).toBe(1);
    expect(afterStored.sum - before.sum).toBeCloseTo(3, 5);

    const duplicate = await handleMessage(approval("2026-11-02T10:00:00.000Z"), { sql: fakeSql(false), publish, now: () => now });
    expect(duplicate.outcome).toBe("duplicate");
    expect((await lagTotals()).count).toBe(afterStored.count);
  });

  it("a producer clock ahead of ours counts as 0, not a negative lag", async () => {
    const before = await lagTotals();
    recordVisibilityLag("2026-11-02T10:00:10.000Z", Date.parse("2026-11-02T10:00:00.000Z"));
    const after = await lagTotals();
    expect(after.count - before.count).toBe(1);
    expect(after.sum - before.sum).toBe(0);
  });
});
