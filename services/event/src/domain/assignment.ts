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
