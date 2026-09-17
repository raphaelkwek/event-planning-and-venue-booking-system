import type { Sql, TransactionSql } from "postgres";
import type { AccessScope, EventStatus } from "@connectsphere/contracts";

/**
 * B1, C1–C3, D1, D4, D5 — the event aggregate, which a request belongs to from
 * the moment it is first saved as a draft. A draft is a row at status Draft
 * with most fields still empty; B2 is what makes them mandatory, and it is
 * applied at submission rather than by the table.
 */

export interface EventFields {
  name: string;
  purpose: string | null;
  description: string | null;
  proposedStartAt: string | null;
  proposedEndAt: string | null;
  expectedAttendance: number | null;
  venueRequirements: unknown | null;
  accessibilityNeeds: string | null;
  equipmentRequired: boolean | null;
  equipmentRequirements: unknown | null;
  registrationRequired: boolean | null;
  registrationOpensAt: string | null;
  registrationClosesAt: string | null;
}

export interface EventRow extends EventFields {
  id: string;
  /** Null until the request is submitted (C3). */
  reference: string | null;
  ownerId: string;
  status: EventStatus;
  /** Null while the request is a draft (C3). */
  submittedAt: string | null;
  lastSavedAt: string;
  reviewingCoordinatorId: string | null;
  reviewStartedAt: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  rejectionReason: string | null;
  assignedCoordinatorId: string | null;
}

export interface RawEvent {
  id: string;
  reference: string | null;
  owner_id: string;
  name: string;
  purpose: string | null;
  description: string | null;
  proposed_start_at: Date | null;
  proposed_end_at: Date | null;
  expected_attendance: number | null;
  venue_requirements: unknown | null;
  accessibility_needs: string | null;
  equipment_required: boolean | null;
  equipment_requirements: unknown | null;
  registration_required: boolean | null;
  registration_opens_at: Date | null;
  registration_closes_at: Date | null;
  status: EventStatus;
  submitted_at: Date | null;
  last_saved_at: Date;
  reviewing_coordinator_id: string | null;
  review_started_at: Date | null;
  decided_by: string | null;
  decided_at: Date | null;
  rejection_reason: string | null;
  assigned_coordinator_id: string | null;
}

export function toEvent(row: RawEvent): EventRow {
  return {
    id: row.id,
    reference: row.reference,
    ownerId: row.owner_id,
    name: row.name,
    purpose: row.purpose,
    description: row.description,
    proposedStartAt: row.proposed_start_at?.toISOString() ?? null,
    proposedEndAt: row.proposed_end_at?.toISOString() ?? null,
    expectedAttendance: row.expected_attendance,
    venueRequirements: row.venue_requirements,
    accessibilityNeeds: row.accessibility_needs,
    equipmentRequired: row.equipment_required,
    equipmentRequirements: row.equipment_requirements,
    registrationRequired: row.registration_required,
    registrationOpensAt: row.registration_opens_at?.toISOString() ?? null,
    registrationClosesAt: row.registration_closes_at?.toISOString() ?? null,
    status: row.status,
    submittedAt: row.submitted_at?.toISOString() ?? null,
    lastSavedAt: row.last_saved_at.toISOString(),
    reviewingCoordinatorId: row.reviewing_coordinator_id,
    reviewStartedAt: row.review_started_at?.toISOString() ?? null,
    decidedBy: row.decided_by,
    decidedAt: row.decided_at?.toISOString() ?? null,
    rejectionReason: row.rejection_reason,
    assignedCoordinatorId: row.assigned_coordinator_id ?? null,
  };
}

function jsonOrNull(sql: Sql | TransactionSql, value: unknown) {
  return value === null || value === undefined ? null : sql.json(value as never);
}

/**
 * A3 — the scope rule Identity returned is applied here, in the query, so an
 * event outside the caller's relationship yields no row at all rather than a
 * result the API layer has to remember to hide.
 *
 * Drafts live in this table too, and a draft is visible to its owner alone
 * (C1). So even the coordinator scope, which is every event, stops short of
 * other people's drafts.
 */
function scopeCondition(sql: Sql | TransactionSql, scope: AccessScope, callerId: string) {
  switch (scope.scopeType) {
    case "ALL":
      return sql`(e.status <> 'DRAFT' or e.owner_id = ${callerId})`;
    case "OWNED_BY_USER":
      return sql`e.owner_id = ${callerId}`;
    default:
      return sql`false`;
  }
}

/** B1 — a request submitted directly, without having been saved as a draft. */
export async function insertSubmittedEvent(
  tx: TransactionSql,
  ownerId: string,
  fields: EventFields
): Promise<EventRow> {
  const rows = await tx<RawEvent[]>`
    insert into event.events (
      reference, owner_id, name, purpose, description, proposed_start_at, proposed_end_at,
      expected_attendance, venue_requirements, accessibility_needs, equipment_required,
      equipment_requirements, registration_required, registration_opens_at,
      registration_closes_at, status, submitted_at, last_saved_at, created_by, updated_by
    ) values (
      'EVT-' || lpad(nextval('event.event_reference_seq')::text, 6, '0'),
      ${ownerId}, ${fields.name}, ${fields.purpose}, ${fields.description},
      ${fields.proposedStartAt}, ${fields.proposedEndAt}, ${fields.expectedAttendance},
      ${jsonOrNull(tx, fields.venueRequirements)}, ${fields.accessibilityNeeds},
      ${fields.equipmentRequired}, ${jsonOrNull(tx, fields.equipmentRequirements)},
      ${fields.registrationRequired}, ${fields.registrationOpensAt},
      ${fields.registrationClosesAt}, 'SUBMITTED', now(), now(),
      ${ownerId}, ${ownerId}
    )
    returning *, null::uuid as assigned_coordinator_id
  `;
  return toEvent(rows[0]!);
}

/**
 * C2 — submitting a draft. The draft is the record, so it keeps its id and its
 * history and simply gains a reference and a submission time. The status in
 * the condition makes it idempotent: a request already submitted updates no
 * row, so it cannot be submitted twice or gain a second reference.
 */
export async function submitDraft(
  tx: TransactionSql,
  draftId: string,
  ownerId: string,
  fields?: EventFields
): Promise<EventRow | null> {
  // The values on screen, when sent, are written by the same statement that
  // submits them — so a submission either stores and submits them together, or
  // (having already been refused by validation) never reaches here at all.
  const values = fields
    ? tx`
        name = ${fields.name},
        purpose = ${fields.purpose},
        description = ${fields.description},
        proposed_start_at = ${fields.proposedStartAt},
        proposed_end_at = ${fields.proposedEndAt},
        expected_attendance = ${fields.expectedAttendance},
        venue_requirements = ${jsonOrNull(tx, fields.venueRequirements)},
        accessibility_needs = ${fields.accessibilityNeeds},
        equipment_required = ${fields.equipmentRequired},
        equipment_requirements = ${jsonOrNull(tx, fields.equipmentRequirements)},
        registration_required = ${fields.registrationRequired},
        registration_opens_at = ${fields.registrationOpensAt},
        registration_closes_at = ${fields.registrationClosesAt},
        last_saved_at = now(),
      `
    : tx``;

  const rows = await tx<RawEvent[]>`
    update event.events set
      ${values}
      reference = 'EVT-' || lpad(nextval('event.event_reference_seq')::text, 6, '0'),
      status = 'SUBMITTED',
      submitted_at = now(),
      updated_at = now(),
      updated_by = ${ownerId}
    where id = ${draftId} and owner_id = ${ownerId} and status = 'DRAFT'
    returning *, null::uuid as assigned_coordinator_id
  `;
  return rows[0] ? toEvent(rows[0]) : null;
}

export async function findEventInScope(
  sql: Sql,
  eventId: string,
  scope: AccessScope,
  callerId: string
): Promise<EventRow | null> {
  const rows = await sql<RawEvent[]>`
    select e.*, a.coordinator_id as assigned_coordinator_id
    from event.events e
    left join event.assignments a on a.event_id = e.id and a.is_active
    where e.id = ${eventId} and ${scopeCondition(sql, scope, callerId)}
  `;
  return rows[0] ? toEvent(rows[0]) : null;
}

/** C3 — the caller's own requests, filtered by the scope rule (A3). */
export async function listEventsInScope(
  sql: Sql,
  scope: AccessScope,
  callerId: string
): Promise<EventRow[]> {
  const rows = await sql<RawEvent[]>`
    select e.*, a.coordinator_id as assigned_coordinator_id
    from event.events e
    left join event.assignments a on a.event_id = e.id and a.is_active
    where ${scopeCondition(sql, scope, callerId)}
    order by e.submitted_at desc
  `;
  return rows.map(toEvent);
}

/**
 * D1 — the queue: every event awaiting a decision, oldest submission first.
 * `decided_at is null` is what "has no recorded decision" means.
 */
export async function listReviewQueue(
  sql: Sql,
  statuses: readonly EventStatus[]
): Promise<EventRow[]> {
  const rows = await sql<RawEvent[]>`
    select e.*, a.coordinator_id as assigned_coordinator_id
    from event.events e
    left join event.assignments a on a.event_id = e.id and a.is_active
    where e.status in ${sql(statuses as string[])} and e.decided_at is null
    order by e.submitted_at asc
  `;
  return rows.map(toEvent);
}

/**
 * D1 — opening a Submitted request claims it for review. The condition makes
 * the claim atomic: a second coordinator opening it concurrently updates no
 * row, so the reviewer on the record is never overwritten.
 */
export async function claimForReview(
  tx: TransactionSql,
  eventId: string,
  coordinatorId: string
): Promise<EventRow | null> {
  const rows = await tx<RawEvent[]>`
    update event.events set
      status = 'UNDER_REVIEW',
      reviewing_coordinator_id = ${coordinatorId},
      review_started_at = now(),
      updated_at = now(),
      updated_by = ${coordinatorId}
    where id = ${eventId} and status = 'SUBMITTED' and reviewing_coordinator_id is null
    returning *, null::uuid as assigned_coordinator_id
  `;
  return rows[0] ? toEvent(rows[0]) : null;
}

/** Re-reads an event under a row lock, for a decision that must not race. */
export async function lockEventInScope(
  tx: TransactionSql,
  eventId: string,
  scope: AccessScope,
  callerId: string
): Promise<EventRow | null> {
  const rows = await tx<RawEvent[]>`
    select e.*, null::uuid as assigned_coordinator_id
    from event.events e
    where e.id = ${eventId} and ${scopeCondition(tx, scope, callerId)}
    for update
  `;
  return rows[0] ? toEvent(rows[0]) : null;
}

export async function setStatus(
  tx: TransactionSql,
  eventId: string,
  status: EventStatus,
  actorId: string
): Promise<void> {
  await tx`
    update event.events
    set status = ${status}, updated_at = now(), updated_by = ${actorId}
    where id = ${eventId}
  `;
}

/** D3 — the organiser's amendments, applied once the before values are captured. */
export async function applyAmendments(
  tx: TransactionSql,
  eventId: string,
  columns: Record<string, unknown>,
  actorId: string
): Promise<EventRow> {
  const rows = await tx<RawEvent[]>`
    update event.events set
      ${tx(columns)},
      updated_at = now(),
      updated_by = ${actorId}
    where id = ${eventId}
    returning *, null::uuid as assigned_coordinator_id
  `;
  return toEvent(rows[0]!);
}

/**
 * D4/D5 — record the decision. `decided_at is null` in the condition is what
 * stops a second approval or rejection: an event that already carries a
 * decision updates no row, so no second decision timestamp can be written.
 */
export async function recordDecision(
  tx: TransactionSql,
  eventId: string,
  status: "APPROVED" | "REJECTED",
  actorId: string,
  rejectionReason: string | null
): Promise<EventRow | null> {
  const rows = await tx<RawEvent[]>`
    update event.events set
      status = ${status},
      decided_by = ${actorId},
      decided_at = now(),
      rejection_reason = ${rejectionReason},
      updated_at = now(),
      updated_by = ${actorId}
    where id = ${eventId} and decided_at is null
    returning *, null::uuid as assigned_coordinator_id
  `;
  return rows[0] ? toEvent(rows[0]) : null;
}
