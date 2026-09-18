import type { Sql, TransactionSql } from "postgres";

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

/** E2 — who currently holds the assignment, so a proposal can be checked against it. */
export async function findActiveAssignment(
  sql: Sql | TransactionSql,
  eventId: string
): Promise<AssignmentRow | null> {
  const rows = await sql<
    { id: string; coordinator_id: string; assignment_rule: string; assigned_at: Date }[]
  >`
    select id, coordinator_id, assignment_rule, assigned_at
    from event.assignments
    where event_id = ${eventId} and is_active
  `;
  const row = rows[0];
  return row
    ? {
        id: row.id,
        coordinatorId: row.coordinator_id,
        assignmentRule: row.assignment_rule,
        assignedAt: row.assigned_at.toISOString(),
      }
    : null;
}

/** Closes the currently active assignment, so a new one can replace it (E2 accept). */
export async function closeActiveAssignment(
  tx: TransactionSql,
  assignmentId: string,
  actorId: string
): Promise<void> {
  await tx`
    update event.assignments
    set is_active = false, ended_at = now(), updated_at = now(), updated_by = ${actorId}
    where id = ${assignmentId}
  `;
}

export interface ProposalRow {
  id: string;
  eventId: string;
  outgoingCoordinatorId: string;
  nomineeCoordinatorId: string;
  status: "PENDING" | "ACCEPTED" | "DECLINED";
  proposedAt: string;
  resolvedAt: string | null;
}

interface RawProposal {
  id: string;
  event_id: string;
  outgoing_coordinator_id: string;
  nominee_coordinator_id: string;
  status: "PENDING" | "ACCEPTED" | "DECLINED";
  proposed_at: Date;
  resolved_at: Date | null;
}

function toProposal(row: RawProposal): ProposalRow {
  return {
    id: row.id,
    eventId: row.event_id,
    outgoingCoordinatorId: row.outgoing_coordinator_id,
    nomineeCoordinatorId: row.nominee_coordinator_id,
    status: row.status,
    proposedAt: row.proposed_at.toISOString(),
    resolvedAt: row.resolved_at?.toISOString() ?? null,
  };
}

/**
 * E2 — creating the proposal. The partial unique index
 * `reassignment_proposals_one_pending_per_event` (migration 0004) is what
 * actually enforces "only one pending proposal per event"; this is a plain
 * insert, and the caller catches its `23505` unique violation on the race.
 */
export async function insertProposal(
  tx: TransactionSql,
  params: { eventId: string; outgoingCoordinatorId: string; nomineeId: string; actorId: string }
): Promise<ProposalRow> {
  const rows = await tx<RawProposal[]>`
    insert into event.reassignment_proposals (
      event_id, outgoing_coordinator_id, nominee_coordinator_id, status, created_by, updated_by
    ) values (
      ${params.eventId}, ${params.outgoingCoordinatorId}, ${params.nomineeId}, 'PENDING',
      ${params.actorId}, ${params.actorId}
    )
    returning *
  `;
  return toProposal(rows[0]!);
}

export async function findPendingProposal(
  sql: Sql | TransactionSql,
  eventId: string
): Promise<ProposalRow | null> {
  const rows = await sql<RawProposal[]>`
    select * from event.reassignment_proposals where event_id = ${eventId} and status = 'PENDING'
  `;
  return rows[0] ? toProposal(rows[0]) : null;
}

/** History for the event, newest first — pending and resolved proposals alike. */
export async function listProposals(sql: Sql, eventId: string): Promise<ProposalRow[]> {
  const rows = await sql<RawProposal[]>`
    select * from event.reassignment_proposals where event_id = ${eventId} order by proposed_at desc
  `;
  return rows.map(toProposal);
}

/**
 * E2 accept — conditional on the proposal still being pending for this
 * nominee, so a decline (or a second accept) racing in cannot both win.
 */
export async function resolveProposalAccept(
  tx: TransactionSql,
  params: { proposalId: string; nomineeId: string }
): Promise<ProposalRow | null> {
  const rows = await tx<RawProposal[]>`
    update event.reassignment_proposals
    set status = 'ACCEPTED', resolved_at = now(), updated_at = now(), updated_by = ${params.nomineeId}
    where id = ${params.proposalId} and nominee_coordinator_id = ${params.nomineeId} and status = 'PENDING'
    returning *
  `;
  return rows[0] ? toProposal(rows[0]) : null;
}

export async function resolveProposalDecline(
  tx: TransactionSql,
  params: { proposalId: string; nomineeId: string }
): Promise<ProposalRow | null> {
  const rows = await tx<RawProposal[]>`
    update event.reassignment_proposals
    set status = 'DECLINED', resolved_at = now(), updated_at = now(), updated_by = ${params.nomineeId}
    where id = ${params.proposalId} and nominee_coordinator_id = ${params.nomineeId} and status = 'PENDING'
    returning *
  `;
  return rows[0] ? toProposal(rows[0]) : null;
}
