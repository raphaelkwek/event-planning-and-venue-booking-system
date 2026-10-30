import { afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { claimSeat, createSeats, retireFreeSeatsOfBooking, seatCounts, setVipSeats } from "../../src/repo/seats.js";

/**
 * EN-13 done-checks, against the real registration schema (ADR-0005): the seat
 * claim never hands one seat to two attendees, and attendees racing for the
 * last places leave exactly as many registered as there are seats.
 */

const sql = postgres(process.env.DATABASE_URL!, { max: 20, prepare: false });
const eventIds: string[] = [];

/** A fresh event, so tests never see each other's seats. */
function aBooking(capacity: number) {
  const eventId = randomUUID();
  eventIds.push(eventId);
  return { eventId, bookingId: randomUUID(), replacedBookingId: null, layout: "Theatre", capacity };
}

afterAll(async () => {
  if (eventIds.length) await sql`delete from registration.seats where event_id in ${sql(eventIds)}`;
  await sql.end();
});

describe("createSeats", () => {
  it("builds one row per place in the layout's capacity, numbered from 1, all public (EN-13-T1)", async () => {
    const booking = aBooking(12);
    expect(await createSeats(sql, booking)).toBe(12);
    const rows = await sql`select seat_no, pool, status from registration.seats where event_id = ${booking.eventId} order by seat_no`;
    expect(rows.map((r) => r.seat_no)).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
    expect(new Set(rows.map((r) => r.pool))).toEqual(new Set(["PUBLIC"]));
    expect(new Set(rows.map((r) => r.status))).toEqual(new Set(["FREE"]));
  });

  it("adds no seats the second time the same booking is built (EN-13-T4)", async () => {
    const booking = aBooking(5);
    await createSeats(sql, booking);
    expect(await createSeats(sql, booking)).toBe(0);
    expect((await seatCounts(sql, booking.eventId)).PUBLIC.free).toBe(5);
  });

  it("puts the last seats in the VIP pool when asked for some (EN-13-T3)", async () => {
    const booking = aBooking(10);
    await createSeats(sql, booking, 3);
    const vip = await sql`select seat_no from registration.seats where event_id = ${booking.eventId} and pool = 'VIP' order by seat_no`;
    expect(vip.map((r) => r.seat_no)).toEqual([8, 9, 10]);
  });

  it("gives an event with two venues the total of their seats (CQ-04) (EN-13-T5)", async () => {
    const first = aBooking(30);
    await createSeats(sql, first);
    await createSeats(sql, { ...first, bookingId: randomUUID(), capacity: 20 });
    const counts = await seatCounts(sql, first.eventId);
    expect(counts.PUBLIC.free).toBe(50);
  });
});

describe("claimSeat", () => {
  it("claims the lowest-numbered free seat, then the next (EN-13-T2)", async () => {
    const booking = aBooking(3);
    await createSeats(sql, booking);
    const a = await claimSeat(sql, { eventId: booking.eventId, pool: "PUBLIC", attendeeId: randomUUID() });
    const b = await claimSeat(sql, { eventId: booking.eventId, pool: "PUBLIC", attendeeId: randomUUID() });
    expect([a?.seatNo, b?.seatNo]).toEqual([1, 2]);
    expect(a?.bookingId).toBe(booking.bookingId);
  });

  it("records who holds the seat and when (EN-13-T2)", async () => {
    const booking = aBooking(1);
    await createSeats(sql, booking);
    const attendeeId = randomUUID();
    const seat = await claimSeat(sql, { eventId: booking.eventId, pool: "PUBLIC", attendeeId });
    const [row] = await sql`select status, claimed_by, claimed_at from registration.seats where id = ${seat!.id}`;
    expect(row!.status).toBe("CLAIMED");
    expect(row!.claimed_by).toBe(attendeeId);
    expect(row!.claimed_at).toBeInstanceOf(Date);
  });

  it("gives null when the pool has no free seat, and leaves the other pool alone (EN-13-T3)", async () => {
    const booking = aBooking(2);
    await createSeats(sql, booking, 1);
    expect(await claimSeat(sql, { eventId: booking.eventId, pool: "PUBLIC", attendeeId: randomUUID() })).not.toBeNull();
    expect(await claimSeat(sql, { eventId: booking.eventId, pool: "PUBLIC", attendeeId: randomUUID() })).toBeNull();
    expect(await claimSeat(sql, { eventId: booking.eventId, pool: "VIP", attendeeId: randomUUID() })).not.toBeNull();
  });

  it("gives null for an event that has no seats (EN-13-T2)", async () => {
    expect(await claimSeat(sql, { eventId: randomUUID(), pool: "PUBLIC", attendeeId: randomUUID() })).toBeNull();
  });

  it("race: 500 attendees claiming 100 seats at once leave exactly 100 registered, each a different seat (EN-13-T9)", async () => {
    const booking = aBooking(100);
    await createSeats(sql, booking);
    const results = await Promise.all(
      Array.from({ length: 500 }, () => claimSeat(sql, { eventId: booking.eventId, pool: "PUBLIC", attendeeId: randomUUID() })),
    );
    const won = results.filter((r) => r !== null);
    expect(won).toHaveLength(100);
    expect(new Set(won.map((r) => r!.id)).size).toBe(100);
    expect(results.filter((r) => r === null)).toHaveLength(400);
    expect(await seatCounts(sql, booking.eventId)).toEqual({ PUBLIC: { free: 0, claimed: 100 }, VIP: { free: 0, claimed: 0 } });
  });

  it("race: the last place goes to exactly one of two attendees (R2's atomic check) (EN-13-T9)", async () => {
    const booking = aBooking(1);
    await createSeats(sql, booking);
    const pair = await Promise.all([
      claimSeat(sql, { eventId: booking.eventId, pool: "PUBLIC", attendeeId: randomUUID() }),
      claimSeat(sql, { eventId: booking.eventId, pool: "PUBLIC", attendeeId: randomUUID() }),
    ]);
    expect(pair.filter((r) => r !== null)).toHaveLength(1);
  });
});

describe("setVipSeats", () => {
  it("moves free public seats into the VIP pool, highest numbers first, and back (EN-13-T3)", async () => {
    const booking = aBooking(10);
    await createSeats(sql, booking);
    expect(await setVipSeats(sql, booking.eventId, 4)).toEqual({ moved: 4, shortfall: 0 });
    expect((await seatCounts(sql, booking.eventId)).VIP.free).toBe(4);
    const vip = await sql`select seat_no from registration.seats where event_id = ${booking.eventId} and pool = 'VIP' order by seat_no`;
    expect(vip.map((r) => r.seat_no)).toEqual([7, 8, 9, 10]);
    expect(await setVipSeats(sql, booking.eventId, 1)).toEqual({ moved: 3, shortfall: 0 });
    expect(await setVipSeats(sql, booking.eventId, 1)).toEqual({ moved: 0, shortfall: 0 });
  });

  it("never moves a seat an attendee holds, and says how many could not move (EN-13-T3)", async () => {
    const booking = aBooking(4);
    await createSeats(sql, booking);
    for (let i = 0; i < 3; i++) await claimSeat(sql, { eventId: booking.eventId, pool: "PUBLIC", attendeeId: randomUUID() });
    expect(await setVipSeats(sql, booking.eventId, 3)).toEqual({ moved: 1, shortfall: 2 });
    const counts = await seatCounts(sql, booking.eventId);
    expect(counts.PUBLIC.claimed).toBe(3);
    expect(counts.VIP.free).toBe(1);
  });
});

describe("retireFreeSeatsOfBooking", () => {
  it("retires a replaced booking's free seats and keeps the ones attendees hold (EN-13-T6)", async () => {
    const booking = aBooking(5);
    await createSeats(sql, booking);
    await claimSeat(sql, { eventId: booking.eventId, pool: "PUBLIC", attendeeId: randomUUID() });
    expect(await retireFreeSeatsOfBooking(sql, booking.bookingId)).toBe(4);
    expect(await seatCounts(sql, booking.eventId)).toEqual({ PUBLIC: { free: 0, claimed: 1 }, VIP: { free: 0, claimed: 0 } });
    expect(await claimSeat(sql, { eventId: booking.eventId, pool: "PUBLIC", attendeeId: randomUUID() })).toBeNull();
  });
});
