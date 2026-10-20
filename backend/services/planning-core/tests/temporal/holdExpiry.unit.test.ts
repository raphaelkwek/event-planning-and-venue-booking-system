import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { TestWorkflowEnvironment } from "@temporalio/testing";
import { Worker, type WorkflowBundleWithSourceMap } from "@temporalio/worker";
import type { ExpireOutcome, RemindOutcome } from "../../src/modules/venue/index.js";
import { holdExpiryWorkflowId } from "../../src/temporal/domain/holdExpiryTrigger.js";
import { bundleCompletionWorkflows } from "../../src/temporal/workflowBundle.js";
import { RECHECK_AFTER_MS, holdRescheduleSignal, type holdExpiry } from "../../src/temporal/workflows/holdExpiry.js";

/**
 * L6-T10 — the HoldExpiry workflow (ADR-0009, CR-04), on Temporal's time-skipping
 * test server: hours pass in milliseconds, so "reminded at the lead time, expired
 * at the expiry, with nobody calling the API" is shown directly. No database, no
 * Docker and no cloud account: the activities are fakes that record when they
 * were asked, by the server's clock.
 */

const MINUTE = 60_000;
const TASK_QUEUE = "l6-tests";

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

/** Fake activities: answer from scripts, in order (then with the usual success), and record the server time of every call. */
function fakeHold(script: { remind?: RemindOutcome[]; expire?: ExpireOutcome[] } = {}) {
  const reminds: number[] = [];
  const expires: number[] = [];
  const remind = [...(script.remind ?? [])];
  const expire = [...(script.expire ?? [])];
  return {
    reminds,
    expires,
    activities: {
      async remindHoldIfDue(): Promise<RemindOutcome> {
        reminds.push(await env.currentTimeMs());
        return remind.shift() ?? { outcome: "reminded", message: "m" };
      },
      async expireHoldIfDue(): Promise<ExpireOutcome> {
        expires.push(await env.currentTimeMs());
        return expire.shift() ?? { outcome: "expired" };
      },
    },
  };
}

async function run<T>(fake: ReturnType<typeof fakeHold>, body: (t0: number) => Promise<T>): Promise<T> {
  const worker = await Worker.create({ connection: env.nativeConnection, taskQueue: TASK_QUEUE, workflowBundle, activities: fake.activities });
  return worker.runUntil(async () => body(await env.currentTimeMs()));
}

function start(expiresAt: number, reminderLeadMinutes: number | null = 60) {
  const holdId = randomUUID();
  return env.client.workflow.start<typeof holdExpiry>("holdExpiry", {
    taskQueue: TASK_QUEUE,
    workflowId: holdExpiryWorkflowId(holdId),
    args: [{ holdId, expiresAt: new Date(expiresAt).toISOString(), reminderLeadMinutes }],
  });
}

/** Moves the server's clock to `t0 + minutes`. */
async function advanceTo(t0: number, minutes: number) {
  await env.sleep(Math.max(0, t0 + minutes * MINUTE - (await env.currentTimeMs())));
}

/** Server times are checked to the second: the activity runs the moment the skipped timer fires. */
const near = (actual: number | undefined, expected: number) => {
  expect(actual).toBeGreaterThanOrEqual(expected);
  expect(actual).toBeLessThan(expected + 5_000);
};

describe("HoldExpiry (L6, CR-04)", () => {
  it("L6-T10 reminds at the lead time and expires at the expiry on its own, and a reschedule moves both", async () => {
    // Run 1: expiry 120 minutes out, lead 60.
    const first = fakeHold();
    await run(first, async (t0) => {
      const handle = await start(t0 + 120 * MINUTE);
      await advanceTo(t0, 59);
      expect(first.reminds).toHaveLength(0);
      await advanceTo(t0, 60);
      await advanceTo(t0, 119);
      expect(first.reminds).toHaveLength(1);
      expect(first.expires).toHaveLength(0);
      expect(await handle.result()).toEqual({ outcome: "expired" });
      near(first.reminds[0], t0 + 60 * MINUTE);
      near(first.expires[0], t0 + 120 * MINUTE);
      expect(first.expires).toHaveLength(1);
    });

    // Run 2: at 30 minutes the expiry moves to 240; nothing happens at the old times.
    const second = fakeHold();
    await run(second, async (t0) => {
      const handle = await start(t0 + 120 * MINUTE);
      await advanceTo(t0, 30);
      await handle.signal(holdRescheduleSignal, { expiresAt: new Date(t0 + 240 * MINUTE).toISOString() });
      await advanceTo(t0, 121);
      expect(second.reminds).toHaveLength(0);
      expect(second.expires).toHaveLength(0);
      await advanceTo(t0, 179);
      expect(second.reminds).toHaveLength(0);
      await advanceTo(t0, 181);
      expect(second.reminds).toHaveLength(1);
      await advanceTo(t0, 239);
      expect(second.expires).toHaveLength(0);
      expect(await handle.result()).toEqual({ outcome: "expired" });
      near(second.reminds[0], t0 + 180 * MINUTE);
      near(second.expires[0], t0 + 240 * MINUTE);
    });

    // Run 3: the database says not due, with a new expiry; then the hold is gone.
    let newExpiry = 0;
    const third = fakeHold();
    third.activities.expireHoldIfDue = async () => {
      third.expires.push(await env.currentTimeMs());
      return third.expires.length === 1
        ? { outcome: "not-due", expiresAt: new Date(newExpiry).toISOString() }
        : { outcome: "gone", status: "RELEASED" };
    };
    await run(third, async (t0) => {
      newExpiry = t0 + 150 * MINUTE;
      const result = await (await start(t0 + 120 * MINUTE)).result();
      expect(result).toEqual({ outcome: "gone", status: "RELEASED" });
      expect(third.expires).toHaveLength(2);
      near(third.expires[0], t0 + 120 * MINUTE);
      near(third.expires[1], newExpiry);
    });
  });

  it("reminds at once when the reminder time has already passed, then expires at the expiry", async () => {
    const fake = fakeHold();
    await run(fake, async (t0) => {
      const result = await (await start(t0 + 30 * MINUTE)).result();
      expect(result).toEqual({ outcome: "expired" });
      near(fake.reminds[0], t0);
      near(fake.expires[0], t0 + 30 * MINUTE);
    });
  });

  it("goes by the database's reminder time when the lead time isn't known, and by the first answer's time after", async () => {
    let remindAt = 0;
    const fake = fakeHold();
    fake.activities.remindHoldIfDue = async () => {
      fake.reminds.push(await env.currentTimeMs());
      return fake.reminds.length === 1 ? { outcome: "not-due", remindAt: new Date(remindAt).toISOString() } : { outcome: "already" };
    };
    await run(fake, async (t0) => {
      remindAt = t0 + 90 * MINUTE;
      await (await start(t0 + 120 * MINUTE, null)).result();
      expect(fake.reminds).toHaveLength(2);
      near(fake.reminds[0], t0);
      near(fake.reminds[1], remindAt);
      near(fake.expires[0], t0 + 120 * MINUTE);
    });
  });

  it("asks again no sooner than the recheck interval when the timer fired before the database's clock reached the expiry", async () => {
    let expiresAt = 0;
    const fake = fakeHold();
    fake.activities.expireHoldIfDue = async () => {
      fake.expires.push(await env.currentTimeMs());
      return fake.expires.length === 1 ? { outcome: "not-due", expiresAt: new Date(expiresAt).toISOString() } : { outcome: "expired" };
    };
    await run(fake, async (t0) => {
      expiresAt = t0 + 120 * MINUTE;
      await (await start(expiresAt)).result();
      expect(fake.expires).toHaveLength(2);
      expect(fake.expires[1]! - fake.expires[0]!).toBeGreaterThanOrEqual(RECHECK_AFTER_MS);
    });
  });

  it("asks the reminder again later when the database says it isn't due", async () => {
    let remindAt = 0;
    const fake = fakeHold();
    fake.activities.remindHoldIfDue = async () => {
      fake.reminds.push(await env.currentTimeMs());
      return fake.reminds.length === 1 ? { outcome: "not-due", remindAt: new Date(remindAt).toISOString() } : { outcome: "reminded", message: "m" };
    };
    await run(fake, async (t0) => {
      remindAt = t0 + 80 * MINUTE;
      await (await start(t0 + 120 * MINUTE)).result();
      expect(fake.reminds).toHaveLength(2);
      near(fake.reminds[1], remindAt);
    });
  });

  it.each([
    ["reminder", { remind: [{ outcome: "gone", status: "RELEASED" }] } as const, "RELEASED"],
    ["reminder, no such hold", { remind: [{ outcome: "gone", status: null }] } as const, null],
    ["expiry", { expire: [{ outcome: "gone", status: "CONVERTED" }] } as const, "CONVERTED"],
  ])("stops when the hold is gone at the %s", async (_label, script, status) => {
    const fake = fakeHold(script as Parameters<typeof fakeHold>[0]);
    await run(fake, async (t0) => {
      expect(await (await start(t0 + 120 * MINUTE)).result()).toEqual({ outcome: "gone", status });
    });
    expect(fake.reminds.length + fake.expires.length).toBe(script.remind ? 1 : 2);
  });

  it("ignores a reschedule that names the expiry it already has", async () => {
    const fake = fakeHold();
    await run(fake, async (t0) => {
      const handle = await start(t0 + 120 * MINUTE);
      await advanceTo(t0, 10);
      await handle.signal(holdRescheduleSignal, { expiresAt: new Date(t0 + 120 * MINUTE).toISOString() });
      await handle.result();
      near(fake.reminds[0], t0 + 60 * MINUTE);
      expect(fake.reminds).toHaveLength(1);
    });
  });
});
