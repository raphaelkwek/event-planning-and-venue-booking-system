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

/** E3, E4 — whether the Lead may assign or reassign an event in `status`. */
export function canAssign(status: EventStatus): boolean {
  return !NOT_ASSIGNABLE.includes(status);
}

/** E4 retired E2's proposals (W9-FX-5): a coordinator asking to propose one is told who reassigns now. */
export const REASSIGNMENT_RETIRED =
  "Coordinators no longer propose reassignments: the Event Coordinator Lead reassigns events.";
