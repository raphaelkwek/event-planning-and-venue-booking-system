import type { Sql, TransactionSql } from "postgres";
import type { BookingRequestStatus, UnavailabilityReasonType, VenueSlotStatus } from "@connectsphere/contracts";

/**
 * L5 — an event's bookings, as its coordinator re-plans them. SQL against the
 * venue schema only. Each booking comes with the active blocks that disrupt it
 * (I2) and the replacement requests raised for it (CR-02), so the coordinator
 * sees why it requires reconfirmation and what has been asked for instead.
 */

type Db = Sql | TransactionSql;

export interface BookingDisruption {
  blockId: string;
  reasonType: UnavailabilityReasonType;
  description: string;
  startsAt: string;
  endsAt: string;
}

export interface ReplacementRequest {
  id: string;
  reference: string;
  status: BookingRequestStatus;
  venueName: string;
}

export interface EventBooking {
  id: string;
  reference: string;
  venueId: string;
  venueName: string;
  startsAt: string;
  endsAt: string;
  status: VenueSlotStatus;
  requiresReconfirmation: boolean;
  /** CR-02: "replaced" once an approved replacement released it. */
  releaseReason: string | null;
  disruptions: BookingDisruption[];
  /** H3-T10, H3-T11: the live bookings, holds and pending requests the venue's times now make it overlap, soonest first. */
  overlaps: string[];
  replacements: ReplacementRequest[];
}

/** The event's confirmed bookings, soonest first; released ones too, so a replaced booking's record stays visible. */
export async function listBookingsForEvent(db: Db, eventId: string): Promise<EventBooking[]> {
  const rows = await db<
    {
      id: string;
      reference: string;
      venue_id: string;
      venue_name: string;
      starts_at: Date;
      ends_at: Date;
      status: VenueSlotStatus;
      requires_reconfirmation: boolean;
      release_reason: string | null;
      disruptions: { blockId: string; reasonType: UnavailabilityReasonType; description: string; startsAt: string; endsAt: string }[];
      overlaps: string[];
      replacements: ReplacementRequest[];
    }[]
  >`
    select s.id, s.reference, s.venue_id, v.name as venue_name, s.starts_at, s.ends_at, s.status,
           -- I2's and H3's flag, or S3's when an approved change moved the event (period_mismatch).
           (s.requires_reconfirmation or s.period_mismatch) as requires_reconfirmation, s.release_reason,
           coalesce((
             select json_agg(json_build_object(
                      'blockId', b.id, 'reasonType', b.reason_type, 'description', b.description,
                      'startsAt', b.starts_at, 'endsAt', b.ends_at) order by b.starts_at, b.id)
             from venue.block_disruptions d join venue.unavailability_blocks b on b.id = d.block_id
             where d.slot_id = s.id and b.status = 'ACTIVE'
           ), '[]'::json) as disruptions,
           coalesce((
             select json_agg(o.reference order by o.starts_at, o.reference)
             from (
               select os.reference, os.starts_at
               from venue.buffer_conflicts c join venue.venue_slots os on os.id = c.other_slot_id
               where c.slot_id = s.id and c.cleared_at is null and os.status in ('HELD', 'CONFIRMED')
               union all
               -- H3-T11: a pending request the venue's times now make it overlap.
               select orq.reference, orq.starts_at
               from venue.buffer_conflicts c join venue.booking_requests orq on orq.id = c.other_booking_request_id
               where c.slot_id = s.id and c.cleared_at is null and orq.status = 'PENDING'
             ) o
           ), '[]'::json) as overlaps,
           coalesce((
             select json_agg(json_build_object(
                      'id', r.id, 'reference', r.reference, 'status', r.status, 'venueName', rv.name)
                      order by r.requested_at, r.reference)
             from venue.booking_requests r join venue.venues rv on rv.id = r.venue_id
             where r.replaces_booking_id = s.id
           ), '[]'::json) as replacements
    from venue.venue_slots s join venue.venues v on v.id = s.venue_id
    where s.event_id = ${eventId}
      and (
        s.status = 'CONFIRMED'
        -- A released slot that was a booking: released for a reason (L5's replacement, F4's
        -- cancellation) or confirmed by an approval. A hold's slot, held or released, is
        -- shown once, in the event's holds (L3), not here as well (L4-T5).
        or (s.status = 'RELEASED' and (
              s.release_reason is not null
              or exists (select 1 from venue.booking_requests r where r.booking_id = s.id and r.status = 'APPROVED')))
      )
    order by s.starts_at, s.reference
  `;
  return rows.map((row) => ({
    id: row.id,
    reference: row.reference,
    venueId: row.venue_id,
    venueName: row.venue_name,
    startsAt: row.starts_at.toISOString(),
    endsAt: row.ends_at.toISOString(),
    status: row.status,
    requiresReconfirmation: row.requires_reconfirmation,
    releaseReason: row.release_reason,
    // json_build_object writes timestamps in the session's zone; normalise them to UTC instants.
    disruptions: row.disruptions.map((d) => ({ ...d, startsAt: new Date(d.startsAt).toISOString(), endsAt: new Date(d.endsAt).toISOString() })),
    overlaps: row.overlaps,
    replacements: row.replacements,
  }));
}
