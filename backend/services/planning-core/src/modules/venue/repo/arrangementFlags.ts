import type { Sql, TransactionSql } from "postgres";

/**
 * S3 (SPM-59) — the venue arrangements an approved significant change is
 * assessed against (confirmed bookings, held holds, pending booking requests),
 * the flags the change module stores on them, how a request's flags reach the
 * booking M1 confirms from it, and the flags still outstanding on an event
 * (AC8). SQL against the venue schema only.
 *
 * A flag is a column on the slot or request, which F5 reads (AC9), plus a row
 * in venue.arrangement_flags saying which change request set it and why. S3's
 * Requires Reconfirmation is `period_mismatch`, apart from I2's and H3's
 * `requires_reconfirmation`, which they clear when their own cause goes. The
 * types below match the change module's ImpactBooking and BookingFlag, so it
 * passes its values straight in without this module importing it.
 */

type Db = Sql | TransactionSql;

export type BookingFlagKind = "REQUIRES_RECONFIRMATION" | "UNSUITABLE";

/** A confirmed booking, a held hold (both venue slots), or a pending booking request. */
export type VenueArrangementKind = "BOOKING" | "HOLD" | "BOOKING_REQUEST";

export interface ImpactBookingRow {
  arrangement: VenueArrangementKind;
  /** The slot's id, or the request's. */
  id: string;
  reference: string;
  venueId: string;
  venueName: string;
  startsAt: string;
  endsAt: string;
  /** The layout booked or requested, as the venue offers it; null when none is recorded or the venue no longer offers it. */
  layout: string | null;
  /** That layout's capacity at the venue, or the venue's maximum capacity when there is no such layout. */
  layoutCapacity: number;
  staffIds: string[];
}

export interface BookingFlagInput {
  /** The slot's id, or the request's when `arrangement` is BOOKING_REQUEST. */
  bookingId: string;
  /** Which kind of arrangement `bookingId` names; a slot (booking or hold) when left out. */
  arrangement?: VenueArrangementKind;
  flag: BookingFlagKind;
  reason: string;
  details: Record<string, unknown>;
}

export interface OutstandingBookingFlag {
  arrangement: VenueArrangementKind;
  /** The slot's id, or the request's. */
  id: string;
  reference: string;
  venueName: string;
  flag: BookingFlagKind;
  reason: string;
  flaggedAt: string;
}

/** AC8: the reason given for a Requires Reconfirmation flag I2 or H3 set, which records none of its own. */
export function availabilityChangedReason(arrangement: VenueArrangementKind): string {
  const noun = arrangement === "BOOKING" ? "booking" : arrangement === "HOLD" ? "hold" : "booking request";
  return `The venue's availability changed after this ${noun} was made; Venue Staff must reconfirm it.`;
}

// One arrangement as read. A layout is matched to the venue's without regard to case or
// surrounding spaces; with no match, layout is null and the capacity the venue's maximum.
type ArrangementRow = {
  arrangement: VenueArrangementKind;
  id: string;
  reference: string;
  venue_id: string;
  venue_name: string;
  starts_at: Date;
  ends_at: Date;
  layout: string | null;
  layout_capacity: number;
};

/**
 * The event's pending booking requests, then its held and confirmed slots,
 * each locked `for update` inside the approval's transaction so nothing changes
 * them between the assessment and the flags. Requests are locked first, the
 * order M1 takes a request and then its hold's slot. A request converted from
 * a hold whose slot is still HELD is left out: the hold's slot stands for it,
 * and M1 confirms that slot. Bookings first, then holds, then requests, each
 * soonest first. The caller has already locked the event.
 */
export async function bookingsForImpact(tx: TransactionSql, eventId: string): Promise<ImpactBookingRow[]> {
  const requests = await tx<ArrangementRow[]>`
    select 'BOOKING_REQUEST' as arrangement, r.id, r.reference, r.venue_id, v.name as venue_name, r.starts_at, r.ends_at,
           lc.name as layout, coalesce(lc.capacity, v.max_capacity) as layout_capacity
    from venue.booking_requests r
    join venue.venues v on v.id = r.venue_id
    left join lateral (
      select l ->> 'name' as name, (l ->> 'capacity')::int as capacity
      from jsonb_array_elements(v.layouts) l
      where lower(btrim(l ->> 'name')) = lower(btrim(r.layout))
      limit 1
    ) lc on true
    where r.event_id = ${eventId} and r.status = 'PENDING'
      and not exists (
        select 1 from venue.holds h join venue.venue_slots hs on hs.id = h.slot_id
        where h.converted_request_id = r.id and hs.status = 'HELD'
      )
    order by r.starts_at, r.reference
    for update of r
  `;

  // A confirmed slot's layout is on the request M1 approved for it; a held slot's on the
  // request its hold was converted into, if it was.
  const slots = await tx<ArrangementRow[]>`
    select case s.status when 'HELD' then 'HOLD' else 'BOOKING' end as arrangement,
           s.id, s.reference, s.venue_id, v.name as venue_name, s.starts_at, s.ends_at,
           lc.name as layout, coalesce(lc.capacity, v.max_capacity) as layout_capacity
    from venue.venue_slots s
    join venue.venues v on v.id = s.venue_id
    left join lateral (
      select r.layout from venue.booking_requests r
      where r.booking_id = s.id
         or r.id = (select h.converted_request_id from venue.holds h where h.slot_id = s.id)
      order by r.booking_id is null, r.requested_at desc
      limit 1
    ) req on true
    left join lateral (
      select l ->> 'name' as name, (l ->> 'capacity')::int as capacity
      from jsonb_array_elements(v.layouts) l
      where lower(btrim(l ->> 'name')) = lower(btrim(req.layout))
      limit 1
    ) lc on true
    where s.event_id = ${eventId} and s.status in ('HELD', 'CONFIRMED')
    order by s.status = 'HELD', s.starts_at, s.reference
    for update of s
  `;

  const rows = [...slots, ...requests];
  const venueIds = [...new Set(rows.map((row) => row.venue_id))];
  const staff =
    venueIds.length === 0
      ? []
      : await tx<{ venue_id: string; user_id: string }[]>`
          select venue_id, user_id from venue.venue_staff
          where venue_id in ${tx(venueIds)}
          order by created_at, user_id
        `;

  return rows.map((row) => ({
    arrangement: row.arrangement,
    id: row.id,
    reference: row.reference,
    venueId: row.venue_id,
    venueName: row.venue_name,
    startsAt: row.starts_at.toISOString(),
    endsAt: row.ends_at.toISOString(),
    layout: row.layout,
    layoutCapacity: row.layout_capacity,
    staffIds: staff.filter((member) => member.venue_id === row.venue_id).map((member) => member.user_id),
  }));
}

/** Sets each flag's column on its slot or request and records why. Call inside the approval's transaction. */
export async function flagBookings(
  tx: TransactionSql,
  eventId: string,
  changeRequestId: string,
  flags: readonly BookingFlagInput[]
): Promise<void> {
  for (const flag of flags) {
    const unsuitable = flag.flag === "UNSUITABLE";
    if (flag.arrangement === "BOOKING_REQUEST") {
      if (unsuitable) await tx`update venue.booking_requests set unsuitable = true, updated_at = now() where id = ${flag.bookingId}`;
      else await tx`update venue.booking_requests set period_mismatch = true, updated_at = now() where id = ${flag.bookingId}`;
    } else if (unsuitable) {
      await tx`update venue.venue_slots set unsuitable = true, updated_at = now() where id = ${flag.bookingId}`;
    } else {
      await tx`update venue.venue_slots set period_mismatch = true, updated_at = now() where id = ${flag.bookingId}`;
    }
    const slotId = flag.arrangement === "BOOKING_REQUEST" ? null : flag.bookingId;
    const requestId = flag.arrangement === "BOOKING_REQUEST" ? flag.bookingId : null;
    await tx`
      insert into venue.arrangement_flags (slot_id, booking_request_id, event_id, change_request_id, flag, reason, details)
      values (${slotId}, ${requestId}, ${eventId}, ${changeRequestId}, ${flag.flag}, ${flag.reason},
              ${JSON.stringify(flag.details)}::text::jsonb)
    `;
  }
}

/**
 * M1: the booking confirmed from a request keeps the flags S3 set on the
 * request. Its columns are carried over (a flag already on the slot, as on a
 * converted hold's, stays) and its flag rows copied to the slot, keeping when
 * and why. Call inside M1's transaction, before the request is decided.
 */
export async function carryRequestFlagsToBooking(tx: TransactionSql, requestId: string, slotId: string): Promise<void> {
  await tx`
    update venue.venue_slots s
    set period_mismatch = s.period_mismatch or r.period_mismatch,
        unsuitable = s.unsuitable or r.unsuitable,
        updated_at = now()
    from venue.booking_requests r
    where r.id = ${requestId} and s.id = ${slotId} and (r.period_mismatch or r.unsuitable)
  `;
  await tx`
    insert into venue.arrangement_flags (slot_id, event_id, change_request_id, flag, reason, details, flagged_at)
    select ${slotId}::uuid, f.event_id, f.change_request_id, f.flag, f.reason, f.details, f.flagged_at
    from venue.arrangement_flags f
    where f.booking_request_id = ${requestId}
  `;
}

/**
 * Every flag that would hold back F5 on the event's live venue arrangements
 * (AC8, AC9). For S3's flags, the newest reason per arrangement and flag, while
 * its column is still set and the slot is HELD or CONFIRMED or the request
 * PENDING. For a Requires Reconfirmation I2 or H3 set where S3 set none, a
 * general reason. Oldest first.
 */
export async function outstandingBookingFlags(db: Db, eventId: string): Promise<OutstandingBookingFlag[]> {
  const rows = await db<
    {
      arrangement: VenueArrangementKind;
      id: string;
      reference: string;
      venue_name: string;
      flag: BookingFlagKind;
      reason: string | null;
      flagged_at: Date;
    }[]
  >`
    select * from (
      (select distinct on (f.slot_id, f.flag)
             case s.status when 'HELD' then 'HOLD' else 'BOOKING' end as arrangement, s.id, s.reference,
             v.name as venue_name, f.flag, f.reason, f.flagged_at, s.starts_at
      from venue.arrangement_flags f
      join venue.venue_slots s on s.id = f.slot_id
      join venue.venues v on v.id = s.venue_id
      where s.event_id = ${eventId}
        and s.status in ('HELD', 'CONFIRMED')
        and case f.flag when 'UNSUITABLE' then s.unsuitable else s.period_mismatch end
      order by f.slot_id, f.flag, f.flagged_at desc, f.id)

      union all

      (select distinct on (f.booking_request_id, f.flag)
             'BOOKING_REQUEST', r.id, r.reference, v.name, f.flag, f.reason, f.flagged_at, r.starts_at
      from venue.arrangement_flags f
      join venue.booking_requests r on r.id = f.booking_request_id
      join venue.venues v on v.id = r.venue_id
      where r.event_id = ${eventId}
        and r.status = 'PENDING'
        and case f.flag when 'UNSUITABLE' then r.unsuitable else r.period_mismatch end
      order by f.booking_request_id, f.flag, f.flagged_at desc, f.id)

      union all

      -- I2's and H3's Requires Reconfirmation, where S3's is not set as well.
      select case s.status when 'HELD' then 'HOLD' else 'BOOKING' end, s.id, s.reference, v.name,
             'REQUIRES_RECONFIRMATION', null,
             coalesce(greatest(
               (select max(d.created_at) from venue.block_disruptions d where d.slot_id = s.id),
               (select max(c.created_at) from venue.buffer_conflicts c where c.slot_id = s.id and c.cleared_at is null)
             ), s.updated_at),
             s.starts_at
      from venue.venue_slots s
      join venue.venues v on v.id = s.venue_id
      where s.event_id = ${eventId} and s.status in ('HELD', 'CONFIRMED')
        and s.requires_reconfirmation and not s.period_mismatch

      union all

      select 'BOOKING_REQUEST', r.id, r.reference, v.name, 'REQUIRES_RECONFIRMATION', null,
             coalesce(greatest(
               (select max(d.created_at) from venue.block_disruptions d where d.booking_request_id = r.id),
               (select max(c.created_at) from venue.buffer_conflicts c where c.booking_request_id = r.id and c.cleared_at is null)
             ), r.updated_at),
             r.starts_at
      from venue.booking_requests r
      join venue.venues v on v.id = r.venue_id
      where r.event_id = ${eventId} and r.status = 'PENDING'
        and r.requires_reconfirmation and not r.period_mismatch
    ) outstanding
    order by flagged_at, starts_at, reference, flag
  `;
  return rows.map((row) => ({
    arrangement: row.arrangement,
    id: row.id,
    reference: row.reference,
    venueName: row.venue_name,
    flag: row.flag,
    reason: row.reason ?? availabilityChangedReason(row.arrangement),
    flaggedAt: row.flagged_at.toISOString(),
  }));
}
