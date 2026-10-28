import { randomUUID } from "node:crypto";
import type { Sql } from "postgres";
import { EVENT_END, EVENT_START } from "./eventDates.js";
import { createBulkType, insertLineDirect } from "./lineFixtures.js";
import { reserveLine } from "../../src/modules/equipment/repo/reservations.js";

/**
 * FX-S3's arrangements (tests/S3/README.md), written directly: the S3 repository and card tests build
 * the same venues, bookings and reservation. Cleanup is cleanVenueFixtures and cleanLineFixtures.
 */

/** A venue with one layout, looked after by `staffId`; the name is made unique so test files do not clash. */
export async function newVenue(sql: Sql, staffId: string, name: string, layout: string, capacity: number) {
  const unique = `${name} ${randomUUID().slice(0, 8)}`;
  const [row] = await sql<{ id: string }[]>`
    insert into venue.venues (name, building, max_capacity, layouts, operating_hours, created_by, updated_by)
    values (${unique}, 'S3 Test Building', ${capacity}, ${sql.json([{ name: layout, capacity }])}, ${sql.json({})}, ${staffId}, ${staffId})
    returning id
  `;
  await sql`insert into venue.venue_staff (venue_id, user_id, created_by) values (${row!.id}, ${staffId}, ${staffId})`;
  return { id: row!.id, name: unique };
}

/** A confirmed booking for exactly the event's period, from an approved request (attendance 80) in `layout`. */
export async function confirmedBooking(
  sql: Sql,
  options: { staffId: string; requestedBy: string; venueId: string; eventId: string; reference: string; layout: string }
) {
  const { staffId, requestedBy, venueId, eventId, reference, layout } = options;
  const [slot] = await sql<{ id: string }[]>`
    insert into venue.venue_slots (venue_id, event_id, reference, starts_at, ends_at, status, created_by, updated_by)
    values (${venueId}, ${eventId}, ${reference}, ${EVENT_START}, ${EVENT_END}, 'CONFIRMED', ${staffId}, ${staffId})
    returning id
  `;
  await sql`
    insert into venue.booking_requests (
      event_id, venue_id, starts_at, ends_at, layout, expected_attendance, event_starts_at, event_ends_at,
      event_attendance, differs_from_event, requested_by, status, decided_by, decided_at, booking_id
    ) values (
      ${eventId}, ${venueId}, ${EVENT_START}, ${EVENT_END}, ${layout}, 80, ${EVENT_START}, ${EVENT_END}, 80, false,
      ${requestedBy}, 'APPROVED', ${staffId}, now(), ${slot!.id}
    )
  `;
  return slot!.id;
}

/** A reservation of `quantity` chairs for exactly the event's period, made by `reservedBy` (Technical Support). */
export async function reservedChairs(
  sql: Sql,
  options: { event: { id: string; reference: string }; requestedBy: string; reservedBy: string; quantity: number; suffix: string }
) {
  const { event, requestedBy, reservedBy, quantity, suffix } = options;
  const chairs = await createBulkType(sql, reservedBy, `S3 Chairs ${suffix}`, 20);
  const lineId = await insertLineDirect(sql, { event, equipmentTypeId: chairs.id, requestedBy, status: "CONFIRMED", quantity });
  const reserved = await sql.begin((tx) =>
    reserveLine(tx, lineId, { quantity: null, partial: false }, { userId: reservedBy, role: "TECH_SUPPORT_STAFF" })
  );
  if (!reserved.ok) throw new Error(`fixture reserve failed: ${reserved.code}`);
  return { chairs, lineId, reservationId: reserved.reservation.id };
}
