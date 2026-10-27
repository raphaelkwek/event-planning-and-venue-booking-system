import type { EventStatus } from "@connectsphere/contracts";

/**
 * E3 — the Event Coordinator Lead assigns each submitted request to one active
 * Event Coordinator. This replaced E1's automatic round-robin assignment on
 * submission (CR-05). Assignments E1 made keep their rule in the history.
 */
export const LEAD_ASSIGNMENT_RULE = "LEAD";

export const ASSIGNMENT_NOT_ACTIVE_COORDINATOR = "Only an active Event Coordinator can be assigned.";

/** A draft hasn't been submitted, and these have left the workflow; nothing else is assignable. */
const NOT_ASSIGNABLE: readonly EventStatus[] = ["DRAFT", "COMPLETED", "CANCELLED", "REJECTED"];

/** E3 — whether the Lead may assign an event in `status`. */
export function canAssign(status: EventStatus): boolean {
  return !NOT_ASSIGNABLE.includes(status);
}

/** Statuses a request cannot be reassigned from (E2) — it has left the review workflow. */
const REASSIGNMENT_TERMINAL_STATUSES: readonly EventStatus[] = ["COMPLETED", "CANCELLED", "REJECTED"];

/** E2 — reassignment proposals are permitted only while the event is still live. */
export function canProposeReassignment(status: EventStatus): boolean {
  return !REASSIGNMENT_TERMINAL_STATUSES.includes(status);
}

/**
 * E2 — proposing reassignment to the coordinator already assigned is refused
 * and creates no new history entry, so this is checked before any write.
 */
export function isSelfNomination(currentCoordinatorId: string, nomineeId: string): boolean {
  return currentCoordinatorId === nomineeId;
}
