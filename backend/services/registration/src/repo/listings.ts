import type { Sql } from "postgres";
import type { EventListingChanged, EventCancelled } from "../consumer/listingMessages.js";
import type { Db } from "./seats.js";

/**
 * R1 — the registration service's copy of each event's published fields and
 * registration settings (migration 0002), built from planning-core's messages.
 * The registration schema only, one function per query.
 */

export interface Listing {
  eventId: string;
  eventReference: string;
  name: string;
  description: string | null;
  ownerId: string;
  status: string;
  startsAt: string | null;
  endsAt: string | null;
  registrationRequired: boolean;
  registrationOpensAt: string | null;
  registrationClosesAt: string | null;
  withdrawalDeadlineAt: string | null;
}

interface ListingRow {
  event_id: string;
  event_reference: string;
  name: string;
  description: string | null;
  owner_id: string;
  status: string;
  starts_at: Date | null;
  ends_at: Date | null;
  registration_required: boolean;
  registration_opens_at: Date | null;
  registration_closes_at: Date | null;
  withdrawal_deadline_at: Date | null;
}

const iso = (value: Date | null) => value?.toISOString() ?? null;

function toListing(row: ListingRow): Listing {
  return {
    eventId: row.event_id,
    eventReference: row.event_reference,
    name: row.name,
    description: row.description,
    ownerId: row.owner_id,
    status: row.status,
    startsAt: iso(row.starts_at),
    endsAt: iso(row.ends_at),
    registrationRequired: row.registration_required,
    registrationOpensAt: iso(row.registration_opens_at),
    registrationClosesAt: iso(row.registration_closes_at),
    withdrawalDeadlineAt: iso(row.withdrawal_deadline_at),
  };
}

/**
 * Applies an event.listing-changed snapshot unless a newer one is already
 * applied (messages about one event share a partition, so this only matters for
 * a redelivery out of order). A cancelled event stays cancelled: Cancelled is
 * terminal (F1). True when the snapshot was applied.
 */
export async function applyListing(db: Db, data: EventListingChanged): Promise<boolean> {
  const sql = db as Sql;
  const rows = await sql`
    insert into registration.event_listings (
      event_id, event_reference, name, description, owner_id, status, starts_at, ends_at,
      registration_required, registration_opens_at, registration_closes_at, withdrawal_deadline_at, source_changed_at
    ) values (
      ${data.eventId}, ${data.eventReference}, ${data.eventName}, ${data.description}, ${data.ownerId}, ${data.status},
      ${data.proposedStartAt}, ${data.proposedEndAt}, ${data.registrationRequired}, ${data.registrationOpensAt},
      ${data.registrationClosesAt}, ${data.withdrawalDeadlineAt}, ${data.changedAt}
    )
    on conflict (event_id) do update set
      event_reference = excluded.event_reference,
      name = excluded.name,
      description = excluded.description,
      owner_id = excluded.owner_id,
      status = excluded.status,
      starts_at = excluded.starts_at,
      ends_at = excluded.ends_at,
      registration_required = excluded.registration_required,
      registration_opens_at = excluded.registration_opens_at,
      registration_closes_at = excluded.registration_closes_at,
      withdrawal_deadline_at = excluded.withdrawal_deadline_at,
      source_changed_at = excluded.source_changed_at,
      updated_at = now()
    where registration.event_listings.source_changed_at <= excluded.source_changed_at
      and registration.event_listings.status <> 'CANCELLED'
    returning event_id
  `;
  return rows.length > 0;
}

/**
 * F3's event.cancelled: the event is Cancelled, so R1 no longer lists it and R2
 * refuses it. An event this service has not heard of yet is recorded as
 * cancelled, so a listing published earlier and delivered later cannot list it.
 */
export async function closeListing(db: Db, data: EventCancelled): Promise<void> {
  const sql = db as Sql;
  await sql`
    insert into registration.event_listings (
      event_id, event_reference, name, owner_id, status, registration_required, source_changed_at
    ) values (
      ${data.eventId}, ${data.eventReference}, ${data.eventName}, ${data.ownerId}, 'CANCELLED', false, ${data.cancelledAt}
    )
    on conflict (event_id) do update set
      status = 'CANCELLED',
      source_changed_at = greatest(registration.event_listings.source_changed_at, excluded.source_changed_at),
      updated_at = now()
  `;
}

export async function findListing(db: Db, eventId: string): Promise<Listing | null> {
  const sql = db as Sql;
  const [row] = await sql<ListingRow[]>`select * from registration.event_listings where event_id = ${eventId}`;
  return row ? toListing(row) : null;
}

/** Several events' listings, keyed by event id; an event with none is left out. */
export async function listingsOf(db: Db, eventIds: readonly string[]): Promise<Map<string, Listing>> {
  if (eventIds.length === 0) return new Map();
  const sql = db as Sql;
  const rows = await sql<ListingRow[]>`select * from registration.event_listings where event_id in ${sql(eventIds as string[])}`;
  return new Map(rows.map((row) => [row.event_id, toListing(row)]));
}

/** Where a page of the open list starts: after this event, in start order. */
export interface ListingCursor {
  startsAt: string;
  eventId: string;
}

/**
 * R1: the events open for registration at `now` (Confirmed, registration
 * enabled, closing not passed: isListed's rule, applied in the query), soonest
 * first. One more than `limit` is returned, so the caller knows whether there
 * is a next page.
 */
export async function listOpenListings(db: Db, now: Date, limit: number, after: ListingCursor | null): Promise<Listing[]> {
  const sql = db as Sql;
  const rows = await sql<ListingRow[]>`
    select * from registration.event_listings
    where status = 'CONFIRMED' and registration_required
      and registration_closes_at >= ${now}
      and starts_at is not null
      ${after ? sql`and (starts_at, event_id) > (${after.startsAt}::timestamptz, ${after.eventId}::uuid)` : sql``}
    order by starts_at, event_id
    limit ${limit + 1}
  `;
  return rows.map(toListing);
}
