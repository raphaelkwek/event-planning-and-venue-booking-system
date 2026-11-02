import postgres, { type Sql } from "postgres";
import { FAKE_AUTH_FLAG, FAKE_AUTH_FLAG_VALUE, assertTestHarnessOnly } from "./fake-supabase-auth.js";
import { anEvent } from "../../backend/services/registration/tests/support/fixtures.js";

/**
 * Events for the load and chaos runs (EN-18, EN-20). They reach the registration service the way they do
 * in production: a listing and an approval, handled by the service's own consumer handlers (the fixtures
 * of R1 to R4). Registration is open from an hour ago to a day from now, so the real clock is inside it.
 */

const HOUR = 3_600_000;

export interface SeededEvent {
  eventId: string;
  reference: string;
  seats: number;
}

export function connect(databaseUrl: string, max = 4): Sql {
  // The one way the harness opens a database, so no run or experiment can write to one that is not on this machine.
  assertTestHarnessOnly({ ...process.env, [FAKE_AUTH_FLAG]: FAKE_AUTH_FLAG_VALUE, DATABASE_URL: databaseUrl });
  return postgres(databaseUrl, { max, prepare: false, onnotice: () => undefined });
}

export async function seedEvent(sql: Sql, seats: number, now = new Date()): Promise<SeededEvent> {
  const at = (hours: number) => new Date(now.getTime() + hours * HOUR).toISOString();
  const { eventId, reference } = await anEvent(sql, {
    seats,
    opensAt: at(-1),
    closesAt: at(24),
    deadline: at(36),
    startsAt: at(48),
    endsAt: at(52),
  });
  return { eventId, reference, seats };
}

/** What the database holds for an event after a run: the numbers every invariant is checked against. */
export interface EventTally {
  eventId: string;
  seats: number;
  claimedSeats: number;
  freeSeats: number;
  registered: number;
  withdrawn: number;
  distinctAttendees: number;
  distinctSeatsHeld: number;
  /** Registered attendees whose seat is not claimed by them, or claimed seats nobody is registered for. */
  mismatches: number;
  outboxRows: number;
}

export async function tallyEvent(sql: Sql, eventId: string): Promise<EventTally> {
  const [row] = await sql<Omit<EventTally, "eventId">[]>`
    select
      (select count(*)::int from registration.seats where event_id = ${eventId} and status in ('FREE', 'CLAIMED')) as "seats",
      (select count(*)::int from registration.seats where event_id = ${eventId} and status = 'CLAIMED') as "claimedSeats",
      (select count(*)::int from registration.seats where event_id = ${eventId} and status = 'FREE') as "freeSeats",
      (select count(*)::int from registration.registrations where event_id = ${eventId} and status = 'REGISTERED') as "registered",
      (select count(*)::int from registration.registrations where event_id = ${eventId} and status = 'WITHDRAWN') as "withdrawn",
      (select count(distinct attendee_id)::int from registration.registrations where event_id = ${eventId} and status = 'REGISTERED') as "distinctAttendees",
      (select count(distinct seat_id)::int from registration.registrations where event_id = ${eventId} and status = 'REGISTERED') as "distinctSeatsHeld",
      (
        select count(*)::int from registration.registrations r
        left join registration.seats s on s.id = r.seat_id and s.status = 'CLAIMED' and s.claimed_by = r.attendee_id
        where r.event_id = ${eventId} and r.status = 'REGISTERED' and s.id is null
      ) + (
        select count(*)::int from registration.seats s
        left join registration.registrations r on r.seat_id = s.id and r.status = 'REGISTERED' and r.attendee_id = s.claimed_by
        where s.event_id = ${eventId} and s.status = 'CLAIMED' and r.id is null
      ) as "mismatches",
      (
        select count(*)::int from registration.outbox
        where message_key in (select id::text from registration.registrations where event_id = ${eventId})
      ) as "outboxRows"
  `;
  return { eventId, ...row! };
}
