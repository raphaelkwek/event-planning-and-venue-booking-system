import type { TransactionSql } from "postgres";

/** E1 (stubbed) — see domain/assignment.ts for why the pool is configuration. */

export interface AssignmentRow {
  id: string;
  coordinatorId: string;
  assignmentRule: string;
  assignedAt: string;
}

/**
 * Takes the round-robin cursor under a row lock, so two concurrent
 * submissions cannot read the same value and be handed the same coordinator.
 */
export async function takeCursor(tx: TransactionSql): Promise<number> {
  const rows = await tx<{ next_index: number }[]>`
    select next_index from event.assignment_cursor where id = true for update
  `;
  return rows[0]?.next_index ?? 0;
}

export async function saveCursor(tx: TransactionSql, nextIndex: number): Promise<void> {
  await tx`
    update event.assignment_cursor
    set next_index = ${nextIndex}, updated_at = now()
    where id = true
  `;
}

export async function insertAssignment(
  tx: TransactionSql,
  eventId: string,
  coordinatorId: string,
  assignmentRule: string,
  actorId: string
): Promise<AssignmentRow> {
  const rows = await tx<
    { id: string; coordinator_id: string; assignment_rule: string; assigned_at: Date }[]
  >`
    insert into event.assignments (event_id, coordinator_id, assignment_rule, created_by, updated_by)
    values (${eventId}, ${coordinatorId}, ${assignmentRule}, ${actorId}, ${actorId})
    returning id, coordinator_id, assignment_rule, assigned_at
  `;

  const row = rows[0]!;
  return {
    id: row.id,
    coordinatorId: row.coordinator_id,
    assignmentRule: row.assignment_rule,
    assignedAt: row.assigned_at.toISOString(),
  };
}
