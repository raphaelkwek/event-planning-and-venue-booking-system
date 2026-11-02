import type { EventStatus } from "@connectsphere/contracts";
import type { EventAction } from "./statusMachine.js";

/**
 * U1 — what a Safety Officer's decision means, as pure rules. `recordSafetyDecision`
 * (api/safetyDecision.ts) applies them in the decision's transaction.
 */

export type SafetyDecisionKind = "APPROVE" | "REQUEST_CHANGES" | "REJECT";

/** The F1 transition each decision applies. */
export const DECISION_ACTIONS: Record<SafetyDecisionKind, EventAction> = {
  APPROVE: "APPROVE_SAFETY",
  REQUEST_CHANGES: "REQUEST_SAFETY_CHANGES",
  REJECT: "REJECT_SAFETY_ARRANGEMENT",
};

export const DECISION_ALREADY_RECORDED_MESSAGE =
  "A safety decision has already been recorded for this review. The event comes back for a new decision only after it is confirmed again.";
export const SAFETY_CHECK_NOT_PASSED_MESSAGE =
  "The Safety Officer has not approved this event's safety arrangements, so it cannot be marked Confirmed.";

/**
 * U1 AC4 — Mark Confirmed is permitted only for an event in Safety Review whose current review was
 * approved. STATUS means F1 refuses it for the event's status; NOT_PASSED that no approval exists.
 */
export function markConfirmedRefusal(status: EventStatus, approved: boolean): "STATUS" | "NOT_PASSED" | null {
  if (status !== "SAFETY_REVIEW") return "STATUS";
  return approved ? null : "NOT_PASSED";
}

/** How a decision reads in the notification and the screen: "requested changes to", "rejected", "approved". */
export function decisionVerb(decision: SafetyDecisionKind): string {
  switch (decision) {
    case "APPROVE":
      return "approved";
    case "REQUEST_CHANGES":
      return "requested changes to";
    case "REJECT":
      return "rejected";
  }
}
