import type { Sql } from "postgres";
import type { Db } from "./seats.js";

/**
 * R1 — each event's confirmed venues, as attendees see them: name and location
 * (migration 0002). Built from the approval the seats come from (M1).
 */

export interface ApprovedVenue {
  eventId: string;
  bookingId: string;
  venueId: string;
  venueName: string;
  venueLocation: string | null;
  layout: string;
  layoutCapacity: number;
  startsAt: string;
  endsAt: string;
}

export interface PublicVenue {
  name: string;
  location: string | null;
}

/** Records an approved booking's venue. Idempotent on the booking. */
export async function recordVenue(db: Db, venue: ApprovedVenue): Promise<void> {
  const sql = db as Sql;
  await sql`
    insert into registration.event_venues (
      event_id, booking_id, venue_id, venue_name, venue_location, layout, layout_capacity, starts_at, ends_at
    ) values (
      ${venue.eventId}, ${venue.bookingId}, ${venue.venueId}, ${venue.venueName}, ${venue.venueLocation},
      ${venue.layout}, ${venue.layoutCapacity}, ${venue.startsAt}, ${venue.endsAt}
    )
    on conflict (booking_id) do nothing
  `;
}

/** CR-02: the booking an approval replaced is no longer one of the event's venues. */
export async function replaceVenue(db: Db, bookingId: string): Promise<void> {
  const sql = db as Sql;
  await sql`update registration.event_venues set status = 'REPLACED', updated_at = now() where booking_id = ${bookingId}`;
}

/** Each event's confirmed venues, in the order they are used, then by name. */
export async function venuesOf(db: Db, eventIds: readonly string[]): Promise<Map<string, PublicVenue[]>> {
  const venues = new Map<string, PublicVenue[]>(eventIds.map((id) => [id, []]));
  if (eventIds.length === 0) return venues;
  const sql = db as Sql;
  const rows = await sql<{ event_id: string; venue_name: string; venue_location: string | null }[]>`
    select event_id, venue_name, venue_location from registration.event_venues
    where event_id in ${sql(eventIds as string[])} and status = 'CONFIRMED'
    order by starts_at, venue_name, booking_id
  `;
  for (const row of rows) venues.get(row.event_id)!.push({ name: row.venue_name, location: row.venue_location });
  return venues;
}
