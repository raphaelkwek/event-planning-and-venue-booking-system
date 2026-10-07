import type { TransactionSql } from "postgres";
import type { EventStatus } from "@connectsphere/contracts";
import {
  COMPLETION_NOT_DUE_MESSAGE,
  refusalMessage,
  transitionRule,
  type EventAction,
} from "../domain/statusMachine.js";
import { endHasPassed, readStatus, updateStatusIf, type Fragment } from "../repo/eventStatus.js";
import { recordStatusChange } from "../repo/eventHistory.js";
import type { EventRow } from "../repo/events.js";

/**
 * F1 — the one way an event's status changes. Given an action from the
 * transition table, it moves the event in a single conditional statement,
 * writes the history entry, and — when the action is not permitted from the
 * event's current status — changes nothing and says why, naming both statuses.
 *
 * Call it inside the transaction that does the rest of the action's work, and
 * call it first: a refusal then leaves nothing behind.
 *
 * Scope (A3) is the caller's job — look the event up in scope and answer 404
 * before calling this.
 */

export interface TransitionActor {
  userId: string | null;
  role: string;
}

/** A change nobody asked for — the completion sweep (implementation.md §3.3). */
export const SYSTEM_ACTOR: TransitionActor = { userId: null, role: "SYSTEM" };

export type TransitionOutcome =
  | { ok: true; event: EventRow; previousStatus: EventStatus }
  | { ok: false; currentStatus: EventStatus; message: string };

export async function transitionEvent(
  tx: TransactionSql,
  eventId: string,
  action: EventAction,
  actor: TransitionActor,
  options: { set?: Fragment; now?: Date } = {}
): Promise<TransitionOutcome> {
  const rule = transitionRule(action);

  // F1 AC6 — an event moves to Completed only after its end has passed. The
  // condition is part of the statement that changes the status, so no caller
  // can complete an event early.
  const onlyIf = action === "COMPLETE" ? endHasPassed(tx, options.now ?? new Date()) : undefined;

  const changed = await updateStatusIf(tx, {
    eventId,
    from: rule.from,
    to: rule.to,
    actorId: actor.userId,
    set: options.set,
    onlyIf,
  });

  if (!changed) {
    const currentStatus = await readStatus(tx, eventId);
    if (currentStatus === null) {
      throw new Error(`No event ${eventId} exists to transition.`);
    }
    const notYetDue = action === "COMPLETE" && rule.from.includes(currentStatus);
    return {
      ok: false,
      currentStatus,
      message: notYetDue ? COMPLETION_NOT_DUE_MESSAGE : refusalMessage(currentStatus, rule.to),
    };
  }

  await recordStatusChange(tx, eventId, {
    previousStatus: changed.previousStatus,
    newStatus: rule.to,
    actorUserId: actor.userId,
    actorRole: actor.role,
    triggeringAction: action,
  });

  return { ok: true, event: changed.event, previousStatus: changed.previousStatus };
}
