import { parseCloudEvent } from "@connectsphere/contracts";
import type { Client } from "@temporalio/client";
import { completeEventWorkflowId, completionScheduleFor, type CompletionSchedule } from "./domain/completionTrigger.js";
import { completeEvent, rescheduleSignal } from "./workflows/completeEvent.js";

/**
 * EN-11 — the event-completion consumer: it reads the event topic and starts or
 * resets each Confirmed event's CompleteEvent workflow (ADR-0008, ADR-0009).
 *
 * How it meets §3.5 differently from the notification consumer, and why:
 * - **No inbox table.** Its only side effect is a Temporal signal-with-start on
 *   the event's own workflow id, which is idempotent: a redelivered message
 *   signals the run already going, and the reschedule handler ignores an end it
 *   already has. A message replayed after the run finished starts a run that
 *   finds the event no longer Confirmed and stops.
 * - **No retry or dead-letter topic yet.** A message that fails validation
 *   can't come from a producer using the same contracts, so it is logged and
 *   skipped rather than parked; a Temporal failure is thrown, so the offset
 *   isn't committed and kafkajs delivers the message again once Temporal is
 *   back. Adding its retry and dead-letter topics needs a reviewed contracts
 *   change and topics created on the shared cluster.
 */

export const CONSUMER = "event-completion";

/** connectsphere.planning-core.event-completion, plus the laptop's KAFKA_GROUP_SUFFIX (§3.1). */
export function consumerGroup(suffix: string): string {
  const group = `connectsphere.planning-core.${CONSUMER}`;
  return suffix ? `${group}.${suffix}` : group;
}

export interface CompletionScheduler {
  schedule(schedule: CompletionSchedule): Promise<void>;
}

export type CompletionOutcome =
  | { outcome: "scheduled"; eventId: string }
  | { outcome: "ignored" }
  | { outcome: "invalid"; error: string };

/** Handles one message's value. Throws only when the scheduler does, so the message is delivered again. */
export async function handleCompletionMessage(value: string | null, scheduler: CompletionScheduler): Promise<CompletionOutcome> {
  let event;
  try {
    event = parseCloudEvent(JSON.parse(value ?? ""));
  } catch (error) {
    return { outcome: "invalid", error: String((error as Error)?.message ?? error).slice(0, 500) };
  }

  const schedule = completionScheduleFor(event);
  if (!schedule) return { outcome: "ignored" };
  await scheduler.schedule(schedule);
  return { outcome: "scheduled", eventId: schedule.eventId };
}

/** Starts the event's workflow, or, if it is running, resets its timer to `endsAt`. */
export function temporalScheduler(client: Client, taskQueue: string): CompletionScheduler {
  return {
    async schedule({ eventId, endsAt }) {
      await client.workflow.signalWithStart(completeEvent, {
        workflowId: completeEventWorkflowId(eventId),
        taskQueue,
        args: [{ eventId, endsAt }],
        signal: rescheduleSignal,
        signalArgs: [{ endsAt }],
      });
    },
  };
}
