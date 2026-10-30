import type { Sql, TransactionSql } from "postgres";
import type { BlockingSlotStatus, UnavailabilityReasonType } from "@connectsphere/contracts";

/**
 * M1, M2 — Venue Staff decide a booking request. SQL against the venue schema
 * only. Whether an approval's booking overlaps another is the exclusion
 * constraint's decision (insertVenueSlot); the look-ups here only name what it
 * overlapped, or find recorded unavailability under the venue row lock.
 */

type Db = Sql | TransactionSql;

/** The reason CR-02 records on a disrupted booking an approved replacement releases. */
export const REPLACED = "replaced";

/** Only the Venue Staff linked to a venue decide its requests (M1, M2). */
export async function isVenueStaff(db: Db, venueId: string, userId: string): Promise<boolean> {
  const rows = await db`select 1 from venue.venue_staff where venue_id = ${venueId} and user_id = ${userId}`;
  return rows.length === 1;
}

export interface OverlappingBlock {
  id: string;
  reasonType: UnavailabilityReasonType;
  description: string;
  startsAt: string;
  /** Null for a block with no end (I5). */
  endsAt: string | null;
}

/**
 * M1: the venue's active unavailability overlapping the booking's occupied
 * period, soonest first. Called under the venue row lock, which I2 takes to
 * record a block, so no block can appear between this look-up and the insert.
 */
export async function activeBlocksOverlapping(
  tx: TransactionSql,
  venueId: string,
  startsAt: Date,
  endsAt: Date,
  setupMinutes: number,
  turnaroundMinutes: number,
): Promise<OverlappingBlock[]> {
  const rows = await tx<{ id: string; reason_type: UnavailabilityReasonType; description: string; starts_at: Date; ends_at: Date | null }[]>`
    select id, reason_type, description, starts_at, ends_at from venue.unavailability_blocks
    where venue_id = ${venueId} and status = 'ACTIVE'
      and period && venue.occupied_period(${startsAt}::timestamptz, ${endsAt}::timestamptz, ${setupMinutes}::int, ${turnaroundMinutes}::int)
    order by starts_at, id
  `;
  return rows.map((row) => ({
    id: row.id,
    reasonType: row.reason_type,
    description: row.description,
    startsAt: row.starts_at.toISOString(),
    endsAt: row.ends_at?.toISOString() ?? null,
  }));
}

export interface OverlappingBooking {
  eventId: string;
  status: BlockingSlotStatus;
  /** The other booking's occupied period, setup and turnaround included (CR-01). */
  occupiedFrom: string;
  occupiedUntil: string;
}

/**
 * M1, N1: the holds and confirmed bookings whose occupied periods overlap the
 * one given, soonest first. Only shapes the refusal's message: the exclusion
 * constraint has already decided.
 */
export async function bookingsOverlapping(
  tx: TransactionSql,
  venueId: string,
  startsAt: Date,
  endsAt: Date,
  setupMinutes: number,
  turnaroundMinutes: number,
): Promise<OverlappingBooking[]> {
  const rows = await tx<{ event_id: string; status: BlockingSlotStatus; occupied_from: Date; occupied_until: Date }[]>`
    select event_id, status, lower(blocked_period) as occupied_from, upper(blocked_period) as occupied_until
    from venue.venue_slots
    where venue_id = ${venueId} and status in ('HELD', 'CONFIRMED')
      and blocked_period && venue.occupied_period(${startsAt}::timestamptz, ${endsAt}::timestamptz, ${setupMinutes}::int, ${turnaroundMinutes}::int)
    order by lower(blocked_period), reference
  `;
  return rows.map((row) => ({
    eventId: row.event_id,
    status: row.status,
    occupiedFrom: row.occupied_from.toISOString(),
    occupiedUntil: row.occupied_until.toISOString(),
  }));
}

/** M1: Approved, pointing at its confirmed booking, with who and when. */
export async function approveBookingRequest(tx: TransactionSql, id: string, actorUserId: string, bookingId: string): Promise<void> {
  await tx`
    update venue.booking_requests
    set status = 'APPROVED', decided_by = ${actorUserId}, decided_at = now(), booking_id = ${bookingId},
        updated_at = now(), updated_by = ${actorUserId}
    where id = ${id}
  `;
}

/** M2: Rejected, with the reason, any suggested alternative, who and when. The venue stays free. */
export async function rejectBookingRequest(
  tx: TransactionSql,
  id: string,
  actorUserId: string,
  reason: string,
  suggestion: string | null,
): Promise<void> {
  await tx`
    update venue.booking_requests
    set status = 'REJECTED', decided_by = ${actorUserId}, decided_at = now(), rejection_reason = ${reason},
        suggested_alternative = ${suggestion}, updated_at = now(), updated_by = ${actorUserId}
    where id = ${id}
  `;
}

/**
 * CR-02: releases the disrupted booking an approved replacement takes over,
 * with the reason "replaced". The row is kept. False when it is no longer
 * confirmed, so there was nothing to release.
 */
export async function releaseReplacedBooking(tx: TransactionSql, slotId: string, actorUserId: string): Promise<boolean> {
  const rows = await tx`
    update venue.venue_slots
    set status = 'RELEASED', release_reason = ${REPLACED}, updated_at = now(), updated_by = ${actorUserId}
    where id = ${slotId} and status = 'CONFIRMED'
    returning id
  `;
  return rows.length === 1;
}
