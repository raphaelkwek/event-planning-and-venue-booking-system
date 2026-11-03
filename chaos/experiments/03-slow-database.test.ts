import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Sql } from "postgres";
import { createProxy, toxiproxyIsUp, type Proxy } from "../support/toxiproxy.js";
import { portOf, withPort } from "../support/urls.js";
import { startStack, REPO_ROOT, type Stack } from "../../load/support/stack.js";
import { connect, seedEvent, tallyEvent } from "../../load/support/seed.js";
import { runK6 } from "../../load/support/k6.js";
import { metricValue, outcomesOf, seatChecks } from "../../load/support/evaluate.js";

/**
 * EN-20 experiment 3: a slow database never causes over-admission.
 *
 * Hypothesis: with 500 ms of latency on every answer the registration service gets from its database,
 * requests take far longer, but the seat count stays exact: no more registrations than seats, and
 * every 201 a client was told is a registration the database holds.
 *
 * The service reaches Postgres only through Toxiproxy. A k6 burst of 600 attempts from 600 attendees,
 * 100 at a time, goes at a 100-seat event, first with no toxic (the baseline) and then with the toxic.
 * The tally is read straight from Postgres, not through the proxy.
 */

const DATABASE_URL = process.env.DATABASE_URL!;
const PROXY_PORT = 15432;
const LATENCY_MS = 500;
const SEATS = 100;
const OUT = join(REPO_ROOT, "chaos/out/03-slow-database");

let proxy: Proxy;
let stack: Stack;
let sql: Sql;

beforeAll(async () => {
  expect(await toxiproxyIsUp(), "Toxiproxy must be running").toBe(true);
  mkdirSync(OUT, { recursive: true });
  proxy = await createProxy("registration-db", `127.0.0.1:${PROXY_PORT}`, `127.0.0.1:${portOf(DATABASE_URL)}`);
  sql = connect(DATABASE_URL);
  // A pool big enough that the burst is limited by the slow database, not by the pool's queue.
  stack = await startStack({ databaseUrl: withPort(DATABASE_URL, PROXY_PORT), harnessDatabaseUrl: DATABASE_URL, logDir: OUT, poolMax: 50, ratePerMinute: 100_000_000 });
});

afterAll(async () => {
  await stack?.stop();
  await sql?.end({ timeout: 5 });
  await proxy?.remove();
});

const p95 = (run: Awaited<ReturnType<typeof runK6>>) => metricValue(run.summary, "register_ms", "p(95)");

describe("Experiment 3: a slow database never causes over-admission", () => {
  it(`seats stay exact while every database answer takes ${LATENCY_MS} ms longer (EN-20-T3)`, async () => {
    const baselineEvent = await seedEvent(sql, SEATS);
    const baseline = await runK6({
      script: "burst.js",
      outDir: join(OUT, "baseline"),
      env: { BASE_URL: stack.registrationUrl, EVENT_ID: baselineEvent.eventId, VUS: "50", ITERATIONS: "300" },
    });
    const baselineTally = await tallyEvent(sql, baselineEvent.eventId);
    expect(seatChecks(baselineTally, SEATS).filter((c) => !c.ok), "the baseline, with no toxic, must itself be exact").toEqual([]);

    const event = await seedEvent(sql, SEATS);
    await proxy.addToxic({ name: "slow-db", type: "latency", attributes: { latency: LATENCY_MS, jitter: 0 } });
    let slow;
    try {
      slow = await runK6({
        script: "burst.js",
        outDir: join(OUT, "slow"),
        env: { BASE_URL: stack.registrationUrl, EVENT_ID: event.eventId, VUS: "100", ITERATIONS: "600", MAX_DURATION: "4m" },
      });
    } finally {
      await proxy.removeToxic("slow-db");
    }

    const tally = await tallyEvent(sql, event.eventId);
    const outcomes = outcomesOf(slow.summary);
    const unexpected = outcomes.serverErrors + outcomes.otherStatus + outcomes.rateLimited + outcomes.otherConflict + outcomes.outsideWindow;
    const requests = metricValue(slow.summary, "http_reqs", "count");
    const result = {
      experiment: 3,
      latencyMs: LATENCY_MS,
      seats: SEATS,
      attempts: 600,
      requestsCompleted: requests,
      outcomes,
      tally,
      p95Ms: { baseline: p95(baseline), slow: p95(slow) },
      sloMs: 800,
      sloMetUnderToxic: (p95(slow) ?? Infinity) <= 800,
      durationSeconds: (slow.finishedAt.getTime() - slow.startedAt.getTime()) / 1000,
    };
    writeFileSync(join(OUT, "result.json"), JSON.stringify(result, null, 2));
    console.log(`experiment 3: ${JSON.stringify(result)}`);

    // The pass condition: exact seats, whatever the latency did to the responses. The lower bounds make sure something was registered at all.
    expect(requests, "k6 completed every attempt").toBe(600);
    expect(tally.registered, "the burst registered someone").toBeGreaterThan(0);
    expect(tally.registered).toBeLessThanOrEqual(SEATS);
    expect(tally.distinctSeatsHeld).toBe(tally.registered);
    expect(tally.distinctAttendees).toBe(tally.registered);
    expect(tally.mismatches).toBe(0);
    expect(tally.outboxRows).toBe(tally.registered);
    expect(outcomes.registered, "every 201 a client was told is a registration the database holds").toBe(tally.registered);
    expect(outcomes.registered + outcomes.full + unexpected, "k6 accounted for every attempt").toBe(requests);
    if (unexpected === 0) expect(tally.registered, "with no failed request, all 100 seats filled").toBe(SEATS);
    expect(p95(slow), "the toxic really slowed the service").toBeGreaterThan((p95(baseline) ?? 0) + LATENCY_MS);
  });
});
