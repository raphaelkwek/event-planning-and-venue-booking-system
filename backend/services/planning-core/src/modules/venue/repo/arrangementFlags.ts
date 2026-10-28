import type { Sql, TransactionSql } from "postgres";

/**
 * S3 (SPM-59) — the confirmed bookings an approved significant change is
 * assessed against, the flags the change module stores on them, and the flags
 * still outstanding on an event (AC8). SQL against the venue schema only.
 *
 * A flag is a column on the slot, which F5 reads (AC9), plus a row in
 * venue.arrangement_flags saying which change request set it and why. The
 * types below match the change module's ImpactBooking and BookingFlag, so it
 * passes its values straight in without this module importing it.
 */

type Db = Sql | TransactionSql;

export type BookingFlagKind = "REQUIRES_RECONFIRMATION" | "UNSUITABLE";

export interface ImpactBookingRow {
  id: string;
  reference: string;
  venueId: string;
  venueName: string;
  startsAt: string;
  endsAt: string;
  /** The layout of the request M1 approved for this booking; null when no request records one. */
  layout: string | null;
  /** That layout's capacity at the venue, or the venue's maximum capacity when it offers no such layout. */
  layoutCapacity: number;
  staffIds: string[];
}

export interface BookingFlagInput {
  bookingId: string;
  flag: BookingFlagKind;
  reason: string;
  details: Record<string, unknown>;
}

export interface OutstandingBookingFlag {
  bookingId: string;
  reference: string;
  venueName: string;
  flag: BookingFlagKind;
  reason: string;
  flaggedAt: string;
}

/**
 * The event's CONFIRMED bookings, soonest first, locked `for update` inside
 * the approval's transaction so nothing changes them between the assessment
 * and the flags. The caller has already locked the event.
 */
export async function bookingsForImpact(tx: TransactionSql, eventId: string): Promise<ImpactBookingRow[]> {
  const slots = await tx<
    {
      id: string;
      reference: string;
      venue_id: string;
      venue_name: string;
      starts_at: Date;
      ends_at: Date;
      layout: string | null;
      layout_capacity: number;
    }[]
  >`
    select s.id, s.reference, s.venue_id, v.name as venue_name, s.starts_at, s.ends_at, r.layout,
           coalesce(
             (select (l ->> 'capacity')::int from jsonb_array_elements(v.layouts) l
              where l ->> 'name' = r.layout limit 1),
             v.max_capacity
           ) as layout_capacity
    from venue.venue_slots s
    join venue.venues v on v.id = s.venue_id
    left join venue.booking_requests r on r.booking_id = s.id
    where s.event_id = ${eventId} and s.status = 'CONFIRMED'
    order by s.starts_at, s.reference
    for update of s
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

  return slots.map((slot) => ({
    id: slot.id,
    reference: slot.reference,
    venueId: slot.venue_id,
    venueName: slot.venue_name,
    startsAt: slot.starts_at.toISOString(),
    endsAt: slot.ends_at.toISOString(),
    layout: slot.layout,
    layoutCapacity: slot.layout_capacity,
    staffIds: staff.filter((member) => member.venue_id === slot.venue_id).map((member) => member.user_id),
  }));
}

/** Sets each flag's column on its booking and records why. Call inside the approval's transaction. */
export async function flagBookings(
  tx: TransactionSql,
  eventId: string,
  changeRequestId: string,
  flags: readonly BookingFlagInput[]
): Promise<void> {
  for (const flag of flags) {
    if (flag.flag === "UNSUITABLE") {
      await tx`update venue.venue_slots set unsuitable = true, updated_at = now() where id = ${flag.bookingId}`;
    } else {
      await tx`update venue.venue_slots set requires_reconfirmation = true, updated_at = now() where id = ${flag.bookingId}`;
    }
    await tx`
      insert into venue.arrangement_flags (slot_id, event_id, change_request_id, flag, reason, details)
      values (${flag.bookingId}, ${eventId}, ${changeRequestId}, ${flag.flag}, ${flag.reason},
              ${JSON.stringify(flag.details)}::text::jsonb)
    `;
  }
}

/**
 * The event's flags that still hold: the booking is HELD or CONFIRMED and its
 * column is still set. Oldest first.
 */
export async function outstandingBookingFlags(db: Db, eventId: string): Promise<OutstandingBookingFlag[]> {
  const rows = await db<
    { slot_id: string; reference: string; venue_name: string; flag: BookingFlagKind; reason: string; flagged_at: Date }[]
  >`
    select f.slot_id, s.reference, v.name as venue_name, f.flag, f.reason, f.flagged_at
    from venue.arrangement_flags f
    join venue.venue_slots s on s.id = f.slot_id
    join venue.venues v on v.id = s.venue_id
    where f.event_id = ${eventId}
      and s.status in ('HELD', 'CONFIRMED')
      and case f.flag when 'UNSUITABLE' then s.unsuitable else s.requires_reconfirmation end
    order by f.flagged_at, s.starts_at, s.reference, f.flag
  `;
  return rows.map((row) => ({
    bookingId: row.slot_id,
    reference: row.reference,
    venueName: row.venue_name,
    flag: row.flag,
    reason: row.reason,
    flaggedAt: row.flagged_at.toISOString(),
  }));
}
