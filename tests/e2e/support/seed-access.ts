import { expect, type Page } from "@playwright/test";
import { ACCOUNTS, type AccountKey } from "./accounts.js";
import { must } from "./api.js";
import { query, sendFromConsole } from "./seed-events.js";
import type { EventRow } from "./seed.js";

/**
 * Setup and reads for the access journeys (A3, E4, F1, F2, G1, L1 to L3): the cards that sign in
 * as a role that must be refused, send a request from the API console and then check, as the
 * cards' SQL editor steps do, that nothing was stored. Everything runs against the job's own
 * throwaway database (the Playwright config has already refused any other DATABASE_URL).
 */

/** What the API console showed for a request: its HTTP status and its body, as text and as JSON. */
export interface ConsoleResult {
  status: number;
  text: string;
  json: unknown;
}

/** Sends a request from the API console and reads the status and body it shows. */
export async function consoleCall(page: Page, method: string, path: string, body = ""): Promise<ConsoleResult> {
  const { status, body: shown } = await sendFromConsole(page, method, path, body);
  await expect(status).toHaveText(/^\d{3}\b/);
  const code = Number(/^(\d{3})\b/.exec((await status.innerText()).trim())?.[1]);
  const text = await shown.innerText();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: code, text, json };
}

/** The error envelope's code and message from a console result (implementation.md §5). */
export function refusal(result: ConsoleResult): { code: string | undefined; message: string | undefined } {
  const error = (result.json as { error?: { code?: string; message?: string } } | null)?.error;
  return { code: error?.code, message: error?.message };
}

/** The Lead moves an approved or planned event to another coordinator (E4). */
export function reassign(eventId: string, to: AccountKey) {
  return must("lead", "POST", `/api/v1/events/${eventId}/reassignment`, { coordinatorId: ACCOUNTS[to].id });
}

/** The organiser answers a clarification request (D3), which puts the request back under review. */
export function respondToClarification(eventId: string, message = "Answered.") {
  return must("organiser", "POST", `/api/v1/events/${eventId}/clarifications/respond`, { message });
}

/**
 * A venue no Venue Staff member looks after: FX-BOOKING's Mochtar Riady Hall (tests/L1/README.md),
 * a row in venue.venues with no venue.venue_staff link, so `venuestaff@` is not one of its staff.
 */
export async function venueNobodyLooksAfter(name: string): Promise<{ id: string; name: string }> {
  const everyDay = JSON.stringify(
    Object.fromEntries(
      ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].map((day) => [day, { opensAt: "07:00", closesAt: "23:00" }]),
    ),
  );
  const rows = await query<{ id: string }>(
    `insert into venue.venues (name, building, max_capacity, layouts, facilities, accessibility_features, operating_hours, status, created_by, updated_by)
     values ($1, 'Business School, Level 3', 500, '[{"name":"Theatre","capacity":500},{"name":"Banquet","capacity":350}]'::jsonb,
             array['Projector','Wireless microphones','Stage lighting','Livestream'], array['Step-free access','Hearing loop'],
             $2::text::jsonb, 'ACTIVE', $3::uuid, $3::uuid)
     returning id`,
    [name, everyDay, ACCOUNTS.venuestaff.id],
  );
  return { id: rows[0]!.id, name };
}

export interface ListingOptions {
  /** The status the registration service holds for the event (event.listing-changed carries it). */
  status: string;
  registrationRequired: boolean;
  seats: number;
}

/**
 * The registration service's own copy of an event (ADR-0005), made the way tests/R1/README.md's
 * FX-R-EVENT makes it, but for a real planning-core event: same id, reference, name and description,
 * and its date and times. Until U1 can confirm an event no user action makes one Confirmed, and the
 * message that would copy it needs Kafka, so the case builds the copy in the registration tables.
 * The window opened yesterday and closes in a week. One venue with `seats` seats.
 */
export async function publishListing(event: EventRow, options: ListingOptions): Promise<void> {
  await query(
    `with listing as (
       insert into registration.event_listings (
         event_id, event_reference, name, description, owner_id, status, starts_at, ends_at,
         registration_required, registration_opens_at, registration_closes_at, withdrawal_deadline_at, source_changed_at
       ) values (
         $1::uuid, $2, $3, $4, $5::uuid, $6, $7::timestamptz, $8::timestamptz,
         $9::boolean, now() - interval '1 day', now() + interval '7 days', null, now()
       ) returning event_id
     ), venue as (
       insert into registration.event_venues (event_id, booking_id, venue_id, venue_name, venue_location, layout, layout_capacity, starts_at, ends_at)
       select event_id, gen_random_uuid(), gen_random_uuid(), 'Lee Kong Chian Auditorium', 'School of Computing, Level 1', 'Theatre',
              $10::int, $7::timestamptz, $8::timestamptz
       from listing
       returning event_id, booking_id
     )
     insert into registration.seats (event_id, booking_id, seat_no)
     select venue.event_id, venue.booking_id, n from venue, generate_series(1, $10::int) as n`,
    [
      event.id,
      event.reference,
      event.name,
      String(event.description ?? ""),
      ACCOUNTS.organiser.id,
      options.status,
      String(event.proposedStartAt),
      String(event.proposedEndAt),
      options.registrationRequired,
      options.seats,
    ],
  );
}

/**
 * Closes the registration window of a published copy once its journey is over, so the event leaves
 * every attendee's list and no later journey that reads the whole list meets it.
 */
export async function closeListing(event: EventRow): Promise<void> {
  await query("update registration.event_listings set registration_closes_at = now() - interval '1 minute' where event_id = $1::uuid", [event.id]);
}

/** The card's "count the event's ..." SQL steps. */
export async function countRows(table: string, column: string, id: string): Promise<number> {
  const rows = await query<{ count: number }>(`select count(*)::int as count from ${table} where ${column} = $1::uuid`, [id]);
  return rows[0]!.count;
}

/** `select purpose from event.events where id = '<id>'` */
export async function purposeOf(eventId: string): Promise<string | null> {
  const rows = await query<{ purpose: string | null }>("select purpose from event.events where id = $1::uuid", [eventId]);
  return rows[0]!.purpose;
}

/** `select status from event.events where id = '<id>'` */
export async function statusOf(eventId: string): Promise<string> {
  const rows = await query<{ status: string }>("select status from event.events where id = $1::uuid", [eventId]);
  return rows[0]!.status;
}

/** `select count(*) from event.event_history where event_id = '<id>'`, optionally for one entry type. */
export async function historyCount(eventId: string, entryType?: string): Promise<number> {
  const rows = await query<{ count: number }>(
    `select count(*)::int as count from event.event_history where event_id = $1::uuid ${entryType ? "and entry_type = $2" : ""}`,
    entryType ? [eventId, entryType] : [eventId],
  );
  return rows[0]!.count;
}
