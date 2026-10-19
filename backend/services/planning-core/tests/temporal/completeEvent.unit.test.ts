import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TestWorkflowEnvironment } from "@temporalio/testing";
import { Worker, type WorkflowBundleWithSourceMap } from "@temporalio/worker";
import type { CompletionAttempt } from "../../src/modules/event/index.js";
import { completeEventWorkflowId } from "../../src/temporal/domain/completionTrigger.js";
import { bundleCompletionWorkflows } from "../../src/temporal/workflowBundle.js";
import { RECHECK_AFTER_MS, rescheduleSignal, type completeEvent } from "../../src/temporal/workflows/completeEvent.js";

/**
 * EN-11 — the CompleteEvent workflow (ADR-0009), on Temporal's time-skipping
 * test server: hours pass in milliseconds, so "only after the end time" (F1
 * AC6) is shown directly. No database, no Docker and no cloud account: the
 * activity is a fake that records when it was asked, by the server's clock.
 */

const HOUR = 60 * 60 * 1000;
const TASK_QUEUE = "en-11-tests";

let env: TestWorkflowEnvironment;
let workflowBundle: WorkflowBundleWithSourceMap;

beforeAll(async () => {
  env = await TestWorkflowEnvironment.createTimeSkipping();
  workflowBundle = await bundleCompletionWorkflows();
}, 120_000);

afterAll(async () => {
  await env?.teardown();
});

/** A fake activity: answers from a script, in order, and records the server time of every call. */
function fakeCompletion(answers: CompletionAttempt[]) {
  const calls: number[] = [];
  return {
    calls,
    activities: {
      async completeEventIfDue(): Promise<CompletionAttempt> {
        calls.push(await env.currentTimeMs());
        return answers.shift() ?? { outcome: "completed" };
      },
    },
  };
}

async function run<T>(
  activities: ReturnType<typeof fakeCompletion>["activities"],
  body: (start: (endsAt: number) => ReturnType<typeof startWorkflow>) => Promise<T>
): Promise<T> {
  const worker = await Worker.create({ connection: env.nativeConnection, taskQueue: TASK_QUEUE, workflowBundle, activities });
  return worker.runUntil(body(startWorkflow));
}

function startWorkflow(endsAt: number) {
  const eventId = randomUUID();
  return env.client.workflow.start<typeof completeEvent>("completeEvent", {
    taskQueue: TASK_QUEUE,
    workflowId: completeEventWorkflowId(eventId),
    args: [{ eventId, endsAt: new Date(endsAt).toISOString() }],
  });
}

describe("CompleteEvent (EN-11, F1 AC6)", () => {
  it("does nothing before the end, then completes the event once its end has passed", async () => {
    const fake = fakeCompletion([{ outcome: "completed" }]);

    const { result, calls } = await run(fake.activities, async (start) => {
      const endsAt = (await env.currentTimeMs()) + 3 * HOUR;
      const handle = await start(endsAt);
      await env.sleep(3 * HOUR - 60_000);
      const callsBeforeEnd = fake.calls.length;
      return { result: await handle.result(), calls: { beforeEnd: callsBeforeEnd, at: [...fake.calls], endsAt } };
    });

    expect(result).toEqual({ outcome: "completed" });
    expect(calls.beforeEnd).toBe(0);
    expect(calls.at).toHaveLength(1);
    expect(calls.at[0]).toBeGreaterThanOrEqual(calls.endsAt);
  });

  it("waits for the new end when it is moved later", async () => {
    const fake = fakeCompletion([{ outcome: "completed" }]);

    const { endsAt, movedTo } = await run(fake.activities, async (start) => {
      const now = await env.currentTimeMs();
      const endsAt = now + 2 * HOUR;
      const movedTo = now + 5 * HOUR;
      const handle = await start(endsAt);
      await env.sleep(HOUR);
      await handle.signal(rescheduleSignal, { endsAt: new Date(movedTo).toISOString() });
      await handle.result();
      return { endsAt, movedTo };
    });

    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]).toBeGreaterThanOrEqual(movedTo);
    expect(fake.calls[0]).toBeGreaterThan(endsAt);
  });

  it("completes at the new end when it is moved earlier", async () => {
    const fake = fakeCompletion([{ outcome: "completed" }]);

    const { endsAt, movedTo } = await run(fake.activities, async (start) => {
      const now = await env.currentTimeMs();
      const endsAt = now + 10 * HOUR;
      const movedTo = now + 2 * HOUR;
      const handle = await start(endsAt);
      await env.sleep(HOUR);
      await handle.signal(rescheduleSignal, { endsAt: new Date(movedTo).toISOString() });
      await handle.result();
      return { endsAt, movedTo };
    });

    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]).toBeGreaterThanOrEqual(movedTo);
    expect(fake.calls[0]).toBeLessThan(endsAt);
  });

  it("waits for the end the event has now when the activity says it isn't due", async () => {
    const later = { value: 0 };
    const fake = fakeCompletion([]);
    fake.activities.completeEventIfDue = async () => {
      fake.calls.push(await env.currentTimeMs());
      return fake.calls.length === 1 ? { outcome: "not-due", endsAt: new Date(later.value).toISOString() } : { outcome: "completed" };
    };

    const result = await run(fake.activities, async (start) => {
      const now = await env.currentTimeMs();
      later.value = now + 6 * HOUR;
      const handle = await start(now + HOUR);
      return handle.result();
    });

    expect(result).toEqual({ outcome: "completed" });
    expect(fake.calls).toHaveLength(2);
    expect(fake.calls[1]).toBeGreaterThanOrEqual(later.value);
  });

  it("asks again no sooner than the recheck interval when the timer fired before the database clock reached the end", async () => {
    const fake = fakeCompletion([]);
    let endsAt = 0;
    fake.activities.completeEventIfDue = async () => {
      fake.calls.push(await env.currentTimeMs());
      return fake.calls.length === 1 ? { outcome: "not-due", endsAt: new Date(endsAt).toISOString() } : { outcome: "completed" };
    };

    await run(fake.activities, async (start) => {
      endsAt = (await env.currentTimeMs()) + HOUR;
      return (await start(endsAt)).result();
    });

    expect(fake.calls).toHaveLength(2);
    expect(fake.calls[1]! - fake.calls[0]!).toBeGreaterThanOrEqual(RECHECK_AFTER_MS);
  });

  it.each([
    [{ outcome: "not-confirmed", status: "CANCELLED" } as const],
    [{ outcome: "not-found" } as const],
  ])("stops without retrying when the event can't be completed: %o", async (answer) => {
    const fake = fakeCompletion([answer]);

    const result = await run(fake.activities, async (start) => (await start((await env.currentTimeMs()) + HOUR)).result());

    expect(result).toEqual(answer);
    expect(fake.calls).toHaveLength(1);
  });

  it("stops when the event has no end to wait for", async () => {
    const fake = fakeCompletion([{ outcome: "not-due", endsAt: null }]);

    const result = await run(fake.activities, async (start) => (await start((await env.currentTimeMs()) + HOUR)).result());

    expect(result).toEqual({ outcome: "no-end" });
  });
});
