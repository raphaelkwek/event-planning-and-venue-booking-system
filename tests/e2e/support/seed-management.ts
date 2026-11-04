import { expect, type Locator, type Page } from "@playwright/test";
import { ACCOUNTS, type AccountKey } from "./accounts.js";
import { DESCRIPTION, attendeeCall, type Envelope, type FxEvent } from "./seed-registration.js";
import { query } from "./seed-events.js";
import { uniqueName } from "./names.js";

/**
 * Setup and screens for the organiser's side of registration (R5 to R7): the FX-R-… statements
 * of tests/R5/README.md, run against the job's own throwaway database, Attendee Two, and the
 * Registrations screen (#/events/<EVENT_ID>/registrations) with its totals, rows, waitlist and
 * "Add an attendee" form.
 */

// ---------------------------------------------------------------------------------------------
// The fixtures (tests/R5/README.md)
// ---------------------------------------------------------------------------------------------

/** FX-R-MANAGED: Coordinator One (or another coordinator) is the event's assigned coordinator. */
export async function manage(eventId: string, coordinator: AccountKey = "coordinator") {
  await query("update registration.event_listings set assigned_coordinator_id = $2::uuid, updated_at = now() where event_id = $1::uuid", [
    eventId,
    ACCOUNTS[coordinator].id,
  ]);
}

/** FX-R-WITHDRAW-ONE: one of FX-R-TAKEN's registrations withdrawn, its seat freed, as R4 would leave it. */
export async function withdrawOneTaken(eventId: string) {
  await query(
    `with one as (
       update registration.registrations
       set status = 'WITHDRAWN', withdrawn_at = now(), updated_at = now()
       where id = (
         select id from registration.registrations
         where event_id = $1::uuid and status = 'REGISTERED' and added_by is null and attendee_id <> $2::uuid
         order by registered_at limit 1
       )
       returning seat_id
     )
     update registration.seats set status = 'FREE', claimed_by = null, claimed_at = null, updated_at = now()
     where id in (select seat_id from one)`,
    [eventId, ACCOUNTS.attendee.id],
  );
}

/** FX-R-WAITLISTED: `count` other attendees on the event's waitlist, in order, a minute apart. */
export async function waitlistOthers(eventId: string, count: number): Promise<{ id: string; attendee_id: string }[]> {
  if (!Number.isInteger(count) || count < 1) throw new Error(`count must be a whole number of at least 1, not ${count}`);
  return query<{ id: string; attendee_id: string }>(
    `insert into registration.waitlist_entries (event_id, attendee_id, joined_at)
     select $1::uuid, gen_random_uuid(), now() - ($2::int - n) * interval '1 minute'
     from generate_series(1, $2::int) as n
     returning id, attendee_id`,
    [eventId, count],
  );
}

/** FX-R-NO-VENUE: an event listed with registration open but no confirmed venue booking, so no capacity yet. */
export async function createNoVenueEvent(): Promise<FxEvent> {
  const name = uniqueName("R Test Symposium");
  const rows = await query<{ event_id: string; event_reference: string }>(
    `insert into registration.event_listings (
       event_id, event_reference, name, description, owner_id, status, starts_at, ends_at,
       registration_required, registration_opens_at, registration_closes_at, source_changed_at
     ) values (
       gen_random_uuid(), 'EVT-R' || lpad(floor(random() * 100000)::int::text, 5, '0'), $1,
       '${DESCRIPTION}', $2::uuid, 'CONFIRMED', '2026-12-16T06:00:00Z', '2026-12-16T10:00:00Z', true,
       now() - interval '1 day', now() + interval '7 days', now()
     ) returning event_id, event_reference`,
    [name, ACCOUNTS.organiser.id],
  );
  const row = rows[0];
  if (!row) throw new Error("FX-R-NO-VENUE created no event");
  return { eventId: row.event_id, reference: row.event_reference, name };
}

/**
 * tests/R5/README.md's Attendee Two, added the way the seed adds Attendee One (identity.users with
 * a display name, and the Attendee role), but to the job's own throwaway database only. The fake
 * Supabase Auth server knows the account from accounts.ts.
 */
export async function ensureAttendeeTwo() {
  const two = ACCOUNTS.attendee2;
  await query(
    `insert into identity.users (id, supabase_user_id, email, is_active, display_name)
     values ($1::uuid, $2::uuid, $3, true, $4)
     on conflict (id) do nothing`,
    [two.id, two.authId, two.email, two.displayName],
  );
  await query("insert into identity.user_roles (user_id, role) values ($1::uuid, 'ATTENDEE') on conflict (user_id, role) do nothing", [two.id]);
}

// ---------------------------------------------------------------------------------------------
// The cards' SQL-editor checks
// ---------------------------------------------------------------------------------------------

export interface WaitlistRow {
  id: string;
  reference: string;
  attendee_id: string;
  status: string;
  joined_at: Date;
  last_notified_at: Date | null;
  registration_id: string | null;
  registered_at: Date | null;
  withdrawn_at: Date | null;
}

/** The event's waitlist entries in the order they were joined, or only one attendee's. */
export function waitlistOf(eventId: string, attendeeId?: string) {
  return query<WaitlistRow & Record<string, unknown>>(
    `select id, reference, attendee_id, status, joined_at, last_notified_at, registration_id, registered_at, withdrawn_at
     from registration.waitlist_entries
     where event_id = $1::uuid ${attendeeId ? "and attendee_id = $2::uuid" : ""}
     order by joined_at, id`,
    attendeeId ? [eventId, attendeeId] : [eventId],
  );
}

export interface ManualRow {
  id: string;
  reference: string;
  attendee_id: string;
  status: string;
  added_by: string | null;
  registered_at: Date;
  addition_reason: string | null;
  added_over_capacity: boolean;
  seat_id: string | null;
}

/** The registrations of an event with what R7 records about each addition. */
export function additionsOf(eventId: string) {
  return query<ManualRow & Record<string, unknown>>(
    `select id, reference, attendee_id, status, added_by, registered_at, addition_reason, added_over_capacity, seat_id
     from registration.registrations where event_id = $1::uuid order by registered_at, id`,
    [eventId],
  );
}

// ---------------------------------------------------------------------------------------------
// The service's API, as an attendee (setup only)
// ---------------------------------------------------------------------------------------------

export interface WaitlistBody {
  id: string;
  reference: string;
  status: string;
  position: number | null;
}

/** An attendee joins the waitlist (R6-T1 step 1), as a setup step; throws unless it answers 201. */
export async function joinWaitlistThroughApi(eventId: string, as: AccountKey = "attendee"): Promise<WaitlistBody> {
  const result = await attendeeCall<WaitlistBody & Envelope>("POST", `/api/v1/events/${eventId}/waitlist`, undefined, as);
  if (result.status !== 201) throw new Error(`${as} joining the waitlist of ${eventId} answered ${result.status}: ${JSON.stringify(result.body)}`);
  return result.body;
}

// ---------------------------------------------------------------------------------------------
// The Registrations screen
// ---------------------------------------------------------------------------------------------

/** "open #/events/<EVENT_ID>/registrations". */
export async function openRegistrations(page: Page, eventId: string) {
  await page.goto(`/#/events/${eventId}/registrations`);
  await expect(page.getByRole("heading", { name: "Registrations", level: 1, exact: true })).toBeVisible();
}

/** The totals, in the order the screen lists them: `Registered n`, `Withdrawn n`, `Places remaining n`, `Capacity n`, … */
export const totals = (page: Page) => page.getByRole("list", { name: "Totals" }).getByRole("listitem");

/** The registration rows (the table's body). */
export const registrationRows = (page: Page) => page.getByRole("table", { name: "Registrations" }).locator("tbody tr");

/** The waitlist rows (the table's body). */
export const waitlistRows = (page: Page) => page.getByRole("table", { name: "Waitlist" }).locator("tbody tr");

/** The row of a named attendee. */
export const rowOf = (page: Page, name: string) => registrationRows(page).filter({ hasText: name });

/** "Under Add an attendee, enter <email> and <reason>, and click Add attendee": the dialog that opens. */
export async function startAddition(page: Page, email: string, reason = ""): Promise<Locator> {
  const form = page.locator("section", { has: page.getByRole("heading", { name: "Add an attendee", exact: true }) });
  await form.getByLabel("Attendee's email").fill(email);
  await form.getByLabel("Reason (optional)").fill(reason);
  await form.getByRole("button", { name: "Add attendee", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(`Add ${email}?`);
  return dialog;
}
