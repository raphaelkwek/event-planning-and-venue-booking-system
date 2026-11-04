import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { TestWorkflowEnvironment } from "@temporalio/testing";
import { Worker, type WorkflowBundleWithSourceMap } from "@temporalio/worker";
import type { CompletionAttempt } from "../../src/modules/event/index.js";
import type { ExpireOutcome, RemindOutcome } from "../../src/modules/venue/index.js";
import { temporalScheduler } from "../../src/temporal/completionConsumer.js";
import { completeEventWorkflowId, type CompletionSchedule } from "../../src/temporal/domain/completionTrigger.js";
import { holdExpiryWorkflowId, type HoldExpirySchedule } from "../../src/temporal/domain/holdExpiryTrigger.js";
import { holdExpiryScheduler } from "../../src/temporal/holdExpiryConsumer.js";
import { reconcileTimers } from "../../src/temporal/reconcileTimers.js";
import { bundleCompletionWorkflows } from "../../src/temporal/workflowBundle.js";
import { logger } from "../../src/shared/logger.js";

/**
 * EN-11-T4 — the worker's reconcile against real workflows, on Temporal's time-skipping test
 * server. The server starts with no workflows, as Temporal did after the 4 Nov redeploy lost its
 * state; the reconcile is given what the database would list and uses the consumers' own
 * schedulers, so the workflow ids are theirs. The activities are fakes that record the server's
 * clock: hours pass in milliseconds, and "at once" means before a minute of server time.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const TASK_QUEUE = "en-11-reconcile-tests";

// Starting a worker per test takes a second or two, more on a CI runner.
vi.setConfig({ testTimeout: 30_000 });

let env: TestWorkflowEnvironment;
let workflowBundle: WorkflowBundleWithSourceMap;

beforeAll(async () => {
  env = await TestWorkflowEnvironment.createTimeSkipping();
  workflowBundle = await bundleCompletionWorkflows();
}, 120_000);

afterAll(async () => {
  await env?.teardown();
});

// The reconcile's summary line is not what these tests are about.
beforeEach(() => void vi.spyOn(logger, "info").mockImplementation(() => undefined));
afterEach(() => vi.restoreAllMocks());

/** Fake activities, by id: each records the server time of every call and answers as the database would. */
function fakeActivities(expiresAtOf: (holdId: string) => number) {
  const completions = new Map<string, number[]>();
  const reminders = new Map<string, number[]>();
  const expiries = new Map<string, number[]>();
  const record = (calls: Map<string, number[]>, id: string, at: number) => calls.set(id, [...(calls.get(id) ?? []), at]);
  return {
    completions,
    reminders,
    expiries,
    activities: {
      async completeEventIfDue(eventId: string): Promise<CompletionAttempt> {
        record(completions, eventId, await env.currentTimeMs());
        return { outcome: "completed" };
      },
      async remindHoldIfDue(holdId: string): Promise<RemindOutcome> {
        const now = await env.currentTimeMs();
        record(reminders, holdId, now);
        // The venue rule: a reminder that would arrive after the expiry is not sent.
        return now >= expiresAtOf(holdId) ? { outcome: "too-late" } : { outcome: "reminded", message: "m" };
      },
      async expireHoldIfDue(holdId: string): Promise<ExpireOutcome> {
        record(expiries, holdId, await env.currentTimeMs());
        return { outcome: "expired" };
      },
    },
  };
}

function setUp(events: CompletionSchedule[], holds: HoldExpirySchedule[]) {
  const expiresAt = new Map(holds.map((h) => [h.holdId, Date.parse(h.expiresAt)]));
  const fake = fakeActivities((holdId) => expiresAt.get(holdId) ?? Number.POSITIVE_INFINITY);
  const reconcile = () =>
    reconcileTimers(
      { awaitingCompletion: async () => events, heldHolds: async () => holds },
      { completion: temporalScheduler(env.client, TASK_QUEUE), holdExpiry: holdExpiryScheduler(env.client, TASK_QUEUE) }
    );
  const run = async <T>(body: () => Promise<T>): Promise<T> => {
    const worker = await Worker.create({ connection: env.nativeConnection, taskQueue: TASK_QUEUE, workflowBundle, activities: fake.activities });
    return worker.runUntil(body);
  };
  return { fake, reconcile, run };
}

const iso = (ms: number) => new Date(ms).toISOString();
// The test client skips time only through workflow.result, not a handle's.
const resultOf = (workflowId: string) => env.client.workflow.result(workflowId);

describe("reconcileTimers on Temporal (EN-11-T4)", () => {
  it("EN-11-T4 completes at once an event whose end passed, and expires at once a hold whose expiry passed, while the worker was down", async () => {
    const t0 = await env.currentTimeMs();
    const event = { eventId: randomUUID(), endsAt: iso(t0 - 30 * MINUTE) };
    const hold = { holdId: randomUUID(), expiresAt: iso(t0 - 10 * MINUTE), reminderLeadMinutes: 60 };
    const { fake, reconcile, run } = setUp([event], [hold]);

    const { reconciled, completed, expired } = await run(async () => {
      const reconciled = await reconcile();
      const completed = await resultOf(completeEventWorkflowId(event.eventId));
      const expired = await resultOf(holdExpiryWorkflowId(hold.holdId));
      return { reconciled, completed, expired };
    });

    expect(reconciled).toEqual({ events: { listed: 1, scheduled: 1, failed: 0 }, holds: { listed: 1, scheduled: 1, failed: 0 } });
    expect(completed).toEqual({ outcome: "completed" });
    expect(fake.completions.get(event.eventId)).toHaveLength(1);
    expect(fake.completions.get(event.eventId)![0]! - t0).toBeLessThan(MINUTE);
    expect(expired).toEqual({ outcome: "expired" });
    // The reminder step is asked once and answers too late; the expiry follows without a wait.
    expect(fake.reminders.get(hold.holdId)).toHaveLength(1);
    expect(fake.expiries.get(hold.holdId)).toHaveLength(1);
    expect(fake.expiries.get(hold.holdId)![0]! - t0).toBeLessThan(MINUTE);
  });

  it("EN-11-T4 re-creates a future timer that fires only at the end, and a hold's reminder at the lead time", async () => {
    const t0 = await env.currentTimeMs();
    const event = { eventId: randomUUID(), endsAt: iso(t0 + 3 * HOUR) };
    const hold = { holdId: randomUUID(), expiresAt: iso(t0 + 2 * HOUR), reminderLeadMinutes: 60 };
    const { fake, reconcile, run } = setUp([event], [hold]);

    await run(async () => {
      await reconcile();
      await resultOf(holdExpiryWorkflowId(hold.holdId));
      await resultOf(completeEventWorkflowId(event.eventId));
    });

    const [remindedAt] = fake.reminders.get(hold.holdId)!;
    expect(fake.reminders.get(hold.holdId)).toHaveLength(1);
    expect(remindedAt! - t0).toBeGreaterThanOrEqual(HOUR);
    expect(remindedAt! - t0).toBeLessThan(2 * HOUR);
    expect(fake.expiries.get(hold.holdId)).toHaveLength(1);
    expect(fake.expiries.get(hold.holdId)![0]! - t0).toBeGreaterThanOrEqual(2 * HOUR);
    expect(fake.completions.get(event.eventId)).toHaveLength(1);
    expect(fake.completions.get(event.eventId)![0]! - t0).toBeGreaterThanOrEqual(3 * HOUR);
  });

  it("EN-11-T4 reaches the consumers' runs when it reconciles again: no second workflow and no second completion", async () => {
    const t0 = await env.currentTimeMs();
    const event = { eventId: randomUUID(), endsAt: iso(t0 + 3 * HOUR) };
    const hold = { holdId: randomUUID(), expiresAt: iso(t0 + 2 * HOUR), reminderLeadMinutes: 60 };
    const { fake, reconcile, run } = setUp([event], [hold]);
    const eventHandle = env.client.workflow.getHandle(completeEventWorkflowId(event.eventId));
    const holdHandle = env.client.workflow.getHandle(holdExpiryWorkflowId(hold.holdId));

    const runs = await run(async () => {
      await reconcile();
      const first = { event: await eventHandle.describe(), hold: await holdHandle.describe() };
      await reconcile();
      const second = { event: await eventHandle.describe(), hold: await holdHandle.describe() };
      await resultOf(holdExpiryWorkflowId(hold.holdId));
      await resultOf(completeEventWorkflowId(event.eventId));
      return { first, second };
    });

    expect(runs.first.event.status.name).toBe("RUNNING");
    expect(runs.first.event.taskQueue).toBe(TASK_QUEUE);
    expect(runs.second.event.runId).toBe(runs.first.event.runId);
    expect(runs.second.hold.runId).toBe(runs.first.hold.runId);
    expect(fake.completions.get(event.eventId)).toHaveLength(1);
    expect(fake.expiries.get(hold.holdId)).toHaveLength(1);
  });
});
