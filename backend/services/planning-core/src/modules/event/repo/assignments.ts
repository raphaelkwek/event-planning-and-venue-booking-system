import type { Sql, TransactionSql } from "postgres";
import type { EventStatus } from "@connectsphere/contracts";

/** E1, E2, E3 — an event's coordinator assignments: one active at a time, the rest kept as history. */

export interface AssignmentRow {
  id: string;
  coordinatorId: string;
  assignmentRule: string;
  assignedAt: string;
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
  status: "PENDING" | "ACCEPTED" | "DECLINED" | "CLOSED";
  proposedAt: string;
  resolvedAt: string | null;
}

interface RawProposal {
  id: string;
  event_id: string;
  outgoing_coordinator_id: string;
  nominee_coordinator_id: string;
  status: "PENDING" | "ACCEPTED" | "DECLINED" | "CLOSED";
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
 * E4 — a peer proposal still pending when the Lead reassigns the event is
 * closed, unaccepted (W9-FX-5). The row is kept, as every resolved one is.
 */
export async function closePendingProposal(tx: TransactionSql, eventId: string, actorId: string): Promise<void> {
  await tx`
    update event.reassignment_proposals
    set status = 'CLOSED', resolved_at = now(), updated_at = now(), updated_by = ${actorId}
    where event_id = ${eventId} and status = 'PENDING'
  `;
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

/** E3 — a request in the Lead's unassigned queue. */
export interface UnassignedRequest {
  id: string;
  reference: string | null;
  name: string;
  proposedStartAt: string | null;
  proposedEndAt: string | null;
  expectedAttendance: number | null;
  submittedAt: string | null;
  status: string;
}

/**
 * E3 — every submitted event with no active coordinator that is still in the
 * workflow (not Draft, Completed, Cancelled or Rejected), oldest submission first.
 */
export async function listUnassigned(sql: Sql): Promise<UnassignedRequest[]> {
  const rows = await sql<
    {
      id: string;
      reference: string | null;
      name: string;
      proposed_start_at: Date | null;
      proposed_end_at: Date | null;
      expected_attendance: number | null;
      submitted_at: Date | null;
      status: string;
    }[]
  >`
    select e.id, e.reference, e.name, e.proposed_start_at, e.proposed_end_at, e.expected_attendance, e.submitted_at, e.status
    from event.events e
    where e.status not in ('DRAFT', 'COMPLETED', 'CANCELLED', 'REJECTED')
      and not exists (select 1 from event.assignments a where a.event_id = e.id and a.is_active)
    order by e.submitted_at, e.id
  `;
  return rows.map((row) => ({
    id: row.id,
    reference: row.reference,
    name: row.name,
    proposedStartAt: row.proposed_start_at?.toISOString() ?? null,
    proposedEndAt: row.proposed_end_at?.toISOString() ?? null,
    expectedAttendance: row.expected_attendance,
    submittedAt: row.submitted_at?.toISOString() ?? null,
    status: row.status,
  }));
}

/** E3, E5 — each coordinator's number of active assignments to events still in the workflow. */
export async function countActiveAssignments(sql: Sql, coordinatorIds: readonly string[]): Promise<Map<string, number>> {
  if (coordinatorIds.length === 0) return new Map();
  const rows = await sql<{ coordinator_id: string; n: number }[]>`
    select a.coordinator_id, count(*)::int as n
    from event.assignments a join event.events e on e.id = a.event_id
    where a.is_active and a.coordinator_id = any(${[...coordinatorIds]}::uuid[])
      and e.status not in ('COMPLETED', 'CANCELLED', 'REJECTED')
    group by a.coordinator_id
  `;
  return new Map(rows.map((row) => [row.coordinator_id, row.n]));
}

/** What an assignment needs to know about the event, read under its row lock. */
export interface EventForAssignment {
  id: string;
  reference: string | null;
  name: string;
  status: EventStatus;
  ownerId: string;
}

/**
 * E3, E4 — locks the event row (`for update`) so two Leads acting on it at
 * once are taken in turn; null when there is no such event.
 */
export async function lockEventForAssignment(tx: TransactionSql, eventId: string): Promise<EventForAssignment | null> {
  const rows = await tx<{ id: string; reference: string | null; name: string; status: EventForAssignment["status"]; owner_id: string }[]>`
    select id, reference, name, status, owner_id from event.events where id = ${eventId} for update
  `;
  const row = rows[0];
  return row ? { id: row.id, reference: row.reference, name: row.name, status: row.status, ownerId: row.owner_id } : null;
}

/**
 * E3, E4 — a change of coordinator is a change to the event: its version (the
 * ETag, ADR-0015) rises, so a copy read before it is never served as current,
 * and an edit begun before it is refused as stale.
 */
export async function raiseEventVersion(tx: TransactionSql, eventId: string, actorId: string): Promise<void> {
  await tx`update event.events set version = version + 1, updated_at = now(), updated_by = ${actorId} where id = ${eventId}`;
}
