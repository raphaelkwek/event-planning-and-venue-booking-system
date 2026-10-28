import { EVENT_STATUS_LABELS, type EventStatus } from "@connectsphere/contracts";

/**
 * F1 — status changes only as a consequence of a defined action. There is no
 * screen that sets an arbitrary status; every transition below belongs to a
 * story, and an attempt outside this table is refused naming both statuses.
 *
 * `transitionEvent` (api/transitionEvent.ts) is the only code that applies a
 * row of this table, and the only code that writes an event's status. Later
 * stories (F3 cancellation, S2, S3, U1's reject once CQ-08 is answered) add rows
 * here rather than writing status themselves.
 */
export type EventAction =
  | "SUBMIT"
  | "OPEN_FOR_REVIEW"
  | "REQUEST_CLARIFICATION"
  | "RESPOND_TO_CLARIFICATION"
  | "APPROVE"
  | "REJECT"
  | "CONFIRM_ARRANGEMENTS"
  | "APPROVE_SAFETY"
  | "REQUEST_SAFETY_CHANGES"
  | "COMPLETE"
  | "RECONSIDER_AFTER_CHANGE";

export interface TransitionRule {
  readonly from: readonly EventStatus[];
  readonly to: EventStatus;
}

const TRANSITIONS: Record<EventAction, TransitionRule> = {
  SUBMIT: { from: ["DRAFT"], to: "SUBMITTED" },
  OPEN_FOR_REVIEW: { from: ["SUBMITTED"], to: "UNDER_REVIEW" },
  REQUEST_CLARIFICATION: { from: ["UNDER_REVIEW"], to: "AWAITING_CLARIFICATION" },
  RESPOND_TO_CLARIFICATION: { from: ["AWAITING_CLARIFICATION"], to: "UNDER_REVIEW" },
  APPROVE: { from: ["UNDER_REVIEW", "AWAITING_CLARIFICATION"], to: "APPROVED" },
  REJECT: { from: ["UNDER_REVIEW", "AWAITING_CLARIFICATION"], to: "REJECTED" },
  // F5 confirms the arrangements (a confirmed booking, equipment reserved).
  // Since CR-06 that leads to Safety Review, not straight to Confirmed.
  CONFIRM_ARRANGEMENTS: { from: ["APPROVED", "PLANNING"], to: "SAFETY_REVIEW" },
  // U1 — only the Safety Officer's approval makes an event Confirmed (CR-06).
  // S3: a change approved while the event is in Safety Review leaves it there
  // (AC6) but may flag its arrangements. When U1 applies this transition it must
  // refuse while any arrangement flag is outstanding (the venue and equipment
  // reads F5 uses), or a flagged event would become Confirmed.
  APPROVE_SAFETY: { from: ["SAFETY_REVIEW"], to: "CONFIRMED" },
  // U1 — a request for changes sends the event back to Planning, from where it
  // passes F5 and the safety check again. Rejecting the safety arrangement has
  // no row: its outcome waits on the customer's answer to CQ-08.
  // CR-06 proposes Planning; CQ-08 also asks which stage this returns to, so
  // the target may change with the customer's answer.
  REQUEST_SAFETY_CHANGES: { from: ["SAFETY_REVIEW"], to: "PLANNING" },
  // F1 — only a confirmed event took place, so only a confirmed event
  // completes, and only once its end has passed (checked where the transition
  // is applied, in transitionEvent).
  COMPLETE: { from: ["CONFIRMED"], to: "COMPLETED" },
  // Week 9 answer W9-22 — an approved material change to a Confirmed event
  // returns it to Planning; it is confirmed again only after F5 and a new
  // safety check (U1). S3 applies it when it approves a change request; every
  // significant field counts as material. No other status moves (S3 AC6).
  RECONSIDER_AFTER_CHANGE: { from: ["CONFIRMED"], to: "PLANNING" },
};

export function transitionRule(action: EventAction): TransitionRule {
  return TRANSITIONS[action];
}

export function refusalMessage(current: EventStatus, target: EventStatus): string {
  return (
    `This event is ${EVENT_STATUS_LABELS[current]} and cannot move to ` +
    `${EVENT_STATUS_LABELS[target]}.`
  );
}

/** F1 — a Confirmed event refused completion because its end has not passed. */
export const COMPLETION_NOT_DUE_MESSAGE =
  `This event is ${EVENT_STATUS_LABELS.CONFIRMED} and cannot move to ` +
  `${EVENT_STATUS_LABELS.COMPLETED} until its end date and time have passed.`;

export interface TransitionAllowed {
  permitted: true;
  from: EventStatus;
  to: EventStatus;
  action: EventAction;
}

export interface TransitionRefused {
  permitted: false;
  message: string;
}

export function evaluateTransition(
  current: EventStatus,
  action: EventAction
): TransitionAllowed | TransitionRefused {
  const rule = TRANSITIONS[action];

  if (!rule.from.includes(current)) {
    return { permitted: false, message: refusalMessage(current, rule.to) };
  }

  return { permitted: true, from: current, to: rule.to, action };
}

/** D1 — the statuses the review queue shows: those awaiting a decision. */
export const QUEUE_STATUSES: readonly EventStatus[] = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "AWAITING_CLARIFICATION",
];
