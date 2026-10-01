import { EVENT_STATUS_LABELS, type EventStatus } from "@connectsphere/contracts";

/**
 * F1 — status changes only as a consequence of a defined action. There is no
 * screen that sets an arbitrary status; every transition below belongs to a
 * story, and an attempt outside this table is refused naming both statuses.
 *
 * `transitionEvent` (api/transitionEvent.ts) is the only code that applies a
 * row of this table, and the only code that writes an event's status. Later
 * stories (F3 cancellation, S2) add rows here rather than writing status
 * themselves.
 */
export type EventAction =
  | "SUBMIT"
  | "OPEN_FOR_REVIEW"
  | "REQUEST_CLARIFICATION"
  | "RESPOND_TO_CLARIFICATION"
  | "APPROVE"
  | "REJECT"
  | "CONFIRM"
  | "COMPLETE";

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
  // F1 defines that Confirmed is reached by this transition; F5 performs it
  // and adds the readiness conditions that must hold first.
  CONFIRM: { from: ["APPROVED", "PLANNING"], to: "CONFIRMED" },
  // F1 — only a confirmed event took place, so only a confirmed event
  // completes, and only once its end has passed (checked where the transition
  // is applied, in transitionEvent).
  COMPLETE: { from: ["CONFIRMED"], to: "COMPLETED" },
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
