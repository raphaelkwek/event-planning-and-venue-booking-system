import type { Sql } from "postgres";
import type { WaitlistStatus } from "@connectsphere/contracts";
import type { Db } from "./seats.js";

/**
 * R6 — the waitlist (migration 0006). The registration schema only, one
 * function per query. Nothing is deleted: leaving, the event's cancellation and
 * registering are conditional updates of the status.
 */

export interface WaitlistEntry {
  id: string;
  reference: string;
  eventId: string;
  attendeeId: string;
  status: WaitlistStatus;
  joinedAt: string;
  lastNotifiedAt: string | null;
  registrationId: string | null;
  registeredAt: string | null;
  withdrawnAt: string | null;
  cancelledAt: string | null;
  /** Its place in the line among the entries still waiting, from 1; null once it has stopped waiting. */
  position: number | null;
}

interface WaitlistRow {
  id: string;
  reference: string;
  event_id: string;
  attendee_id: string;
  status: WaitlistStatus;
  joined_at: Date;
  last_notified_at: Date | null;
  registration_id: string | null;
  registered_at: Date | null;
  withdrawn_at: Date | null;
  cancelled_at: Date | null;
  position?: number | null;
}

const COLUMNS =
  "id, reference, event_id, attendee_id, status, joined_at, last_notified_at, registration_id, registered_at, withdrawn_at, cancelled_at";

/** A waiting entry's place in the line: how many waiting entries of its event joined before it, plus one. */
const POSITION = `case when w.status = 'WAITLISTED' then (
    select count(*)::int from registration.waitlist_entries o
    where o.event_id = w.event_id and o.status = 'WAITLISTED' and (o.joined_at, o.id) <= (w.joined_at, w.id)
  ) end as position`;

const iso = (value: Date | null) => value?.toISOString() ?? null;

function toEntry(row: WaitlistRow): WaitlistEntry {
  return {
    id: row.id,
    reference: row.reference,
    eventId: row.event_id,
    attendeeId: row.attendee_id,
    status: row.status,
    joinedAt: row.joined_at.toISOString(),
    lastNotifiedAt: iso(row.last_notified_at),
    registrationId: row.registration_id,
    registeredAt: iso(row.registered_at),
    withdrawnAt: iso(row.withdrawn_at),
    cancelledAt: iso(row.cancelled_at),
    position: row.position ?? null,
  };
}

/** The partial unique index that allows one waiting entry per attendee and event. */
const ONE_WAITING = "waitlist_one_waiting_per_attendee";

/** A second waiting entry for the same attendee and event; the database refused it (R6). */
export class DuplicateWaitlistEntryError extends Error {
  constructor() {
    super("The attendee is already on this event's waitlist.");
    this.name = "DuplicateWaitlistEntryError";
  }
}

/** The attendee's waiting entry for the event, if any, with its place in the line. */
export async function findWaitingEntry(db: Db, eventId: string, attendeeId: string): Promise<WaitlistEntry | null> {
  const sql = db as Sql;
  const [row] = await sql<WaitlistRow[]>`
    select ${sql.unsafe(COLUMNS)}, ${sql.unsafe(POSITION)} from registration.waitlist_entries w
    where event_id = ${eventId} and attendee_id = ${attendeeId} and status = 'WAITLISTED'
  `;
  return row ? toEntry(row) : null;
}

/** R6: the attendee joins the event's waitlist at `at`. The unique index refuses a second waiting entry. */
export async function insertWaitlistEntry(db: Db, input: { eventId: string; attendeeId: string; at: Date }): Promise<WaitlistEntry> {
  const sql = db as Sql;
  try {
    const [row] = await sql<WaitlistRow[]>`
      insert into registration.waitlist_entries (event_id, attendee_id, joined_at, created_by, updated_by)
      values (${input.eventId}, ${input.attendeeId}, ${input.at}, ${input.attendeeId}, ${input.attendeeId})
      returning ${sql.unsafe(COLUMNS)}
    `;
    return toEntry(row!);
  } catch (error) {
    const pg = error as { code?: string; constraint_name?: string };
    if (pg.code === "23505" && pg.constraint_name === ONE_WAITING) throw new DuplicateWaitlistEntryError();
    throw error;
  }
}

/** R6: one entry, only if it is the attendee's own; another's is not found. */
export async function findEntryOfAttendee(db: Db, id: string, attendeeId: string): Promise<WaitlistEntry | null> {
  const sql = db as Sql;
  const [row] = await sql<WaitlistRow[]>`
    select ${sql.unsafe(COLUMNS)}, ${sql.unsafe(POSITION)} from registration.waitlist_entries w
    where id = ${id} and attendee_id = ${attendeeId}
  `;
  return row ? toEntry(row) : null;
}

/** Where a page of entries starts. */
export interface WaitlistCursor {
  joinedAt: string;
  id: string;
}

/** R6: the attendee's own entries, newest first. One more than `limit` is returned. */
export async function listEntriesOfAttendee(db: Db, attendeeId: string, limit: number, before: WaitlistCursor | null): Promise<WaitlistEntry[]> {
  const sql = db as Sql;
  const rows = await sql<WaitlistRow[]>`
    select ${sql.unsafe(COLUMNS)}, ${sql.unsafe(POSITION)} from registration.waitlist_entries w
    where attendee_id = ${attendeeId}
      ${before ? sql`and (joined_at, id) < (${before.joinedAt}::timestamptz, ${before.id}::uuid)` : sql``}
    order by joined_at desc, id desc
    limit ${limit + 1}
  `;
  return rows.map(toEntry);
}

/** R6: the event's whole waitlist in the order it was joined, whatever each entry's status. One more than `limit`. */
export async function listEntriesOfEvent(db: Db, eventId: string, limit: number, after: WaitlistCursor | null): Promise<WaitlistEntry[]> {
  const sql = db as Sql;
  const rows = await sql<WaitlistRow[]>`
    select ${sql.unsafe(COLUMNS)}, ${sql.unsafe(POSITION)} from registration.waitlist_entries w
    where event_id = ${eventId}
      ${after ? sql`and (joined_at, id) > (${after.joinedAt}::timestamptz, ${after.id}::uuid)` : sql``}
    order by joined_at, id
    limit ${limit + 1}
  `;
  return rows.map(toEntry);
}

/** R6: how many of the event's entries are still waiting. */
export async function waitingCountOf(db: Db, eventId: string): Promise<number> {
  const sql = db as Sql;
  const [row] = await sql<{ n: number }[]>`
    select count(*)::int as n from registration.waitlist_entries where event_id = ${eventId} and status = 'WAITLISTED'
  `;
  return row!.n;
}

/** R6: the attendee leaves, only while the entry is waiting; null when it isn't theirs or no longer waiting. */
export async function withdrawEntry(db: Db, id: string, attendeeId: string, at: Date): Promise<WaitlistEntry | null> {
  const sql = db as Sql;
  const [row] = await sql<WaitlistRow[]>`
    update registration.waitlist_entries
    set status = 'WITHDRAWN', withdrawn_at = ${at}, updated_at = now(), updated_by = ${attendeeId}
    where id = ${id} and attendee_id = ${attendeeId} and status = 'WAITLISTED'
    returning ${sql.unsafe(COLUMNS)}
  `;
  return row ? toEntry(row) : null;
}

/** R6: the attendee registered (R2) or was added (R7), so their waiting entry ends, naming the registration. */
export async function closeEntryRegistered(
  db: Db,
  input: { eventId: string; attendeeId: string; registrationId: string; at: Date; by: string },
): Promise<WaitlistEntry | null> {
  const sql = db as Sql;
  const [row] = await sql<WaitlistRow[]>`
    update registration.waitlist_entries
    set status = 'REGISTERED', registration_id = ${input.registrationId}, registered_at = ${input.at},
        updated_at = now(), updated_by = ${input.by}
    where event_id = ${input.eventId} and attendee_id = ${input.attendeeId} and status = 'WAITLISTED'
    returning ${sql.unsafe(COLUMNS)}
  `;
  return row ? toEntry(row) : null;
}

/** R6: a place opened, so every waiting entry is told; each records when. In line order. */
export async function markWaitingNotified(db: Db, eventId: string, at: Date): Promise<WaitlistEntry[]> {
  const sql = db as Sql;
  const rows = await sql<WaitlistRow[]>`
    update registration.waitlist_entries
    set last_notified_at = ${at}, updated_at = now()
    where event_id = ${eventId} and status = 'WAITLISTED'
    returning ${sql.unsafe(COLUMNS)}
  `;
  return rows.map(toEntry).sort((a, b) => a.joinedAt.localeCompare(b.joinedAt) || a.id.localeCompare(b.id));
}

/** R6: the event was cancelled, so its waiting entries are Cancelled at that time. Others keep their status. */
export async function cancelEntriesOfEvent(db: Db, eventId: string, at: string): Promise<WaitlistEntry[]> {
  const sql = db as Sql;
  const rows = await sql<WaitlistRow[]>`
    update registration.waitlist_entries
    set status = 'CANCELLED', cancelled_at = ${at}, updated_at = now()
    where event_id = ${eventId} and status = 'WAITLISTED'
    returning ${sql.unsafe(COLUMNS)}
  `;
  return rows.map(toEntry);
}
