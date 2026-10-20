import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { TestWorkflowEnvironment } from "@temporalio/testing";
import { Worker } from "@temporalio/worker";
import type { CompletionAttempt } from "../src/modules/event/index.js";
import { historyToText } from "../tests/temporal/historyFile.js";
import { bundleCompletionWorkflows } from "../src/temporal/workflowBundle.js";
import { rescheduleSignal, type completeEvent } from "../src/temporal/workflows/completeEvent.js";

/**
 * EN-11 — records the workflow histories the replay test (tests/temporal/replay.unit.test.ts)
 * replays. Run it when a workflow change is *meant* to be incompatible and is
 * guarded with `patched()`, or when a new workflow is added:
 *
 *   npx tsx backend/services/planning-core/scripts/record-workflow-histories.ts
 *
 * It uses Temporal's time-skipping test server (no Docker, no cloud account) and
 * a fake activity, and writes one JSON history per scenario. Never record over
 * the committed histories to make a failing replay pass: the failure is the
 * point. Commit new files alongside the old ones instead.
 */

const OUT = fileURLToPath(new URL("../tests/temporal/histories/", import.meta.url));
const HOUR = 60 * 60 * 1000;
const TASK_QUEUE = "record-histories";

interface Scenario {
  name: string;
  /** What the fake completion activity answers, in order; a function gets the test server's clock. */
  answers: CompletionAttempt[] | ((now: number) => CompletionAttempt[]);
  /** Runs against a started workflow before its result is awaited. */
  during?: (signal: (endsAt: number) => Promise<void>, now: number) => Promise<void>;
}

const SCENARIOS: Scenario[] = [
  { name: "complete-event-completes-at-end", answers: [{ outcome: "completed" }] },
  {
    name: "complete-event-rescheduled-later",
    answers: [{ outcome: "completed" }],
    during: async (signal, now) => {
      await env.sleep(HOUR);
      await signal(now + 5 * HOUR);
    },
  },
  {
    name: "complete-event-not-due-then-completes",
    answers: (now) => [{ outcome: "not-due", endsAt: new Date(now + 6 * HOUR).toISOString() }, { outcome: "completed" }],
  },
  { name: "complete-event-stops-when-cancelled", answers: [{ outcome: "not-confirmed", status: "CANCELLED" }] },
];

const env = await TestWorkflowEnvironment.createTimeSkipping();
try {
  const workflowBundle = await bundleCompletionWorkflows();
  await mkdir(OUT, { recursive: true });

  for (const scenario of SCENARIOS) {
    const answers = typeof scenario.answers === "function" ? scenario.answers(await env.currentTimeMs()) : [...scenario.answers];
    const activities = { completeEventIfDue: async (): Promise<CompletionAttempt> => answers.shift() ?? { outcome: "completed" } };
    const worker = await Worker.create({ connection: env.nativeConnection, taskQueue: TASK_QUEUE, workflowBundle, activities });
    const workflowId = `${scenario.name}`;

    await worker.runUntil(async () => {
      const now = await env.currentTimeMs();
      const handle = await env.client.workflow.start<typeof completeEvent>("completeEvent", {
        taskQueue: TASK_QUEUE,
        workflowId,
        // A fixed event id, so re-recording changes nothing but what changed.
        args: [{ eventId: "00000000-0000-4000-8000-0000000000e1", endsAt: new Date(now + 2 * HOUR).toISOString() }],
      });
      await scenario.during?.((endsAt) => handle.signal(rescheduleSignal, { endsAt: new Date(endsAt).toISOString() }), now);
      await env.client.workflow.result(workflowId);
    });

    const history = await env.client.workflow.getHandle(workflowId).fetchHistory();
    await writeFile(`${OUT}${scenario.name}.json`, historyToText(history));
    console.log(`recorded ${scenario.name}`);
  }
} finally {
  await env.teardown();
}
