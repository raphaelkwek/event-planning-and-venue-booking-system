import { parseCloudEvent } from "@connectsphere/contracts";
import type { Client } from "@temporalio/client";
import { holdExpiryScheduleFor, holdExpiryWorkflowId, type HoldExpirySchedule } from "./domain/holdExpiryTrigger.js";
import { holdExpiry, holdRescheduleSignal } from "./workflows/holdExpiry.js";

/**
 * L6 — the hold-expiry consumer: it reads the venue-booking topic and starts or
 * resets each placed hold's HoldExpiry workflow (ADR-0008, ADR-0009). Like
 * EN-11's completion consumer it has no inbox table: its only side effect is a
 * signal-with-start on the hold's own workflow id, which is idempotent (the
 * reschedule handler ignores an expiry it already has), and a run started
 * after the hold has left Held finds it `gone` and stops. A message that fails
 * validation is logged and skipped; a Temporal failure is thrown so the
 * message is delivered again.
 */

export const CONSUMER = "hold-expiry";

/** connectsphere.planning-core.hold-expiry, plus the laptop's KAFKA_GROUP_SUFFIX (§3.1). */
export function consumerGroup(suffix: string): string {
  const group = `connectsphere.planning-core.${CONSUMER}`;
  return suffix ? `${group}.${suffix}` : group;
}

export interface HoldExpiryScheduler {
  schedule(schedule: HoldExpirySchedule): Promise<void>;
}

export type HoldExpiryOutcome =
  | { outcome: "scheduled"; holdId: string }
  | { outcome: "ignored" }
  | { outcome: "invalid"; error: string };

/** Handles one message's value. Throws only when the scheduler does, so the message is delivered again. */
export async function handleHoldExpiryMessage(value: string | null, scheduler: HoldExpiryScheduler): Promise<HoldExpiryOutcome> {
  let event;
  try {
    event = parseCloudEvent(JSON.parse(value ?? ""));
  } catch (error) {
    return { outcome: "invalid", error: String((error as Error)?.message ?? error).slice(0, 500) };
  }

  const schedule = holdExpiryScheduleFor(event);
  if (!schedule) return { outcome: "ignored" };
  await scheduler.schedule(schedule);
  return { outcome: "scheduled", holdId: schedule.holdId };
}

/** Starts the hold's workflow, or, if it is running, resets its timers to `expiresAt`. */
export function holdExpiryScheduler(client: Client, taskQueue: string): HoldExpiryScheduler {
  return {
    async schedule({ holdId, expiresAt, reminderLeadMinutes }) {
      await client.workflow.signalWithStart(holdExpiry, {
        workflowId: holdExpiryWorkflowId(holdId),
        taskQueue,
        args: [{ holdId, expiresAt, reminderLeadMinutes }],
        signal: holdRescheduleSignal,
        signalArgs: [{ expiresAt }],
      });
    },
  };
}
