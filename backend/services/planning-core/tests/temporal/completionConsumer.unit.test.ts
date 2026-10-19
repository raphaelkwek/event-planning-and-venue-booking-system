import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { TestWorkflowEnvironment } from "@temporalio/testing";
import { Worker, type WorkflowBundleWithSourceMap } from "@temporalio/worker";
import type { CompletionSchedule } from "../../src/temporal/domain/completionTrigger.js";
import { completeEventWorkflowId } from "../../src/temporal/domain/completionTrigger.js";
import { consumerGroup, handleCompletionMessage, temporalScheduler } from "../../src/temporal/completionConsumer.js";
import { bundleCompletionWorkflows } from "../../src/temporal/workflowBundle.js";

/**
 * EN-11 — the consumer that starts and resets CompleteEvent from the event
 * topic (ADR-0008, ADR-0009). No Kafka here: the handler is given a message's
 * value, as kafkajs would, and the scheduler is either a fake or Temporal's
 * time-skipping test server.
 */

const HOUR = 60 * 60 * 1000;

// Starting a worker and bundling workflows takes seconds, more on a CI runner.
vi.setConfig({ testTimeout: 30_000 });

function message(type: string, data: Record<string, unknown>, eventId = data.eventId as string): string {
  return JSON.stringify({
    specversion: "1.0",
    id: randomUUID(),
    source: "/connectsphere/planning-core/event",
    type,
    subject: eventId,
    time: "2026-10-19T08:00:00.000Z",
    datacontenttype: "application/json",
    traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
    actor: "SYSTEM",
    data,
  });
}

function confirmed(eventId: string, proposedEndAt: string) {
  return message("event.status-changed", {
    eventId,
    ownerId: randomUUID(),
    previousStatus: "SAFETY_REVIEW",
    newStatus: "CONFIRMED",
    action: "APPROVE_SAFETY",
    proposedStartAt: null,
    proposedEndAt,
    changedAt: "2026-10-19T08:00:00.000Z",
  });
}

function fakeScheduler() {
  const scheduled: CompletionSchedule[] = [];
  return { scheduled, schedule: async (s: CompletionSchedule) => void scheduled.push(s) };
}

describe("consumerGroup", () => {
  it("is planning-core's event-completion group, with the laptop's suffix when there is one (§3.1)", () => {
    expect(consumerGroup("")).toBe("connectsphere.planning-core.event-completion");
    expect(consumerGroup("dev-cyc")).toBe("connectsphere.planning-core.event-completion.dev-cyc");
  });
});

describe("handleCompletionMessage", () => {
  it("schedules the completion of an event that became Confirmed", async () => {
    const scheduler = fakeScheduler();
    const eventId = randomUUID();

    const outcome = await handleCompletionMessage(confirmed(eventId, "2026-11-20T09:00:00.000Z"), scheduler);

    expect(outcome).toEqual({ outcome: "scheduled", eventId });
    expect(scheduler.scheduled).toEqual([{ eventId, endsAt: "2026-11-20T09:00:00.000Z" }]);
  });

  it("ignores a message the workflow has no business with", async () => {
    const scheduler = fakeScheduler();
    const eventId = randomUUID();
    const approved = message("event.approved", {
      eventId,
      eventReference: "EVT-1",
      eventName: "Orientation",
      ownerId: randomUUID(),
      approvedBy: randomUUID(),
      approvedAt: "2026-10-19T08:00:00.000Z",
    });

    expect(await handleCompletionMessage(approved, scheduler)).toEqual({ outcome: "ignored" });
    expect(scheduler.scheduled).toEqual([]);
  });

  it.each([
    ["not JSON", "{"],
    ["empty", null],
    ["not a CloudEvent", JSON.stringify({ hello: "world" })],
    ["data that fails its type's schema", message("event.status-changed", { eventId: randomUUID() })],
  ])("skips a message that is %s, saying why, because a retry can't fix it", async (_label, value) => {
    const scheduler = fakeScheduler();

    const outcome = await handleCompletionMessage(value, scheduler);

    expect(outcome.outcome).toBe("invalid");
    expect(scheduler.scheduled).toEqual([]);
  });

  it("lets a Temporal failure propagate, so kafkajs delivers the message again", async () => {
    const failing = {
      schedule: async () => {
        throw new Error("Temporal unreachable");
      },
    };

    await expect(handleCompletionMessage(confirmed(randomUUID(), "2026-11-20T09:00:00.000Z"), failing)).rejects.toThrow(
      "Temporal unreachable"
    );
  });
});

describe("temporalScheduler (time-skipping server)", () => {
  const TASK_QUEUE = "en-11-consumer-tests";
  let env: TestWorkflowEnvironment;
  let workflowBundle: WorkflowBundleWithSourceMap;

  beforeAll(async () => {
    env = await TestWorkflowEnvironment.createTimeSkipping();
    workflowBundle = await bundleCompletionWorkflows();
  }, 120_000);

  afterAll(async () => {
    await env?.teardown();
  });

  it("starts one workflow per event; a redelivered message reaches the same run", async () => {
    // The workflow runs to completion under a worker: one left pending or terminated stalls the
    // test server's skipped clock for the next test.
    const activities = { completeEventIfDue: async () => ({ outcome: "completed" as const }) };
    const worker = await Worker.create({ connection: env.nativeConnection, taskQueue: TASK_QUEUE, workflowBundle, activities });
    const scheduler = temporalScheduler(env.client, TASK_QUEUE);
    const eventId = randomUUID();
    const handle = env.client.workflow.getHandle(completeEventWorkflowId(eventId));

    const [first, second] = await worker.runUntil(async () => {
      const endsAt = new Date((await env.currentTimeMs()) + 3 * HOUR).toISOString();
      await scheduler.schedule({ eventId, endsAt });
      const first = await handle.describe();
      await scheduler.schedule({ eventId, endsAt });
      const second = await handle.describe();
      await env.client.workflow.result(completeEventWorkflowId(eventId));
      return [first, second];
    });

    expect(first.status.name).toBe("RUNNING");
    expect(first.taskQueue).toBe(TASK_QUEUE);
    expect(second.runId).toBe(first.runId);
  });

  it("resets a running workflow's timer to the new end", async () => {
    const calls: number[] = [];
    const activities = {
      async completeEventIfDue() {
        calls.push(await env.currentTimeMs());
        return { outcome: "completed" as const };
      },
    };
    const worker = await Worker.create({ connection: env.nativeConnection, taskQueue: TASK_QUEUE, workflowBundle, activities });
    const scheduler = temporalScheduler(env.client, TASK_QUEUE);
    const eventId = randomUUID();

    const movedTo = await worker.runUntil(async () => {
      const now = await env.currentTimeMs();
      await scheduler.schedule({ eventId, endsAt: new Date(now + 2 * HOUR).toISOString() });
      await env.sleep(HOUR);
      const movedTo = now + 6 * HOUR;
      await scheduler.schedule({ eventId, endsAt: new Date(movedTo).toISOString() });
      // The test client skips time only through workflow.result, not a handle's.
      await env.client.workflow.result(completeEventWorkflowId(eventId));
      return movedTo;
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toBeGreaterThanOrEqual(movedTo);
  });
});
