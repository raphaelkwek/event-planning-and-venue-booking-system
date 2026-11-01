import type { Sql } from "postgres";

/**
 * Removes the venues `createdBy` made and everything that hangs off them:
 * S3's arrangement flags, I2's blocks and what they disrupted, holds, booking
 * requests and their outbox messages, slots and staff links. Flags go first
 * because they reference slots and requests. Test-only.
 */
export async function cleanVenueFixtures(sql: Sql, createdBy: string): Promise<void> {
  const venues = sql`select id from venue.venues where created_by = ${createdBy}`;
  await sql`delete from venue.arrangement_flags where slot_id in (select id from venue.venue_slots where venue_id in (${venues}))
    or booking_request_id in (select id from venue.booking_requests where venue_id in (${venues}))`;
  await sql`delete from venue.block_disruptions where block_id in (select id from venue.unavailability_blocks where venue_id in (${venues}))`;
  await sql`delete from venue.unavailability_blocks where venue_id in (${venues})`;
  await sql`delete from venue.holds where venue_id in (${venues})`;
  await sql`delete from venue.outbox where message_key in (select id::text from venue.booking_requests where venue_id in (${venues}))`;
  await sql`delete from venue.booking_requests where venue_id in (${venues})`;
  await sql`delete from venue.venue_slots where venue_id in (${venues})`;
  await sql`delete from venue.venue_staff where venue_id in (${venues})`;
  await sql`delete from venue.venues where created_by = ${createdBy}`;
}
