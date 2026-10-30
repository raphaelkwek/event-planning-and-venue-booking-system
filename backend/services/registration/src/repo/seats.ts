import type { Sql, TransactionSql } from "postgres";
import { poolShift, splitPools, type SeatBasis, type SeatPool } from "../domain/seatPlan.js";

/**
 * The seat inventory's SQL (EN-13, ADR-0005). The registration schema only,
 * one function per query, raw parameterised SQL (implementation.md §1).
 */

/** A connection or a transaction: both run a tagged-template query the same way. */
export type Db = Sql | TransactionSql;

export interface ClaimedSeat {
  id: string;
  seatNo: number;
  bookingId: string;
}

export interface PoolCounts {
  free: number;
  claimed: number;
}

/**
 * Builds a booking's seats: numbers 1 to the pool's size in the PUBLIC pool, the
 * last `vipSeats` in the VIP pool. Idempotent on (booking, seat number), so a
 * message delivered twice cannot add seats. Returns how many were added.
 */
export async function createSeats(db: Db, basis: SeatBasis, vipSeats = 0): Promise<number> {
  const sql = db as Sql;
  const { publicSeats } = splitPools(basis.capacity, vipSeats);
  const added = await sql`
    insert into registration.seats (event_id, booking_id, seat_no, pool)
    select ${basis.eventId}::uuid, ${basis.bookingId}::uuid, n, case when n <= ${publicSeats}::int then 'PUBLIC' else 'VIP' end
    from generate_series(1, ${basis.capacity}::int) as n
    on conflict (booking_id, seat_no) do nothing
    returning id
  `;
  return added.length;
}

/**
 * A replaced booking (CR-02) no longer provides places: its unclaimed seats are
 * retired so they cannot be claimed. A seat an attendee holds stays theirs.
 */
export async function retireFreeSeatsOfBooking(db: Db, bookingId: string): Promise<number> {
  const sql = db as Sql;
  const retired = await sql`
    update registration.seats set status = 'RETIRED', updated_at = now()
    where booking_id = ${bookingId} and status = 'FREE'
    returning id
  `;
  return retired.length;
}

/**
 * Claims the lowest-numbered free seat in a pool for an attendee, or returns
 * null when the pool has none. `for update skip locked` lets attendees racing
 * for seats lock different rows instead of queueing behind one counter, and a
 * seat is never handed out twice. Check-and-claim is this one statement, so
 * there is no read of the capacity on the write path (ADR-0005).
 */
export async function claimSeat(db: Db, input: { eventId: string; pool: SeatPool; attendeeId: string }): Promise<ClaimedSeat | null> {
  const sql = db as Sql;
  const [seat] = await sql<{ id: string; seat_no: number; booking_id: string }[]>`
    update registration.seats set
      status = 'CLAIMED',
      claimed_by = ${input.attendeeId},
      claimed_at = now(),
      updated_at = now(),
      updated_by = ${input.attendeeId}
    where id = (
      select id from registration.seats
      where event_id = ${input.eventId} and pool = ${input.pool} and status = 'FREE'
      order by seat_no, id
      limit 1
      for update skip locked
    )
    returning id, seat_no, booking_id
  `;
  return seat ? { id: seat.id, seatNo: seat.seat_no, bookingId: seat.booking_id } : null;
}

/** An event's seats by pool: how many are free and how many are claimed. Retired seats are not counted. */
export async function seatCounts(db: Db, eventId: string): Promise<Record<SeatPool, PoolCounts>> {
  const sql = db as Sql;
  const rows = await sql<{ pool: SeatPool; status: string; n: number }[]>`
    select pool, status, count(*)::int as n
    from registration.seats
    where event_id = ${eventId} and status in ('FREE', 'CLAIMED')
    group by pool, status
  `;
  const counts: Record<SeatPool, PoolCounts> = { PUBLIC: { free: 0, claimed: 0 }, VIP: { free: 0, claimed: 0 } };
  for (const row of rows) counts[row.pool][row.status === "FREE" ? "free" : "claimed"] = row.n;
  return counts;
}

/**
 * Sets the size of an event's VIP pool (CQ-01). Only free seats move between the
 * pools, so an attendee's seat never changes under them; when too few are free
 * to reach the size asked for, `shortfall` says how many could not move.
 * Events are serialised on an advisory lock so two changes cannot over-shift.
 */
export async function setVipSeats(sql: Sql, eventId: string, targetVip: number): Promise<{ moved: number; shortfall: number }> {
  return sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(hashtext(${"registration.vip:" + eventId}))`;
    const [totals] = await tx<{ vip: number; total: number }[]>`
      select count(*) filter (where pool = 'VIP')::int as vip, count(*)::int as total
      from registration.seats
      where event_id = ${eventId} and status in ('FREE', 'CLAIMED')
    `;
    const shift = poolShift(totals!.vip, targetVip, totals!.total);
    if (!shift) return { moved: 0, shortfall: 0 };
    // The VIP pool takes the highest numbers and gives back the lowest of its own.
    const moved =
      shift.to === "VIP"
        ? await tx`
            update registration.seats set pool = 'VIP', updated_at = now()
            where id in (
              select id from registration.seats
              where event_id = ${eventId} and pool = 'PUBLIC' and status = 'FREE'
              order by seat_no desc, id desc limit ${shift.count} for update skip locked
            ) returning id`
        : await tx`
            update registration.seats set pool = 'PUBLIC', updated_at = now()
            where id in (
              select id from registration.seats
              where event_id = ${eventId} and pool = 'VIP' and status = 'FREE'
              order by seat_no asc, id asc limit ${shift.count} for update skip locked
            ) returning id`;
    return { moved: moved.length, shortfall: shift.count - moved.length };
  });
}
