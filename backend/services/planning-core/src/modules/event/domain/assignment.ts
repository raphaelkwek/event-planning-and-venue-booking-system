import type { EventStatus } from "@connectsphere/contracts";

/**
 * E1 — automatic coordinator assignment.
 *
 * TODO(E1): this is a stub. The real story reads the eligible pool from
 * Identity (active users holding EVENT_COORDINATOR); no such endpoint exists
 * yet, so the pool comes from configuration. The allocation rule itself —
 * round-robin, applied consistently, recorded with the assignment so any
 * outcome can be explained — is what E1 asks for and is implemented here.
 */
export const ASSIGNMENT_RULE = "ROUND_ROBIN_STUB";

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

export interface Allocation {
  coordinatorId: string;
  assignmentRule: string;
  nextCursor: number;
}

export function allocateCoordinator(pool: readonly string[], cursor: number): Allocation | null {
  if (pool.length === 0) {
    return null;
  }

  const index = ((cursor % pool.length) + pool.length) % pool.length;

  return {
    coordinatorId: pool[index]!,
    assignmentRule: ASSIGNMENT_RULE,
    nextCursor: index + 1,
  };
}
