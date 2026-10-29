import type { Sql, TransactionSql } from "postgres";
import type { Fragment } from "./sqlFragment.js";
import type { AccessScope, EventStatus } from "@connectsphere/contracts";
import { isEventId } from "../domain/ids.js";
import { historyText, type ChangeableEvent, type ProposedChanges } from "../domain/proposedChange.js";
import { isSignificantEventField, KAFKA_TOPICS, type SignificantEventField } from "@connectsphere/contracts";
import { recordFieldChanges } from "./eventHistory.js";
import { writeOutbox } from "../events/outbox.js";

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
  /** F3: why, by whom and when the event was cancelled; null unless it is Cancelled. */
  cancellationReason: string | null;
  cancelledBy: string | null;
  cancelledAt: string | null;
  assignedCoordinatorId: string | null;
  /** G1: free text, such as a name, email and phone number. */
  contactDetails: string | null;
  /** G1: raised by every change to the event; edits carry it in If-Match (ADR-0015). */
  version: number;
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
  cancellation_reason: string | null;
  cancelled_by: string | null;
  cancelled_at: Date | null;
  assigned_coordinator_id: string | null;
  contact_details: string | null;
  version: number;
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
    cancellationReason: row.cancellation_reason ?? null,
    cancelledBy: row.cancelled_by ?? null,
    cancelledAt: row.cancelled_at?.toISOString() ?? null,
    assignedCoordinatorId: row.assigned_coordinator_id ?? null,
    contactDetails: row.contact_details ?? null,
    version: row.version,
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

/**
 * `lock: "share"` takes a share lock on the event row (inside a transaction), so a status change,
 * which locks the row `for update` (updateStatusIf), waits until the reader's transaction ends,
 * and a reader waits for a change in progress and then sees its result. `lock: "update"` locks it
 * `for update`, for a caller that writes the event.
 */
export async function findEventInScope(
  sql: Sql | TransactionSql,
  eventId: string,
  scope: AccessScope,
  callerId: string,
  options: { lock?: "share" | "update" } = {}
): Promise<EventRow | null> {
  if (!isEventId(eventId)) return null;
  const rows = await sql<RawEvent[]>`
    select e.*, a.coordinator_id as assigned_coordinator_id
    from event.events e
    left join event.assignments a on a.event_id = e.id and a.is_active
    where e.id = ${eventId} and ${scopeCondition(sql, scope, callerId)}
    ${options.lock === "update" ? sql`for update of e` : options.lock === "share" ? sql`for share of e` : sql``}
  `;
  return rows[0] ? toEvent(rows[0]) : null;
}

/**
 * S2 — writes an approved change's values and one FIELD_CHANGE entry per field (AC3).
 * The version trigger bumps `version`. Only the fields in `changes` are touched.
 */
export async function applyApprovedChange(
  tx: TransactionSql,
  event: { id: string; current: ChangeableEvent },
  changes: ProposedChanges,
  actor: { userId: string; role: string },
  occurredAt?: Date
): Promise<void> {
  const fields = Object.keys(changes).filter(isSignificantEventField);
  if (fields.length === 0) return;

  const json = (value: unknown) => (value === null || value === undefined ? null : JSON.stringify(value));
  const assignments: Record<SignificantEventField, Fragment> = {
    proposedStartAt: tx`proposed_start_at = ${(changes.proposedStartAt as string | null) ?? null}`,
    proposedEndAt: tx`proposed_end_at = ${(changes.proposedEndAt as string | null) ?? null}`,
    expectedAttendance: tx`expected_attendance = ${(changes.expectedAttendance as number | null) ?? null}`,
    venueRequirements: tx`venue_requirements = ${json(changes.venueRequirements)}::text::jsonb`,
    equipmentRequired: tx`equipment_required = ${(changes.equipmentRequired as boolean | null) ?? null}`,
    equipmentRequirements: tx`equipment_requirements = ${json(changes.equipmentRequirements)}::text::jsonb`,
  };
  const set = fields.map((field) => assignments[field]).reduce((all, one) => tx`${all}, ${one}`);

  // `previous` reads the row as it was before this statement changed it.
  const [row] = await tx<ScheduleChange[]>`
    with previous as (
      select id, proposed_start_at, proposed_end_at from event.events where id = ${event.id}
    )
    update event.events e
    set ${set}, updated_at = now(), updated_by = ${actor.userId}
    from previous
    where e.id = previous.id
    returning e.owner_id, e.status, e.proposed_start_at, e.proposed_end_at,
      previous.proposed_start_at as previous_start_at, previous.proposed_end_at as previous_end_at
  `;
  if (row && scheduleMoved(row)) await writeScheduleChanged(tx, event.id, row, actor);
  await recordFieldChanges(
    tx,
    event.id,
    fields.map((field) => ({
      fieldName: field,
      previousValue: historyText(field, event.current[field]),
      newValue: historyText(field, changes[field]),
    })),
    actor,
    "CHANGE_REQUEST_APPROVED",
    occurredAt
  );
}

interface ScheduleChange {
  owner_id: string;
  status: EventStatus;
  proposed_start_at: Date | null;
  proposed_end_at: Date | null;
  previous_start_at: Date | null;
  previous_end_at: Date | null;
}

const instant = (value: Date | null) => value?.getTime() ?? null;
const iso = (value: Date | null) => value?.toISOString() ?? null;

/** True when the start or the end is now a different instant, however it was written. */
function scheduleMoved(row: ScheduleChange): boolean {
  return (
    instant(row.proposed_start_at) !== instant(row.previous_start_at) ||
    instant(row.proposed_end_at) !== instant(row.previous_end_at)
  );
}

/**
 * EN-11 — an approved change moved the event's date or times. A Confirmed
 * event's completion workflow resets its timer to the new end (ADR-0009).
 */
function writeScheduleChanged(
  tx: TransactionSql,
  eventId: string,
  row: ScheduleChange,
  actor: { userId: string; role: string }
): Promise<string> {
  return writeOutbox(tx, {
    topic: KAFKA_TOPICS.event,
    messageType: "event.schedule-changed",
    aggregateId: eventId,
    actor,
    correlationId: null,
    payload: {
      eventId,
      ownerId: row.owner_id,
      status: row.status,
      previousStartAt: iso(row.previous_start_at),
      previousEndAt: iso(row.previous_end_at),
      proposedStartAt: iso(row.proposed_start_at),
      proposedEndAt: iso(row.proposed_end_at),
      changedAt: new Date().toISOString(),
    },
  });
}

/** I1 — each event's reference, for those of `eventIds` that exist. */
export async function findReferences(sql: Sql, eventIds: readonly string[]): Promise<Map<string, string | null>> {
  if (eventIds.length === 0) return new Map();
  const rows = await sql<{ id: string; reference: string | null }[]>`
    select id, reference from event.events where id in ${sql(eventIds as string[])}
  `;
  return new Map(rows.map((row) => [row.id, row.reference]));
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
 * The columns each action sets in the same statement as its status change
 * (F1). They are fragments, not statements: `updateStatusIf` splices them into
 * its conditional UPDATE, so the decision, the review claim or the submission
 * can never be stored without the status change, or the other way round.
 */

/** D4/D5 — the decision, its maker and its time; the reason for a rejection. */
export function decisionColumns(
  tx: TransactionSql,
  deciderId: string,
  rejectionReason: string | null
): Fragment {
  return tx`decided_by = ${deciderId}, decided_at = now(), rejection_reason = ${rejectionReason},`;
}

/** F3 — why, by whom and when the event was cancelled (AC3). */
export function cancellationColumns(tx: TransactionSql, cancelledBy: string, reason: string): Fragment {
  return tx`cancellation_reason = ${reason}, cancelled_by = ${cancelledBy}, cancelled_at = now(),`;
}

/** D1 — the coordinator who opened the request, and when. */
export function reviewColumns(tx: TransactionSql, coordinatorId: string): Fragment {
  return tx`reviewing_coordinator_id = ${coordinatorId}, review_started_at = now(),`;
}

/**
 * B1/C2 — the reference and submission time, plus the values on screen when
 * they are sent with a draft's submission, so they are stored only if the
 * submission succeeds.
 */
export function submissionColumns(tx: TransactionSql, fields?: EventFields): Fragment {
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
  return tx`
    ${values}
    reference = 'EVT-' || lpad(nextval('event.event_reference_seq')::text, 6, '0'),
    submitted_at = now(),
  `;
}
