import type { TransactionSql } from "postgres";
import { withdrawBookingRequest } from "./bookingRequests.js";
import { releaseHeldSlotForRequest, releaseHoldsForEvent } from "./holds.js";
import { lockVenue } from "./slots.js";

/**
 * L4 (CR-03), for F4: cancelling an event releases every one of its venue
 * arrangements, at every venue. SQL against the venue schema only. Nothing is
 * deleted (implementation.md §4.3): bookings and holds become Released and
 * pending requests Withdrawn, each recording who and when.
 */

/** Why a booking released by cancellation was released, as L5's replacement records `replaced`. */
export const EVENT_CANCELLED = "event cancelled";

export interface ReleasedArrangements {
  /** Each released booking's, hold's and withdrawn request's reference, soonest or oldest first. */
  bookings: string[];
  holds: string[];
  requests: string[];
}

/**
 * The venues where the event has a live arrangement (a held or confirmed slot, a pending request, or a
 * requested or held hold), in ascending id.
 */
export async function liveVenueIdsForEvent(tx: TransactionSql, eventId: string): Promise<string[]> {
  const venues = await tx<{ venue_id: string }[]>`
    select venue_id from venue.venue_slots where event_id = ${eventId} and status in ('HELD', 'CONFIRMED')
    union
    select venue_id from venue.booking_requests where event_id = ${eventId} and status = 'PENDING'
    union
    select venue_id from venue.holds where event_id = ${eventId} and status in ('REQUESTED', 'HELD')
    order by venue_id
  `;
  return venues.map((row) => row.venue_id);
}

/**
 * Locks the row of every venue where the event has a live arrangement, in ascending id, as every booking
 * change at a venue does (§4.6 rule 1), and returns their ids. F4 calls this before it locks the event,
 * so its locks are taken venue, then event, then slot: the same order as I2's block (venue, then the
 * events it returns to Planning) and M1's approval (venue, then slot). Once it holds the event, F4 reads
 * the venues again (`liveVenueIdsForEvent`) and starts over if the event gained one in between.
 */
export async function lockVenuesForEvent(tx: TransactionSql, eventId: string): Promise<string[]> {
  const venueIds = await liveVenueIdsForEvent(tx, eventId);
  for (const venueId of venueIds) await lockVenue(tx, venueId);
  return venueIds;
}

/**
 * Releases the event's confirmed bookings and live holds, and withdraws its
 * pending requests, giving back any period a converted hold still holds. Call
 * inside F4's cancellation transaction. Each venue's row lock is taken first,
 * in a fixed order, as every booking change at a venue does (§4.6 rule 1), so
 * no approval or block at those venues interleaves.
 */
export async function releaseVenueArrangementsForEvent(tx: TransactionSql, eventId: string, actorUserId: string): Promise<ReleasedArrangements> {
  await lockVenuesForEvent(tx, eventId);

  const holds = await releaseHoldsForEvent(tx, eventId, actorUserId);

  const pending = await tx<{ id: string; reference: string }[]>`
    select id, reference from venue.booking_requests
    where event_id = ${eventId} and status = 'PENDING'
    order by requested_at, reference
    for update
  `;
  for (const { id } of pending) {
    await releaseHeldSlotForRequest(tx, id, actorUserId);
    await withdrawBookingRequest(tx, id, actorUserId);
  }

  const bookings = await tx<{ reference: string }[]>`
    with released as (
      update venue.venue_slots
      set status = 'RELEASED', release_reason = ${EVENT_CANCELLED}, updated_at = now(), updated_by = ${actorUserId}
      where event_id = ${eventId} and status = 'CONFIRMED'
      returning reference, starts_at
    )
    select reference from released order by starts_at, reference
  `;

  return { bookings: bookings.map((b) => b.reference), holds, requests: pending.map((r) => r.reference) };
}

/** A hold or booking request F4 released, with its venue and that venue's Venue Staff, for `event.cancelled`. */
export interface ReleasedAtVenue {
  reference: string;
  venueId: string;
  venueName: string;
  startsAt: string;
  endsAt: string;
  staffIds: string[];
}

/**
 * CQ-06 (review of F4): the holds and pending requests `releaseVenueArrangementsForEvent` released,
 * by the references it returned, each with its venue and the staff who look after it, so the
 * cancellation's message can tell them as it tells a booked venue's staff. In the order given.
 */
export async function releasedForVenueStaff(
  tx: TransactionSql,
  eventId: string,
  released: { holds: readonly string[]; requests: readonly string[] },
): Promise<{ holds: ReleasedAtVenue[]; requests: ReleasedAtVenue[] }> {
  type Row = { reference: string; venue_id: string; venue_name: string; starts_at: Date; ends_at: Date };
  const holds =
    released.holds.length === 0
      ? []
      : await tx<Row[]>`
          select h.reference, h.venue_id, v.name as venue_name, h.starts_at, h.ends_at
          from venue.holds h join venue.venues v on v.id = h.venue_id
          where h.event_id = ${eventId} and h.reference in ${tx(released.holds as string[])}
        `;
  const requests =
    released.requests.length === 0
      ? []
      : await tx<Row[]>`
          select r.reference, r.venue_id, v.name as venue_name, r.starts_at, r.ends_at
          from venue.booking_requests r join venue.venues v on v.id = r.venue_id
          where r.event_id = ${eventId} and r.reference in ${tx(released.requests as string[])}
        `;
  const venueIds = [...new Set([...holds, ...requests].map((row) => row.venue_id))];
  const staff =
    venueIds.length === 0
      ? []
      : await tx<{ venue_id: string; user_id: string }[]>`
          select venue_id, user_id from venue.venue_staff where venue_id in ${tx(venueIds)} order by created_at, user_id
        `;
  const present = (rows: Row[], order: readonly string[]): ReleasedAtVenue[] =>
    order.flatMap((reference) => {
      const row = rows.find((candidate) => candidate.reference === reference);
      return row
        ? [
            {
              reference: row.reference,
              venueId: row.venue_id,
              venueName: row.venue_name,
              startsAt: row.starts_at.toISOString(),
              endsAt: row.ends_at.toISOString(),
              staffIds: staff.filter((member) => member.venue_id === row.venue_id).map((member) => member.user_id),
            },
          ]
        : [];
    });
  return { holds: present(holds, released.holds), requests: present(requests, released.requests) };
}
