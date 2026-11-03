import type { TransactionSql } from "postgres";
import { KAFKA_TOPICS, type EventStatus } from "@connectsphere/contracts";
import { evaluateTransition } from "../domain/statusMachine.js";
import {
  DECISION_ACTIONS,
  DECISION_ALREADY_RECORDED_MESSAGE,
  SAFETY_CHECK_NOT_PASSED_MESSAGE,
  markConfirmedRefusal,
  type SafetyDecisionKind,
} from "../domain/safetyDecision.js";
import { writeOutbox } from "../events/outbox.js";
import {
  currentReviewStartedAt,
  decisionForReview,
  insertSafetyDecision,
  type FlaggedArrangements,
  type SafetyDecisionRecord,
} from "../repo/safetyDecisions.js";
import { transitionEvent } from "./transitionEvent.js";

/**
 * U1 (CR-06) — the event module's half of the Safety Officer's decision and the coordinator's Mark
 * Confirmed. The change module decides who may act and reads the arrangements (flags outstanding,
 * the arrangements a request for changes names, and sets those flags); this applies F1's
 * transition through `transitionEvent`, so the status history entry and `event.status-changed`
 * are written as for every other change, records the decision, and writes
 * `event.safety-decision-recorded` for the notification service, all in the caller's transaction.
 *
 * Call with the event row locked (`for update`) and its status already checked, so a refusal here
 * returns before anything is written and two decisions cannot both be recorded.
 */

export interface SafetyActor {
  userId: string;
  role: string;
  correlationId?: string | null;
}

export interface DecisionInput {
  /** The decision's id, chosen by the caller so the flags it sets can name it. */
  id: string;
  decision: SafetyDecisionKind;
  reason: string | null;
  flagged: FlaggedArrangements;
  /** The flagged bookings' references and the flagged equipment lines' names, for the message. */
  flaggedBookingReferences: string[];
  flaggedEquipment: string[];
}

export type RecordDecisionOutcome =
  | { ok: true; status: EventStatus; previousStatus: EventStatus; decision: SafetyDecisionRecord }
  | { ok: false; code: "STATUS_NOT_PERMITTED" | "ALREADY_RECORDED"; message: string };

export async function recordSafetyDecision(
  tx: TransactionSql,
  eventId: string,
  actor: SafetyActor,
  input: DecisionInput
): Promise<RecordDecisionOutcome> {
  const action = DECISION_ACTIONS[input.decision];
  const reviewStartedAt = await currentReviewStartedAt(tx, eventId);

  // Refuse a second decision for the same review before changing anything.
  if (reviewStartedAt && (await decisionForReview(tx, eventId, reviewStartedAt))) {
    return { ok: false, code: "ALREADY_RECORDED", message: DECISION_ALREADY_RECORDED_MESSAGE };
  }

  const moved = await transitionEvent(tx, eventId, action, { userId: actor.userId, role: actor.role }, {
    correlationId: actor.correlationId ?? null,
  });
  if (!moved.ok) return { ok: false, code: "STATUS_NOT_PERMITTED", message: moved.message };
  // An event only reaches Safety Review through a recorded status change, so a review has begun.
  if (!reviewStartedAt) throw new Error(`Event ${eventId} is in Safety Review with no entry in its history.`);

  const decision = await insertSafetyDecision(tx, {
    id: input.id,
    eventId,
    reviewStartedAt,
    decision: input.decision,
    reason: input.reason,
    flagged: input.flagged,
    decidedBy: actor.userId,
  });

  await writeOutbox(tx, {
    topic: KAFKA_TOPICS.event,
    messageType: "event.safety-decision-recorded",
    aggregateId: eventId,
    actor,
    correlationId: actor.correlationId ?? null,
    payload: {
      eventId,
      eventReference: moved.event.reference,
      eventName: moved.event.name,
      ownerId: moved.event.ownerId,
      coordinatorId: moved.event.assignedCoordinatorId,
      decision: input.decision,
      reason: input.reason,
      decidedBy: actor.userId,
      decidedAt: decision.decidedAt,
      flaggedBookingReferences: input.flaggedBookingReferences,
      flaggedEquipment: input.flaggedEquipment,
    },
  });

  return { ok: true, status: moved.event.status, previousStatus: moved.previousStatus, decision };
}

/** F1's refusal of a decision for an event in `status`, or null when it is in Safety Review. */
export function safetyDecisionRefusal(status: EventStatus): string | null {
  const outcome = evaluateTransition(status, "APPROVE_SAFETY");
  return outcome.permitted ? null : outcome.message;
}

export type MarkConfirmedOutcome =
  | { ok: true; status: EventStatus; previousStatus: EventStatus; confirmedAt: string }
  | { ok: false; code: "STATUS_NOT_PERMITTED"; message: string }
  | { ok: false; code: "SAFETY_CHECK_NOT_PASSED"; message: string };

/**
 * The assigned coordinator marks an event Confirmed. Only an event in Safety Review whose current
 * review the Safety Officer approved may move (W9-31); F1's MARK_CONFIRMED does the move.
 */
export async function markEventConfirmed(
  tx: TransactionSql,
  eventId: string,
  status: EventStatus,
  actor: SafetyActor
): Promise<MarkConfirmedOutcome> {
  const reviewStartedAt = await currentReviewStartedAt(tx, eventId);
  const decision = reviewStartedAt ? await decisionForReview(tx, eventId, reviewStartedAt) : null;
  const refusal = markConfirmedRefusal(status, decision?.decision === "APPROVE");
  if (refusal === "NOT_PASSED") return { ok: false, code: "SAFETY_CHECK_NOT_PASSED", message: SAFETY_CHECK_NOT_PASSED_MESSAGE };

  const moved = await transitionEvent(tx, eventId, "MARK_CONFIRMED", { userId: actor.userId, role: actor.role }, {
    correlationId: actor.correlationId ?? null,
  });
  if (!moved.ok) return { ok: false, code: "STATUS_NOT_PERMITTED", message: moved.message };
  return { ok: true, status: moved.event.status, previousStatus: moved.previousStatus, confirmedAt: new Date().toISOString() };
}
