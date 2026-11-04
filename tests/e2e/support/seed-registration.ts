import { request as httpRequest } from "node:http";
import { expect, type Page } from "@playwright/test";
import { ACCOUNTS, type AccountKey } from "./accounts.js";
import { tokenFor } from "./api.js";
import { uniqueName } from "./names.js";
import { query } from "./seed-events.js";
import { HOST, PORTS } from "./stack.js";

/**
 * Setup and helpers for the registration journeys (R1 to R4): the cards' FX-R-… statements
 * (tests/R1/README.md), run against the job's own throwaway database; the registration
 * service's API as the attendee who would call it; and the API console as an attendee reaches
 * it, by its address.
 *
 * The registration service never reads planning-core's tables. It keeps its own copy of what an
 * attendee may see, built from Kafka messages, and the browser tests' stack runs without Kafka
 * (documentation/evidence/EN-14). So, as the cards do (tests/R1/README.md), the events are made
 * in the registration service's own tables, with rows only the R cases use: every event
 * reference starts EVT-R.
 */

export const ATTENDEE_ID = ACCOUNTS.attendee.id;
/** FX-R-OTHER-ATTENDEE: another attendee. No account needs to exist for it. */
export const OTHER_ATTENDEE_ID = "00000000-0000-0000-0000-0000000000a5";

export const DESCRIPTION = "A one-day symposium for the school of computing.";
/** The fixtures' event: Wednesday 16 December 2026, 14:00 to 18:00 Singapore time. */
export const PERIOD_TEXT = "Wednesday 16 December 2026, 14:00–18:00";
export const VENUE_ONE = {
  name: "Lee Kong Chian Auditorium",
  location: "School of Computing, Level 1",
  line: "Lee Kong Chian Auditorium — School of Computing, Level 1",
} as const;
export const VENUE_TWO = {
  name: "Seminar Room 2-1",
  location: "School of Computing, Level 2",
  line: "Seminar Room 2-1 — School of Computing, Level 2",
} as const;

/** The name the cards give the event, made unique so a journey finds only its own rows. */
export const symposiumName = () => uniqueName("R Test Symposium");

// ---------------------------------------------------------------------------------------------
// The fixtures (tests/R1/README.md)
// ---------------------------------------------------------------------------------------------

/**
 * "Removing the R fixtures": what earlier R cases created, so each journey starts with only its
 * own events (the open events list is paged, and the cards assume a clean list).
 */
export async function removeRFixtures() {
  // A listing made for an event planning-core also holds (listPlannedEvent) has that event's
  // reference, so it is found by the cards' event name instead.
  const rCase = "(event_reference like 'EVT-R%' or name like 'R Test Symposium %')";
  const ofRCases = `(select event_id from registration.event_listings where ${rCase})`;
  // tests/R5/README.md: the waitlist first, since an entry that ended in a registration names it.
  await query(`delete from registration.waitlist_entries where event_id in ${ofRCases}`);
  await query(`delete from registration.registrations where event_id in ${ofRCases}`);
  await query(`delete from registration.seats where event_id in ${ofRCases}`);
  await query(`delete from registration.event_venues where event_id in ${ofRCases}`);
  await query(`delete from registration.event_listings where ${rCase}`);
}

export interface FxEventOptions {
  name?: string;
  /** One of the event statuses, as the registration service stores it. */
  status?: string;
  /** `<REQUIRED>`: whether the organiser asked for registration. */
  required?: boolean;
  /** SQL for `<OPENS>`, `<CLOSES>` and `<DEADLINE>`, as the README writes them. */
  opens?: string;
  closes?: string;
  deadline?: string;
  /** `<SEATS>`: the layout capacity of the first venue. */
  seats?: number;
}

export interface FxEvent {
  eventId: string;
  reference: string;
  name: string;
}

/** FX-R-EVENT: a Confirmed event, registration open, one venue, 3 seats, unless told otherwise. */
export async function createRegistrationEvent(options: FxEventOptions = {}): Promise<FxEvent> {
  const name = options.name ?? symposiumName();
  const seats = options.seats ?? 3;
  if (!Number.isInteger(seats) || seats < 1) throw new Error(`seats must be a whole number of at least 1, not ${seats}`);
  const required = options.required ?? true;
  const opens = options.opens ?? "now() - interval '1 day'";
  const closes = options.closes ?? "now() + interval '7 days'";
  const deadline = options.deadline ?? "null";
  const rows = await query<{ event_id: string; event_reference: string }>(
    `with listing as (
       insert into registration.event_listings (
         event_id, event_reference, name, description, owner_id, status, starts_at, ends_at,
         registration_required, registration_opens_at, registration_closes_at, withdrawal_deadline_at,
         source_changed_at
       ) values (
         gen_random_uuid(), 'EVT-R' || lpad(floor(random() * 100000)::int::text, 5, '0'), $1,
         '${DESCRIPTION}', '${ACCOUNTS.organiser.id}',
         $2, '2026-12-16T06:00:00Z', '2026-12-16T10:00:00Z',
         ${required}, ${opens}, ${closes}, ${deadline}, now()
       ) returning event_id, event_reference
     ), venue as (
       insert into registration.event_venues (
         event_id, booking_id, venue_id, venue_name, venue_location, layout, layout_capacity, starts_at, ends_at
       )
       select event_id, gen_random_uuid(), gen_random_uuid(), '${VENUE_ONE.name}',
              '${VENUE_ONE.location}', 'Theatre', ${seats}, '2026-12-16T06:00:00Z', '2026-12-16T10:00:00Z'
       from listing
       returning event_id, booking_id
     ), seats as (
       insert into registration.seats (event_id, booking_id, seat_no)
       select venue.event_id, venue.booking_id, n from venue, generate_series(1, ${seats}) as n
       returning id
     )
     select event_id, event_reference from listing`,
    [name, options.status ?? "CONFIRMED"],
  );
  const row = rows[0];
  if (!row) throw new Error("FX-R-EVENT created no event");
  return { eventId: row.event_id, reference: row.event_reference, name };
}

/** The fixtures' event period, as instants: 16 December 2026, 14:00 to 18:00 Singapore time. */
export const FX_STARTS_AT = "2026-12-16T06:00:00.000Z";
export const FX_ENDS_AT = "2026-12-16T10:00:00.000Z";

/** The planning-core event a listing copies: what the event module's API answers. */
export interface PlannedEvent {
  id: string;
  reference: string;
  name: string;
  proposedStartAt?: unknown;
  proposedEndAt?: unknown;
}

/**
 * FX-R-EVENT for an event planning-core holds too, for the journeys whose step acts on the event
 * there and the registration service then reacts to the message (F3 cancels it; M1 confirms it a
 * further venue). The listing is the registration service's copy of that event: its id, reference,
 * name and period, Confirmed, with registration open, as FX-R-EVENT's is. `seats` puts FX-R-EVENT's
 * venue under it; 0 leaves the venue and its seats to a booking's approval (EN-13).
 */
export async function listPlannedEvent(event: PlannedEvent, options: { seats?: number } = {}): Promise<FxEvent> {
  const seats = options.seats ?? 3;
  if (!Number.isInteger(seats) || seats < 0) throw new Error(`seats must be a whole number, not ${seats}`);
  const startsAt = String(event.proposedStartAt ?? FX_STARTS_AT);
  const endsAt = String(event.proposedEndAt ?? FX_ENDS_AT);
  await query(
    `insert into registration.event_listings (
       event_id, event_reference, name, description, owner_id, status, starts_at, ends_at,
       registration_required, registration_opens_at, registration_closes_at, withdrawal_deadline_at,
       source_changed_at
     ) values (
       $1::uuid, $2, $3, '${DESCRIPTION}', '${ACCOUNTS.organiser.id}', 'CONFIRMED', $4::timestamptz, $5::timestamptz,
       true, now() - interval '1 day', now() + interval '7 days', null, now()
     )`,
    [event.id, event.reference, event.name, startsAt, endsAt],
  );
  if (seats > 0) {
    await query(
      `with venue as (
         insert into registration.event_venues (
           event_id, booking_id, venue_id, venue_name, venue_location, layout, layout_capacity, starts_at, ends_at
         ) values (
           $1::uuid, gen_random_uuid(), gen_random_uuid(), '${VENUE_ONE.name}', '${VENUE_ONE.location}', 'Theatre', ${seats},
           $2::timestamptz, $3::timestamptz
         ) returning event_id, booking_id
       )
       insert into registration.seats (event_id, booking_id, seat_no)
       select event_id, booking_id, n from venue, generate_series(1, ${seats}) as n`,
      [event.id, startsAt, endsAt],
    );
  }
  return { eventId: event.id, reference: event.reference, name: event.name };
}

/** FX-R-SECOND-VENUE: a second confirmed venue for the event, Classroom layout, with `seats` seats. */
export async function addSecondVenue(eventId: string, seats: number) {
  if (!Number.isInteger(seats) || seats < 1) throw new Error(`seats must be a whole number of at least 1, not ${seats}`);
  await query(
    `with venue as (
       insert into registration.event_venues (
         event_id, booking_id, venue_id, venue_name, venue_location, layout, layout_capacity, starts_at, ends_at
       ) values (
         $1, gen_random_uuid(), gen_random_uuid(), '${VENUE_TWO.name}', '${VENUE_TWO.location}',
         'Classroom', ${seats}, '2026-12-16T06:00:00Z', '2026-12-16T10:00:00Z'
       ) returning event_id, booking_id
     )
     insert into registration.seats (event_id, booking_id, seat_no)
     select event_id, booking_id, n from venue, generate_series(1, ${seats}) as n`,
    [eventId],
  );
}

/** FX-R-TAKEN: `count` places taken by other attendees, each a registration holding a seat. */
export async function takeSeats(eventId: string, count: number) {
  if (!Number.isInteger(count) || count < 1) throw new Error(`count must be a whole number of at least 1, not ${count}`);
  await query(
    `with taken as (
       update registration.seats
       set status = 'CLAIMED', claimed_by = gen_random_uuid(), claimed_at = now(), updated_at = now()
       where id in (
         select id from registration.seats
         where event_id = $1 and status = 'FREE'
         order by seat_no limit ${count}
       )
       returning id, event_id, claimed_by
     )
     insert into registration.registrations (event_id, attendee_id, seat_id)
     select event_id, claimed_by, id from taken`,
    [eventId],
  );
}

/** FX-R-OTHER-ATTENDEE: one registration belonging to another attendee. */
export async function otherAttendeeRegistration(eventId: string): Promise<{ id: string; reference: string }> {
  const rows = await query<{ id: string; reference: string }>(
    `with taken as (
       update registration.seats
       set status = 'CLAIMED', claimed_by = '${OTHER_ATTENDEE_ID}', claimed_at = now(), updated_at = now()
       where id = (
         select id from registration.seats
         where event_id = $1 and status = 'FREE'
         order by seat_no limit 1
       )
       returning id, event_id, claimed_by
     )
     insert into registration.registrations (event_id, attendee_id, seat_id)
     select event_id, claimed_by, id from taken
     returning id, reference`,
    [eventId],
  );
  const row = rows[0];
  if (!row) throw new Error("FX-R-OTHER-ATTENDEE took no seat");
  return row;
}

// ---------------------------------------------------------------------------------------------
// The cards' SQL-editor checks
// ---------------------------------------------------------------------------------------------

export interface RegistrationRow {
  id: string;
  reference: string;
  attendee_id: string;
  event_id: string;
  status: string;
  registered_at: Date;
  withdrawn_at: Date | null;
  cancelled_at: Date | null;
}

/** The registrations of an event (oldest first), or only one attendee's. */
export function registrationsOf(eventId: string, attendeeId?: string) {
  return query<RegistrationRow & Record<string, unknown>>(
    `select id, reference, attendee_id, event_id, status, registered_at, withdrawn_at, cancelled_at
     from registration.registrations
     where event_id = $1 ${attendeeId ? "and attendee_id = $2" : ""}
     order by registered_at, id`,
    attendeeId ? [eventId, attendeeId] : [eventId],
  );
}

/** How many of the event's seats are in each status (FREE, CLAIMED, RETIRED, ...). */
export async function seatStatusesOf(eventId: string): Promise<Record<string, number>> {
  const rows = await query<{ status: string; n: number }>(
    "select status, count(*)::int as n from registration.seats where event_id = $1::uuid group by status",
    [eventId],
  );
  return Object.fromEntries(rows.map((row) => [row.status, row.n]));
}

export interface OutboxMessage {
  type: string;
  data: Record<string, unknown>;
}

/** The messages the registration service wrote about an event, in the order it wrote them (its outbox). */
export async function registrationOutboxOf(eventId: string, type?: string): Promise<OutboxMessage[]> {
  const rows = await query<{ envelope: { type: string; data: Record<string, unknown> } }>(
    `select envelope from registration.outbox
     where envelope->'data'->>'eventId' = $1 ${type ? "and envelope->>'type' = $2" : ""}
     order by seq`,
    type ? [eventId, type] : [eventId],
  );
  return rows.map(({ envelope }) => ({ type: envelope.type, data: envelope.data }));
}

/** How many registrations an attendee has, whatever their status. */
export async function registrationCountOf(attendeeId: string): Promise<number> {
  const rows = await query<{ n: number }>("select count(*)::int as n from registration.registrations where attendee_id = $1", [attendeeId]);
  return rows[0]?.n ?? 0;
}

export interface ListingTimes {
  opens: Date;
  closes: Date;
  deadline: Date | null;
}

/** The window and deadline the fixture's SQL expressions worked out (now() is the database's own clock). */
export async function listingTimes(eventId: string): Promise<ListingTimes> {
  const rows = await query<{ opens: Date; closes: Date; deadline: Date | null }>(
    `select registration_opens_at as opens, registration_closes_at as closes, withdrawal_deadline_at as deadline
     from registration.event_listings where event_id = $1`,
    [eventId],
  );
  const row = rows[0];
  if (!row) throw new Error(`no listing for ${eventId}`);
  return row;
}

/** An instant as the registration service words it and the web app shows it: "Tuesday 1 December 2026, 09:00" (Singapore time). */
export function singaporeMoment(instant: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Singapore",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part("weekday")} ${part("day")} ${part("month")} ${part("year")}, ${part("hour")}:${part("minute")}`;
}

/** The label the service puts before an event in its messages: EVT-R12345 “R Test Symposium …”. */
export const eventLabel = (event: FxEvent) => `${event.reference} “${event.name}”`;

/** True when an instant is within the last minute (the cards' wording), allowing two seconds of clock difference. */
export function isWithinLastMinute(instant: Date): boolean {
  const age = Date.now() - instant.getTime();
  return age >= -2_000 && age <= 60_000;
}

// ---------------------------------------------------------------------------------------------
// Identity's request budget
// ---------------------------------------------------------------------------------------------

/**
 * The registration and notification services both ask planning-core's identity "who is this
 * token?" (GET /api/v1/users/me) from the one address they run on, and identity allows 120 of
 * those a minute per address. The journeys here make many such requests, so before one starts
 * this waits until the budget has room, rather than letting a refusal look like a defect.
 * The probe is a request to the same limiter, from the same address, so it spends one.
 */
export async function ensureIdentityBudget(needed = 45) {
  const token = await tokenFor("attendee");
  for (let attempt = 0; attempt < 8; attempt++) {
    const response = await fetch(`http://${HOST}:${PORTS.planningCore}/api/v1/users/me`, { headers: { Authorization: `Bearer ${token}` } });
    await response.arrayBuffer();
    const limit = /r=(\d+);\s*t=(\d+)/.exec(response.headers.get("ratelimit") ?? "");
    const remaining = limit ? Number(limit[1]) : Number.POSITIVE_INFINITY;
    if (response.status !== 429 && remaining >= needed) return;
    const seconds = limit ? Number(limit[2]) : Number(response.headers.get("retry-after") ?? 10);
    await new Promise((resolve) => setTimeout(resolve, (seconds + 1) * 1000));
  }
}

// ---------------------------------------------------------------------------------------------
// The registration service's API, as the attendee (setup only)
// ---------------------------------------------------------------------------------------------

export interface Envelope {
  error?: { code: string; message: string; details?: Record<string, unknown> };
}

export interface RegistrationBody {
  id: string;
  reference: string;
  status: string;
  registeredAt: string;
  withdrawnAt: string | null;
}

const SEED_ADDRESS = process.platform === "linux" ? "127.0.0.2" : undefined;

/** Calls the registration service directly (its own paths, no /registration prefix), from the seeding address. */
export async function attendeeCall<T>(method: string, path: string, body?: unknown, as: AccountKey = "attendee") {
  const token = await tokenFor(as);
  const payload = body === undefined ? undefined : JSON.stringify(body);
  return new Promise<{ status: number; body: T }>((resolve, reject) => {
    const req = httpRequest(
      {
        host: HOST,
        port: PORTS.registration,
        method,
        path,
        localAddress: SEED_ADDRESS,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(payload ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } : {}),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          resolve({ status: res.statusCode ?? 0, body: (text ? JSON.parse(text) : null) as T });
        });
      },
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

/** The attendee registers (R2), done through the service's API as a setup step; throws unless it answers 201. */
export async function registerThroughApi(eventId: string): Promise<RegistrationBody> {
  const result = await attendeeCall<RegistrationBody & Envelope>("POST", "/api/v1/registrations", { eventId });
  if (result.status !== 201) throw new Error(`registering for ${eventId} answered ${result.status}: ${JSON.stringify(result.body)}`);
  return result.body;
}

/** The attendee withdraws (R4), done through the service's API as a setup step; throws unless it answers 200. */
export async function withdrawThroughApi(registrationId: string): Promise<RegistrationBody> {
  const result = await attendeeCall<RegistrationBody & Envelope>("POST", `/api/v1/registrations/${registrationId}/withdrawal`);
  if (result.status !== 200) throw new Error(`withdrawing ${registrationId} answered ${result.status}: ${JSON.stringify(result.body)}`);
  return result.body;
}

// ---------------------------------------------------------------------------------------------
// In the browser
// ---------------------------------------------------------------------------------------------

/** Does the action and returns the response the page got to the request it made (method, and a path ending as given). */
export async function captureResponse<T>(page: Page, method: string, pathEnd: string, action: () => Promise<unknown>) {
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.request().method() === method && new URL(r.url()).pathname.endsWith(pathEnd)),
    action(),
  ]);
  return { status: response.status(), body: (await response.json()) as T };
}

/**
 * The cards' "Open the API console at http://localhost:5173/#/console (attendees reach it by its
 * address; it is not in their navigation), set Method and Path, and click Send".
 */
export async function sendFromAttendeeConsole<T = Envelope>(page: Page, method: string, path: string, body = "") {
  if (!page.url().endsWith("#/console")) await page.goto("/#/console");
  await expect(page.getByRole("heading", { name: "Direct API console" })).toBeVisible();
  await page.getByLabel("Method").fill(method);
  await page.getByLabel("Path").fill(path);
  await page.getByLabel("Body (JSON, optional)").fill(body);
  const sent = await captureResponse<T>(page, method, path.replace(/^\/registration/, ""), () => page.getByRole("button", { name: "Send", exact: true }).click());
  // What the console then shows is that response.
  await expect(page.locator("h3").first()).toContainText(String(sent.status));
  return sent;
}
