import type { Sql } from "postgres";
import type { RegistrationStatus } from "@connectsphere/contracts";
import type { Db } from "./seats.js";

/**
 * R2 to R4 — attendees' registrations (migration 0003). The registration schema
 * only, one function per query. Nothing is deleted: a withdrawal and a
 * cancellation are conditional updates of the status.
 */

export interface Registration {
  id: string;
  reference: string;
  eventId: string;
  attendeeId: string;
  seatId: string | null;
  status: RegistrationStatus;
  registeredAt: string;
  withdrawnAt: string | null;
  cancelledAt: string | null;
}

interface RegistrationRow {
  id: string;
  reference: string;
  event_id: string;
  attendee_id: string;
  seat_id: string | null;
  status: RegistrationStatus;
  registered_at: Date;
  withdrawn_at: Date | null;
  cancelled_at: Date | null;
}

const COLUMNS = "id, reference, event_id, attendee_id, seat_id, status, registered_at, withdrawn_at, cancelled_at";

function toRegistration(row: RegistrationRow): Registration {
  return {
    id: row.id,
    reference: row.reference,
    eventId: row.event_id,
    attendeeId: row.attendee_id,
    seatId: row.seat_id,
    status: row.status,
    registeredAt: row.registered_at.toISOString(),
    withdrawnAt: row.withdrawn_at?.toISOString() ?? null,
    cancelledAt: row.cancelled_at?.toISOString() ?? null,
  };
}

/** The partial unique index that allows one active registration per attendee and event (R2). */
const ONE_ACTIVE = "registrations_one_active_per_attendee";

/** A second active registration for the same attendee and event; the database refused it (R2). */
export class DuplicateRegistrationError extends Error {
  constructor() {
    super("The attendee already holds an active registration for this event.");
    this.name = "DuplicateRegistrationError";
  }
}

/** The attendee's active (Registered) registration for the event, if any. */
export async function findActiveRegistration(db: Db, eventId: string, attendeeId: string): Promise<Registration | null> {
  const sql = db as Sql;
  const [row] = await sql<RegistrationRow[]>`
    select ${sql.unsafe(COLUMNS)} from registration.registrations
    where event_id = ${eventId} and attendee_id = ${attendeeId} and status = 'REGISTERED'
  `;
  return row ? toRegistration(row) : null;
}

/**
 * R2: stores the registration holding the seat just claimed, at the instant it
 * was accepted. The unique index is the guard against a duplicate: two requests
 * from one attendee racing past the read both reach here, and the second gets
 * DuplicateRegistrationError, which rolls its transaction (and its seat claim)
 * back.
 */
export async function insertRegistration(
  db: Db,
  input: { eventId: string; attendeeId: string; seatId: string; at: Date },
): Promise<Registration> {
  const sql = db as Sql;
  try {
    const [row] = await sql<RegistrationRow[]>`
      insert into registration.registrations (event_id, attendee_id, seat_id, registered_at, created_by, updated_by)
      values (${input.eventId}, ${input.attendeeId}, ${input.seatId}, ${input.at}, ${input.attendeeId}, ${input.attendeeId})
      returning ${sql.unsafe(COLUMNS)}
    `;
    return toRegistration(row!);
  } catch (error) {
    const pg = error as { code?: string; constraint_name?: string };
    if (pg.code === "23505" && pg.constraint_name === ONE_ACTIVE) throw new DuplicateRegistrationError();
    throw error;
  }
}

/** R3: one registration, only if it is the attendee's own; another's is not found. */
export async function findRegistrationOfAttendee(db: Db, id: string, attendeeId: string): Promise<Registration | null> {
  const sql = db as Sql;
  const [row] = await sql<RegistrationRow[]>`
    select ${sql.unsafe(COLUMNS)} from registration.registrations where id = ${id} and attendee_id = ${attendeeId}
  `;
  return row ? toRegistration(row) : null;
}

/** Where a page of an attendee's registrations starts: after this one, newest first. */
export interface RegistrationCursor {
  registeredAt: string;
  id: string;
}

/**
 * R3: the attendee's own registrations, newest first, whatever their status.
 * The attendee is in the query, so another attendee's rows never leave the
 * database. One more than `limit` is returned, so the caller knows whether there
 * is a next page.
 */
export async function listRegistrationsOfAttendee(
  db: Db,
  attendeeId: string,
  limit: number,
  before: RegistrationCursor | null,
): Promise<Registration[]> {
  const sql = db as Sql;
  const rows = await sql<RegistrationRow[]>`
    select ${sql.unsafe(COLUMNS)} from registration.registrations
    where attendee_id = ${attendeeId}
      ${before ? sql`and (registered_at, id) < (${before.registeredAt}::timestamptz, ${before.id}::uuid)` : sql``}
    order by registered_at desc, id desc
    limit ${limit + 1}
  `;
  return rows.map(toRegistration);
}

/**
 * R4: withdraws the attendee's own registration, only while it is Registered,
 * in one conditional statement. Null when it is not theirs or no longer
 * Registered, so a withdrawal is never recorded twice.
 */
export async function withdrawRegistration(db: Db, id: string, attendeeId: string, at: Date): Promise<Registration | null> {
  const sql = db as Sql;
  const [row] = await sql<RegistrationRow[]>`
    update registration.registrations
    set status = 'WITHDRAWN', withdrawn_at = ${at}, updated_at = now(), updated_by = ${attendeeId}
    where id = ${id} and attendee_id = ${attendeeId} and status = 'REGISTERED'
    returning ${sql.unsafe(COLUMNS)}
  `;
  return row ? toRegistration(row) : null;
}

/**
 * R3, F4: the event was cancelled, so its Registered registrations become
 * Cancelled, at the time it was cancelled. Withdrawn ones stay Withdrawn.
 */
export async function cancelRegistrationsOfEvent(db: Db, eventId: string, at: string): Promise<Registration[]> {
  const sql = db as Sql;
  const rows = await sql<RegistrationRow[]>`
    update registration.registrations
    set status = 'CANCELLED', cancelled_at = ${at}, updated_at = now()
    where event_id = ${eventId} and status = 'REGISTERED'
    returning ${sql.unsafe(COLUMNS)}
  `;
  return rows.map(toRegistration);
}
