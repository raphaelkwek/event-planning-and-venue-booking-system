import type { Sql, TransactionSql } from "postgres";

/**
 * U1 (CR-06) — the Safety Officer's decisions, in event.safety_decisions. One row per review:
 * a review begins when the event enters Safety Review (F5) and ends when it leaves, so an event
 * that returns to Planning and is confirmed again is reviewed again, and an earlier approval
 * never counts for the new review. Append-only (F2): there is no update or delete here.
 */

export type SafetyDecision = "APPROVE" | "REQUEST_CHANGES" | "REJECT";

export interface FlaggedArrangements {
  bookings: string[];
  reservations: string[];
}

export interface SafetyDecisionRecord {
  id: string;
  eventId: string;
  decision: SafetyDecision;
  reason: string | null;
  flagged: FlaggedArrangements;
  decidedBy: string;
  decidedAt: string;
}

type Row = {
  id: string;
  event_id: string;
  decision: SafetyDecision;
  reason: string | null;
  flagged: FlaggedArrangements;
  decided_by: string;
  decided_at: Date;
};

const toRecord = (row: Row): SafetyDecisionRecord => ({
  id: row.id,
  eventId: row.event_id,
  decision: row.decision,
  reason: row.reason,
  flagged: row.flagged,
  decidedBy: row.decided_by,
  decidedAt: row.decided_at.toISOString(),
});

/**
 * When the event's current review began: the latest time it entered Safety Review from another
 * status. An approval's own history entry (Safety Review to Safety Review) is not an entry.
 * Null when the event has never been in Safety Review.
 */
export async function currentReviewStartedAt(db: Sql | TransactionSql, eventId: string): Promise<Date | null> {
  const [row] = await db<{ occurred_at: Date }[]>`
    select occurred_at from event.event_history
    where event_id = ${eventId} and entry_type = 'STATUS_CHANGE' and new_status = 'SAFETY_REVIEW'
      and previous_status is distinct from 'SAFETY_REVIEW'
    order by occurred_at desc, created_at desc
    limit 1
  `;
  return row?.occurred_at ?? null;
}

/** The decision recorded for the review that began at `reviewStartedAt`, if there is one. */
export async function decisionForReview(
  db: Sql | TransactionSql,
  eventId: string,
  reviewStartedAt: Date
): Promise<SafetyDecisionRecord | null> {
  const [row] = await db<Row[]>`
    select id, event_id, decision, reason, flagged, decided_by, decided_at
    from event.safety_decisions
    where event_id = ${eventId} and review_started_at = ${reviewStartedAt}
  `;
  return row ? toRecord(row) : null;
}

export async function insertSafetyDecision(
  tx: TransactionSql,
  input: {
    /** Chosen by the caller so the flags it sets can name the decision that set them. */
    id: string;
    eventId: string;
    reviewStartedAt: Date;
    decision: SafetyDecision;
    reason: string | null;
    flagged: FlaggedArrangements;
    decidedBy: string;
  }
): Promise<SafetyDecisionRecord> {
  const [row] = await tx<Row[]>`
    insert into event.safety_decisions (id, event_id, review_started_at, decision, reason, flagged, decided_by)
    values (${input.id}, ${input.eventId}, ${input.reviewStartedAt}, ${input.decision}, ${input.reason},
            ${JSON.stringify(input.flagged)}::text::jsonb, ${input.decidedBy})
    returning id, event_id, decision, reason, flagged, decided_by, decided_at
  `;
  return toRecord(row!);
}

export interface SafetyQueueEntry {
  id: string;
  reference: string | null;
  name: string;
  expectedAttendance: number | null;
  proposedStartAt: string | null;
  proposedEndAt: string | null;
  assignedCoordinatorId: string | null;
  enteredSafetyReviewAt: string;
  /** The decision already recorded for this review: APPROVE while the coordinator has yet to mark it Confirmed. */
  decision: SafetyDecision | null;
}

/**
 * The events in Safety Review, longest-waiting first. A review's key is the entry time as the
 * service reads it (a JavaScript Date, to the millisecond), so the join truncates the stored
 * microseconds the same way.
 */
export async function listSafetyReviewQueue(sql: Sql): Promise<SafetyQueueEntry[]> {
  const rows = await sql<
    {
      id: string;
      reference: string | null;
      name: string;
      expected_attendance: number | null;
      proposed_start_at: Date | null;
      proposed_end_at: Date | null;
      coordinator_id: string | null;
      entered_at: Date;
      decision: SafetyDecision | null;
    }[]
  >`
    select e.id, e.reference, e.name, e.expected_attendance, e.proposed_start_at, e.proposed_end_at,
           a.coordinator_id, entered.occurred_at as entered_at, d.decision
    from event.events e
    left join event.assignments a on a.event_id = e.id and a.is_active
    join lateral (
      select h.occurred_at from event.event_history h
      where h.event_id = e.id and h.entry_type = 'STATUS_CHANGE' and h.new_status = 'SAFETY_REVIEW'
        and h.previous_status is distinct from 'SAFETY_REVIEW'
      order by h.occurred_at desc, h.created_at desc
      limit 1
    ) entered on true
    left join event.safety_decisions d on d.event_id = e.id and d.review_started_at = date_trunc('milliseconds', entered.occurred_at)
    where e.status = 'SAFETY_REVIEW'
    order by entered.occurred_at, e.reference
  `;
  return rows.map((row) => ({
    id: row.id,
    reference: row.reference,
    name: row.name,
    expectedAttendance: row.expected_attendance,
    proposedStartAt: row.proposed_start_at?.toISOString() ?? null,
    proposedEndAt: row.proposed_end_at?.toISOString() ?? null,
    assignedCoordinatorId: row.coordinator_id,
    enteredSafetyReviewAt: row.entered_at.toISOString(),
    decision: row.decision,
  }));
}
