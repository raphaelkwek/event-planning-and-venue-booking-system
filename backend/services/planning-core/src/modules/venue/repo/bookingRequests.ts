import type { Sql, TransactionSql } from "postgres";
import type { BookingRequestStatus, SuitabilityStatus } from "@connectsphere/contracts";
import { isDuplicatePending } from "../domain/bookingRequest.js";
import type { ConditionResult } from "../domain/suitability.js";

/**
 * L1, L2, M1, M2 — venue booking requests. SQL against the venue schema only. Whether a
 * new request duplicates a pending one is the exclusion constraint's decision
 * (migration venue/0005); nothing here checks first and then writes.
 */

type Db = Sql | TransactionSql;

export interface BookingRequest {
  id: string;
  reference: string;
  eventId: string;
  venueId: string;
  venueName: string;
  startsAt: string;
  endsAt: string;
  layout: string;
  expectedAttendance: number;
  facilities: string[];
  accessibilityFeatures: string[];
  /** The event's values when the request was made (L1). */
  eventStartsAt: string;
  eventEndsAt: string;
  eventAttendance: number;
  differsFromEvent: boolean;
  replacesBookingId: string | null;
  status: BookingRequestStatus;
  requestedBy: string;
  requestedAt: string;
  withdrawnBy: string | null;
  withdrawnAt: string | null;
  /** M1, M2: the Venue Staff member who decided, and when. */
  decidedBy: string | null;
  decidedAt: string | null;
  /** M1: the confirmed booking the approval created. */
  bookingId: string | null;
  /** M2: why it was rejected, and any alternative suggested. */
  rejectionReason: string | null;
  suggestedAlternative: string | null;
  /** I2: a block overlaps this pending request. */
  requiresReconfirmation: boolean;
  /** K2: assessed when submitted; null on requests made before K2 (not assessed). */
  suitabilityStatus: SuitabilityStatus | null;
  /** K2: the failing conditions as evaluated then. */
  suitabilityReasons: ConditionResult[] | null;
  /** K2: why a venue that isn't suitable was requested anyway. */
  justification: string | null;

}

export interface NewBookingRequest {
  eventId: string;
  venueId: string;
  startsAt: string;
  endsAt: string;
  layout: string;
  expectedAttendance: number;
  facilities: string[];
  accessibilityFeatures: string[];
  eventStartsAt: string;
  eventEndsAt: string;
  eventAttendance: number;
  differsFromEvent: boolean;
  replacesBookingId: string | null;
  requestedBy: string;
  suitabilityStatus: SuitabilityStatus;
  suitabilityReasons: ConditionResult[];
  justification: string | null;
}

/** A second pending request for the same event, venue and overlapping period (L1). */
export class DuplicateBookingRequestError extends Error {
  constructor(readonly references: readonly string[]) {
    super("A pending request for this event and venue already overlaps this period.");
    this.name = "DuplicateBookingRequestError";
  }
}

interface Row {
  id: string;
  reference: string;
  event_id: string;
  venue_id: string;
  venue_name: string;
  starts_at: Date;
  ends_at: Date;
  layout: string;
  expected_attendance: number;
  facilities: string[];
  accessibility_features: string[];
  event_starts_at: Date;
  event_ends_at: Date;
  event_attendance: number;
  differs_from_event: boolean;
  replaces_booking_id: string | null;
  status: BookingRequestStatus;
  requested_by: string;
  requested_at: Date;
  withdrawn_by: string | null;
  withdrawn_at: Date | null;
  decided_by: string | null;
  decided_at: Date | null;
  booking_id: string | null;
  rejection_reason: string | null;
  suggested_alternative: string | null;
  requires_reconfirmation: boolean;
  suitability_status: SuitabilityStatus | null;
  suitability_reasons: ConditionResult[] | null;
  unsuitable_justification: string | null;

}

function toRequest(row: Row): BookingRequest {
  return {
    id: row.id,
    reference: row.reference,
    eventId: row.event_id,
    venueId: row.venue_id,
    venueName: row.venue_name,
    startsAt: row.starts_at.toISOString(),
    endsAt: row.ends_at.toISOString(),
    layout: row.layout,
    expectedAttendance: row.expected_attendance,
    facilities: row.facilities,
    accessibilityFeatures: row.accessibility_features,
    eventStartsAt: row.event_starts_at.toISOString(),
    eventEndsAt: row.event_ends_at.toISOString(),
    eventAttendance: row.event_attendance,
    differsFromEvent: row.differs_from_event,
    replacesBookingId: row.replaces_booking_id,
    status: row.status,
    requestedBy: row.requested_by,
    requestedAt: row.requested_at.toISOString(),
    withdrawnBy: row.withdrawn_by,
    withdrawnAt: row.withdrawn_at?.toISOString() ?? null,
    decidedBy: row.decided_by,
    decidedAt: row.decided_at?.toISOString() ?? null,
    bookingId: row.booking_id,
    rejectionReason: row.rejection_reason,
    suggestedAlternative: row.suggested_alternative,
    requiresReconfirmation: row.requires_reconfirmation,
    suitabilityStatus: row.suitability_status,
    suitabilityReasons: row.suitability_reasons,
    justification: row.unsuitable_justification,

  };
}

const COLUMNS = (db: Db) => db`
  r.id, r.reference, r.event_id, r.venue_id, v.name as venue_name, r.starts_at, r.ends_at, r.layout,
  r.expected_attendance, r.facilities, r.accessibility_features, r.event_starts_at, r.event_ends_at,
  r.event_attendance, r.differs_from_event, r.replaces_booking_id, r.status, r.requested_by, r.requested_at,
  r.withdrawn_by, r.withdrawn_at, r.decided_by, r.decided_at, r.booking_id, r.rejection_reason, r.suggested_alternative,
  r.requires_reconfirmation, r.suitability_status, r.suitability_reasons, r.unsuitable_justification
`;

/**
 * Inserts a Pending request, or refuses it when the event already has a pending
 * request for the venue overlapping the period. The insert runs in a savepoint
 * so that, when the constraint refuses it, the transaction can still look up
 * what it overlapped and name it; that look-up only shapes the message.
 */
export async function insertBookingRequest(tx: TransactionSql, request: NewBookingRequest): Promise<BookingRequest> {
  try {
    const [inserted] = await tx.savepoint(
      (sp) => sp<{ id: string }[]>`
        insert into venue.booking_requests (
          event_id, venue_id, starts_at, ends_at, layout, expected_attendance, facilities, accessibility_features,
          event_starts_at, event_ends_at, event_attendance, differs_from_event, replaces_booking_id,
          suitability_status, suitability_reasons, unsuitable_justification,
          requested_by, created_by, updated_by
        ) values (
          ${request.eventId}, ${request.venueId}, ${request.startsAt}, ${request.endsAt}, ${request.layout},
          ${request.expectedAttendance}, ${request.facilities}, ${request.accessibilityFeatures},
          ${request.eventStartsAt}, ${request.eventEndsAt}, ${request.eventAttendance}, ${request.differsFromEvent},
          ${request.replacesBookingId}, ${request.suitabilityStatus}, ${sp.json(request.suitabilityReasons as never)},
          ${request.justification}, ${request.requestedBy}, ${request.requestedBy}, ${request.requestedBy}
        )
        returning id
      `,
    );
    return (await findBookingRequest(tx, inserted!.id))!;
  } catch (error) {
    if (!isDuplicatePending(error)) throw error;
    const overlapped = await tx<{ reference: string }[]>`
      select reference from venue.booking_requests
      where event_id = ${request.eventId} and venue_id = ${request.venueId} and status = 'PENDING'
        and period && tstzrange(${request.startsAt}::timestamptz, ${request.endsAt}::timestamptz)
      order by starts_at, reference
    `;
    throw new DuplicateBookingRequestError(overlapped.map((row) => row.reference));
  }
}

export async function findBookingRequest(db: Db, id: string): Promise<BookingRequest | null> {
  const rows = await db<Row[]>`
    select ${COLUMNS(db)} from venue.booking_requests r join venue.venues v on v.id = r.venue_id
    where r.id = ${id}
  `;
  return rows[0] ? toRequest(rows[0]) : null;
}

/**
 * L2, M1, M2: holds the request's row until the transaction ends, so two
 * withdrawals or decisions can't both pass the Pending check.
 */
export async function lockBookingRequest(tx: TransactionSql, id: string): Promise<BookingRequest | null> {
  const rows = await tx<Row[]>`
    select ${COLUMNS(tx)} from venue.booking_requests r join venue.venues v on v.id = r.venue_id
    where r.id = ${id}
    for update of r
  `;
  return rows[0] ? toRequest(rows[0]) : null;
}

/** Every request of one event, oldest first (L1, L4). */
export async function listForEvent(db: Db, eventId: string): Promise<BookingRequest[]> {
  const rows = await db<Row[]>`
    select ${COLUMNS(db)} from venue.booking_requests r join venue.venues v on v.id = r.venue_id
    where r.event_id = ${eventId}
    order by r.requested_at, r.reference
  `;
  return rows.map(toRequest);
}

/** The pending requests for the venues this Venue Staff member looks after, soonest first (L1, M1). */
export async function listPendingForStaff(db: Db, staffUserId: string): Promise<BookingRequest[]> {
  const rows = await db<Row[]>`
    select ${COLUMNS(db)} from venue.booking_requests r join venue.venues v on v.id = r.venue_id
    where r.status = 'PENDING'
      and exists (select 1 from venue.venue_staff s where s.venue_id = r.venue_id and s.user_id = ${staffUserId})
    order by r.starts_at, r.reference
  `;
  return rows.map(toRequest);
}

/** L2: Withdrawn, with who and when. The row is kept. */
export async function withdrawBookingRequest(tx: TransactionSql, id: string, actorUserId: string): Promise<void> {
  await tx`
    update venue.booking_requests
    set status = 'WITHDRAWN', withdrawn_by = ${actorUserId}, withdrawn_at = now(),
        updated_at = now(), updated_by = ${actorUserId}
    where id = ${id}
  `;
}

/** The Venue Staff linked to a venue: the people a new request notifies (L1). */
export async function venueStaffIds(db: Db, venueId: string): Promise<string[]> {
  const rows = await db<{ user_id: string }[]>`
    select user_id from venue.venue_staff where venue_id = ${venueId} order by created_at, user_id
  `;
  return rows.map((row) => row.user_id);
}

/** CR-02 (L5): a booking a request may replace is one of the event's confirmed bookings flagged Requires Reconfirmation. */
export async function isReplaceableBooking(db: Db, slotId: string, eventId: string): Promise<boolean> {
  const rows = await db`
    select 1 from venue.venue_slots
    where id = ${slotId} and event_id = ${eventId} and status = 'CONFIRMED' and requires_reconfirmation
  `;
  return rows.length === 1;
}
