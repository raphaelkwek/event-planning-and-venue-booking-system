import { EVENT_STATUS_LABELS, type EventStatus } from "@connectsphere/contracts";

/**
 * F1 — status changes only as a consequence of a defined action. There is no
 * screen that sets an arbitrary status; every transition below belongs to a
 * story, and an attempt outside this table is refused naming both statuses.
 *
 * `transitionEvent` (api/transitionEvent.ts) is the only code that applies a
 * row of this table, and the only code that writes an event's status. Later
 * stories (F3 cancellation, S2, S3) add rows
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
  | "REJECT_SAFETY_ARRANGEMENT"
  | "MARK_CONFIRMED"
  | "VENUE_BLOCKED"
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
  // U1 — the Safety Officer's approval records the safety check as passed and the event STAYS
  // in Safety Review (Week 9 answer, W9-31): the row exists so the approval gets a history entry
  // and a message through the one guarded path. U1 refuses it while an arrangement flag is
  // outstanding (S3 may flag an event in Safety Review, AC6), or a flagged event could be
  // confirmed. Only MARK_CONFIRMED, below, makes the event Confirmed.
  APPROVE_SAFETY: { from: ["SAFETY_REVIEW"], to: "SAFETY_REVIEW" },
  // U1 — a request for changes sends the event back to Planning (CQ-08, W9-63), from where it
  // passes F5 and the safety check again.
  REQUEST_SAFETY_CHANGES: { from: ["SAFETY_REVIEW"], to: "PLANNING" },
  // U1 — rejecting the safety arrangement also returns the event to Planning (CQ-08, W9-21): the
  // event is not rejected or cancelled, and its venue and equipment arrangements stay in place.
  REJECT_SAFETY_ARRANGEMENT: { from: ["SAFETY_REVIEW"], to: "PLANNING" },
  // U1 — the assigned coordinator marks an event Confirmed after the Safety Officer approved it
  // (W9-31, W9-25). Whether the check was passed is checked where this is applied.
  MARK_CONFIRMED: { from: ["SAFETY_REVIEW"], to: "CONFIRMED" },
  // I3 — a block over a confirmed booking returns a Confirmed event to Planning,
  // never to Cancelled (W9-50). From there it passes F5 and the safety check again.
  VENUE_BLOCKED: { from: ["CONFIRMED"], to: "PLANNING" },
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
