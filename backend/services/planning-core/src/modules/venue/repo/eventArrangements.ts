import type { TransactionSql } from "postgres";

/**
 * F5 — an event's active venue arrangements, read live at the moment of
 * confirmation. SQL against the venue schema only. Active means a HELD or
 * CONFIRMED slot, or a PENDING booking request; released and expired slots and
 * decided or withdrawn requests are not arrangements any more.
 *
 * The rows are taken `for share`, inside the confirmation's transaction, so an
 * M1 decision, an I2 flag or an L2 withdrawal on them waits until the event's
 * status has changed, and the confirmation decides on what is still true when
 * it commits (implementation.md §4.7). The caller has already locked the event.
 */

/** I2's flag. S3 adds the unsuitable flag here once it stores one. */
export type VenueArrangementFlag = "REQUIRES_RECONFIRMATION";

export interface VenueArrangementBooking {
  id: string;
  reference: string;
  venueId: string;
  venueName: string;
  startsAt: string;
  endsAt: string;
  status: "HELD" | "CONFIRMED";
  flags: VenueArrangementFlag[];
  /** The Venue Staff who look after the venue: who F5 notifies. */
  staffIds: string[];
}

export interface VenueArrangementRequest {
  id: string;
  reference: string;
  venueName: string;
  startsAt: string;
  endsAt: string;
  flags: VenueArrangementFlag[];
}

export interface VenueArrangements {
  bookings: VenueArrangementBooking[];
  requests: VenueArrangementRequest[];
}

const flagsOf = (requiresReconfirmation: boolean): VenueArrangementFlag[] =>
  requiresReconfirmation ? ["REQUIRES_RECONFIRMATION"] : [];

export async function venueArrangementsForEvent(tx: TransactionSql, eventId: string): Promise<VenueArrangements> {
  const slots = await tx<
    {
      id: string;
      reference: string;
      venue_id: string;
      venue_name: string;
      starts_at: Date;
      ends_at: Date;
      status: "HELD" | "CONFIRMED";
      requires_reconfirmation: boolean;
    }[]
  >`
    select s.id, s.reference, s.venue_id, v.name as venue_name, s.starts_at, s.ends_at, s.status,
           s.requires_reconfirmation
    from venue.venue_slots s join venue.venues v on v.id = s.venue_id
    where s.event_id = ${eventId} and s.status in ('HELD', 'CONFIRMED')
    order by s.starts_at, s.reference
    for share of s
  `;

  const requests = await tx<
    { id: string; reference: string; venue_name: string; starts_at: Date; ends_at: Date; requires_reconfirmation: boolean }[]
  >`
    select r.id, r.reference, v.name as venue_name, r.starts_at, r.ends_at, r.requires_reconfirmation
    from venue.booking_requests r join venue.venues v on v.id = r.venue_id
    where r.event_id = ${eventId} and r.status = 'PENDING'
    order by r.starts_at, r.reference
    for share of r
  `;

  const venueIds = [...new Set(slots.map((slot) => slot.venue_id))];
  const staff =
    venueIds.length === 0
      ? []
      : await tx<{ venue_id: string; user_id: string }[]>`
          select venue_id, user_id from venue.venue_staff
          where venue_id in ${tx(venueIds)}
          order by created_at, user_id
        `;

  return {
    bookings: slots.map((slot) => ({
      id: slot.id,
      reference: slot.reference,
      venueId: slot.venue_id,
      venueName: slot.venue_name,
      startsAt: slot.starts_at.toISOString(),
      endsAt: slot.ends_at.toISOString(),
      status: slot.status,
      flags: flagsOf(slot.requires_reconfirmation),
      staffIds: staff.filter((member) => member.venue_id === slot.venue_id).map((member) => member.user_id),
    })),
    requests: requests.map((request) => ({
      id: request.id,
      reference: request.reference,
      venueName: request.venue_name,
      startsAt: request.starts_at.toISOString(),
      endsAt: request.ends_at.toISOString(),
      flags: flagsOf(request.requires_reconfirmation),
    })),
  };
}
