import type { Sql } from "postgres";

/**
 * E3 replaced E1's assignment on submission: a submitted event waits for the
 * Lead. Tests of later stories that need an assigned coordinator assign one
 * here, as the Lead would, and record it on the event they hold.
 */
export async function assignForTest(sql: Sql, event: { id: string; assignedCoordinatorId?: string | null }, coordinatorId: string): Promise<void> {
  await sql`
    insert into event.assignments (event_id, coordinator_id, assignment_rule, created_by, updated_by)
    values (${event.id}, ${coordinatorId}, 'TEST', ${coordinatorId}, ${coordinatorId})
  `;
  event.assignedCoordinatorId = coordinatorId;
}
