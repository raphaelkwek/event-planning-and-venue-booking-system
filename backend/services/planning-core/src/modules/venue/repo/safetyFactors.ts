import type { Sql, TransactionSql } from "postgres";

/**
 * U1 (CR-06) — what the Safety Officer weighs about an event's venues: each active booking or
 * hold with its period, the layout booked and that layout's capacity, and the venue's maximum
 * capacity and layouts. Read only, and only existing venue fields: emergency access, venue
 * restrictions and crowd movement are assessed outside the system (CQ-10), so the venue record
 * gains nothing. SQL against the venue schema only.
 */

type Db = Sql | TransactionSql;

export interface VenueSafetyFactor {
  /** The slot's id: the id a request for changes names to flag this arrangement. */
  bookingId: string;
  reference: string;
  status: "HELD" | "CONFIRMED";
  venueName: string;
  startsAt: string;
  endsAt: string;
  /** The layout booked, as the venue offers it; null when none is recorded or the venue no longer offers it. */
  layout: string | null;
  /** That layout's capacity, or the venue's maximum capacity when there is no such layout. */
  layoutCapacity: number;
  venueMaxCapacity: number;
  layouts: { name: string; capacity: number }[];
}

export async function venueSafetyFactors(db: Db, eventId: string): Promise<VenueSafetyFactor[]> {
  const rows = await db<
    {
      id: string;
      reference: string;
      status: "HELD" | "CONFIRMED";
      venue_name: string;
      starts_at: Date;
      ends_at: Date;
      layout: string | null;
      layout_capacity: number;
      max_capacity: number;
      layouts: { name: string; capacity: number }[];
    }[]
  >`
    select s.id, s.reference, s.status, v.name as venue_name, s.starts_at, s.ends_at,
           lc.name as layout, coalesce(lc.capacity, v.max_capacity) as layout_capacity,
           v.max_capacity, v.layouts
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
  `;
  return rows.map((row) => ({
    bookingId: row.id,
    reference: row.reference,
    status: row.status,
    venueName: row.venue_name,
    startsAt: row.starts_at.toISOString(),
    endsAt: row.ends_at.toISOString(),
    layout: row.layout,
    layoutCapacity: row.layout_capacity,
    venueMaxCapacity: row.max_capacity,
    layouts: row.layouts,
  }));
}
