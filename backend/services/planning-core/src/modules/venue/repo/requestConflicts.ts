import type { Sql, TransactionSql } from "postgres";

/**
 * N2 — what each pending request clashes with at its venue: the other pending
 * requests and the confirmed bookings whose occupied periods overlap its own
 * (CR-01). SQL against the venue schema only, and Postgres compares (`&&` on
 * `[)` ranges, so periods that only touch don't clash).
 *
 * Nothing is stored: the flag is worked out whenever a request is shown, so
 * creating, approving, rejecting, withdrawing or releasing a booking at the
 * venue changes the next read. It decides nothing.
 */

type Db = Sql | TransactionSql;

export interface RequestConflict {
  kind: "REQUEST" | "BOOKING";
  reference: string;
  startsAt: string;
  endsAt: string;
}

/**
 * For each of the given requests that is still pending, its conflicts, soonest
 * first. A pending request is widened by the venue's setup and turnaround time
 * as they stand now, which an approval would copy (H3); a confirmed booking
 * keeps the occupied period it was made with. A replacement (L5) isn't
 * compared with the booking it replaces, which its approval releases first.
 * Holds are left out: the story names pending requests and confirmed bookings.
 */
export async function conflictsOfRequests(db: Db, requestIds: readonly string[]): Promise<Map<string, RequestConflict[]>> {
  const conflicts = new Map<string, RequestConflict[]>(requestIds.map((id) => [id, []]));
  if (requestIds.length === 0) return conflicts;
  const rows = await db<{ request_id: string; kind: "REQUEST" | "BOOKING"; reference: string; starts_at: Date; ends_at: Date }[]>`
    with pending as (
      select r.id, r.venue_id, r.replaces_booking_id, r.starts_at, r.ends_at, r.reference,
             venue.occupied_period(r.starts_at, r.ends_at, v.setup_minutes, v.turnaround_minutes) as occupied
      from venue.booking_requests r join venue.venues v on v.id = r.venue_id
      where r.status = 'PENDING'
        and r.venue_id in (select venue_id from venue.booking_requests where id = any(${requestIds}::uuid[]))
    ),
    clash as (
      select mine.id as request_id, 'REQUEST' as kind, other.reference, other.starts_at, other.ends_at
      from pending mine join pending other on other.venue_id = mine.venue_id and other.id <> mine.id
      where mine.id = any(${requestIds}::uuid[]) and other.occupied && mine.occupied
      union all
      select mine.id, 'BOOKING', s.reference, s.starts_at, s.ends_at
      from pending mine join venue.venue_slots s on s.venue_id = mine.venue_id and s.status = 'CONFIRMED'
      where mine.id = any(${requestIds}::uuid[]) and s.blocked_period && mine.occupied
        and s.id is distinct from mine.replaces_booking_id
    )
    select request_id, kind, reference, starts_at, ends_at from clash
    order by request_id, starts_at, reference
  `;
  for (const row of rows) {
    conflicts.get(row.request_id)!.push({
      kind: row.kind,
      reference: row.reference,
      startsAt: row.starts_at.toISOString(),
      endsAt: row.ends_at.toISOString(),
    });
  }
  return conflicts;
}
