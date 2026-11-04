import { describe, expect, it } from "vitest";
import { ATTENDEE, EVENT, NOW } from "../support/builders.js";
import { at, scriptedSql } from "../support/scriptedSql.js";
import {
  claimSeat,
  createSeats,
  lockAttendee,
  lockPlaces,
  moveClaimedSeats,
  placeCountsOf,
  releaseSeat,
  retireFreeSeatsOfBooking,
  retireSeatsOfEvent,
  seatCounts,
  seatUnseated,
  setVipSeats,
} from "../../src/repo/seats.js";
import { findEntry, lockGate, spendEntry, takeSlot, waitingAhead } from "../../src/repo/waitingRoom.js";

/**
 * What the seat and waiting-room repos do around their SQL: the numbers they
 * hand back, the values and locks they pass, and how a pool resize is decided.
 * A scripted client stands in for Postgres; the statements run against it in
 * seats.test.ts and the card tests in CI.
 */

const BOOKING = "b0000000-0000-4000-8000-000000000001";
const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `row-${i}` }));

describe("seats repo", () => {
  it("builds the public seats first and says how many were added", async () => {
    const sql = scriptedSql([{ match: /insert into registration\.seats/, rows: rows(3) }]);
    expect(await createSeats(sql, { eventId: EVENT, bookingId: BOOKING, replacedBookingId: null, layout: "THEATRE", capacity: 10 }, 4)).toBe(3);
    // 10 seats with 4 VIP: seats 1 to 6 are public.
    expect(sql.calls[0]!.values).toEqual([EVENT, BOOKING, 6, 10]);
    expect(sql.calls[0]!.text).toContain("on conflict (booking_id, seat_no) do nothing");
  });

  it("builds an all-public pool when no VIP seats are asked for", async () => {
    const sql = scriptedSql([{ match: /insert into registration\.seats/ }]);
    expect(await createSeats(sql, { eventId: EVENT, bookingId: BOOKING, replacedBookingId: null, layout: "THEATRE", capacity: 8 })).toBe(0);
    expect(sql.calls[0]!.values).toEqual([EVENT, BOOKING, 8, 8]);
  });

  it("retires only the free seats of a replaced booking, and counts them", async () => {
    const sql = scriptedSql([{ match: /set status = 'RETIRED'/, rows: rows(2) }]);
    expect(await retireFreeSeatsOfBooking(sql, BOOKING)).toBe(2);
    expect(sql.calls[0]!.text).toContain("status = 'FREE'");
    expect(await retireSeatsOfEvent(sql, EVENT)).toBe(2);
    expect(sql.calls[1]!.text).toContain("status in ('FREE', 'CLAIMED')");
  });

  it("claims the lowest free seat of a pool, or null when the pool has none", async () => {
    const some = scriptedSql([{ match: /set\s*status = 'CLAIMED'/, rows: [{ id: "s1", seat_no: 3, booking_id: BOOKING }] }]);
    expect(await claimSeat(some, { eventId: EVENT, pool: "VIP", attendeeId: ATTENDEE })).toEqual({ id: "s1", seatNo: 3, bookingId: BOOKING });
    expect(some.calls[0]!.text).toContain("for update skip locked");
    expect(some.calls[0]!.values).toEqual([ATTENDEE, ATTENDEE, EVENT, "VIP"]);
    expect(await claimSeat(scriptedSql([{ match: /update/ }]), { eventId: EVENT, pool: "PUBLIC", attendeeId: ATTENDEE })).toBeNull();
  });

  it("totals an event's seats by pool, free and claimed, with zero for what is absent", async () => {
    const sql = scriptedSql([
      {
        match: /group by pool, status/,
        rows: [
          { pool: "PUBLIC", status: "FREE", n: 5 },
          { pool: "PUBLIC", status: "CLAIMED", n: 2 },
          { pool: "VIP", status: "FREE", n: 1 },
        ],
      },
    ]);
    expect(await seatCounts(sql, EVENT)).toEqual({ PUBLIC: { free: 5, claimed: 2 }, VIP: { free: 1, claimed: 0 } });
  });

  describe("setVipSeats", () => {
    const withTotals = (vip: number, total: number, moved: number) =>
      scriptedSql([
        { match: /pg_advisory_xact_lock/ },
        { match: /count\(\*\) filter \(where pool = 'VIP'\)/, rows: [{ vip, total }] },
        { match: /update registration\.seats set pool/, rows: rows(moved) },
      ]);

    it("moves nothing when the pool is already that size", async () => {
      const sql = withTotals(2, 10, 0);
      expect(await setVipSeats(sql, EVENT, 2)).toEqual({ moved: 0, shortfall: 0 });
      expect(sql.calls.filter((c) => c.text.includes("set pool"))).toHaveLength(0);
    });

    it("moves the highest-numbered free public seats into VIP and reports a shortfall when too few are free", async () => {
      const sql = withTotals(1, 10, 2);
      expect(await setVipSeats(sql, EVENT, 5)).toEqual({ moved: 2, shortfall: 2 });
      const move = sql.calls.find((c) => c.text.includes("set pool = 'VIP'"))!;
      expect(move.text).toContain("order by seat_no desc");
      expect(move.values).toEqual([EVENT, 4]);
    });

    it("gives back the lowest-numbered free VIP seats when the pool shrinks", async () => {
      const sql = withTotals(4, 10, 3);
      expect(await setVipSeats(sql, EVENT, 1)).toEqual({ moved: 3, shortfall: 0 });
      expect(sql.calls.find((c) => c.text.includes("set pool = 'PUBLIC'"))!.text).toContain("order by seat_no asc");
    });

    it("holds a target beyond the seats there are to the seats there are", async () => {
      const sql = withTotals(0, 3, 3);
      expect(await setVipSeats(sql, EVENT, 99)).toEqual({ moved: 3, shortfall: 0 });
    });

    it("serialises changes to one event on an advisory lock named for it", async () => {
      const sql = withTotals(0, 3, 0);
      await setVipSeats(sql, EVENT, 1);
      expect(sql.calls[0]!.values).toEqual([`registration.vip:${EVENT}`]);
    });
  });

  it("moves the claimed seats of a replaced booking onto the new one, locking them first", async () => {
    const sql = scriptedSql([{ match: /for update$/ }, { match: /update registration\.seats s set booking_id/, rows: rows(4) }]);
    expect(await moveClaimedSeats(sql, "old", "new")).toBe(4);
    expect(sql.calls[0]!.text).toContain("status = 'CLAIMED' for update");
    expect(sql.calls[1]!.values).toEqual(["new", "old"]);
  });

  it("names the pool a released seat returns to, or null when it was not claimed", async () => {
    expect(await releaseSeat(scriptedSql([{ match: /set status = 'FREE'/, rows: [{ pool: "VIP" }] }]), "s1")).toBe("VIP");
    expect(await releaseSeat(scriptedSql([{ match: /update/ }]), "s1")).toBeNull();
  });

  it("takes the places lock shared or exclusive, and the attendee's lock per event and attendee", async () => {
    const sql = scriptedSql([{ match: /pg_advisory_xact_lock/ }]);
    await lockPlaces(sql, EVENT, "shared");
    await lockPlaces(sql, EVENT, "exclusive");
    await lockAttendee(sql, EVENT, ATTENDEE);
    expect(sql.calls[0]!.text).toContain("pg_advisory_xact_lock_shared");
    expect(sql.calls[1]!.text).not.toContain("shared");
    expect(sql.calls.map((c) => c.values[0])).toEqual([`registration.places:${EVENT}`, `registration.places:${EVENT}`, `registration.attendee:${EVENT}:${ATTENDEE}`]);
  });

  it("counts how many registrations were handed a seat", async () => {
    const sql = scriptedSql([{ match: /with unseated as/, rows: rows(2) }]);
    expect(await seatUnseated(sql, EVENT)).toBe(2);
  });

  describe("placeCountsOf", () => {
    it("starts every event at zero and fills in the free seats and the unseated registrations", async () => {
      const sql = scriptedSql([
        { match: /from registration\.seats/, rows: [{ event_id: EVENT, n: 4 }] },
        { match: /from registration\.registrations/, rows: [{ event_id: "other", n: 2 }] },
      ]);
      const counts = await placeCountsOf(sql, [EVENT, "other", "none"]);
      expect(counts.get(EVENT)).toEqual({ freeSeats: 4, unseatedRegistrations: 0 });
      expect(counts.get("other")).toEqual({ freeSeats: 0, unseatedRegistrations: 2 });
      expect(counts.get("none")).toEqual({ freeSeats: 0, unseatedRegistrations: 0 });
    });

    it("asks nothing for no events", async () => {
      const sql = scriptedSql([]);
      expect(await placeCountsOf(sql, [])).toEqual(new Map());
      expect(sql.calls).toHaveLength(0);
    });
  });
});

describe("waiting room repo", () => {
  const entryRow = (over: Record<string, unknown> = {}) => ({
    id: "w1",
    event_id: EVENT,
    attendee_id: ATTENDEE,
    joined_at: at("2026-12-05T02:00:00.000Z"),
    admit_at: at("2026-12-05T02:00:01.000Z"),
    consumed_at: null,
    ...over,
  });

  it("creates the gate on first use, locks it and returns the attendee's latest entry", async () => {
    const sql = scriptedSql([
      { match: /insert into registration\.waiting_room_gates/ },
      { match: /select next_slot_at/, rows: [{ next_slot_at: at("2026-12-05T02:00:05.000Z") }] },
      { match: /from registration\.waiting_room_entries/, rows: [entryRow()] },
    ]);
    const gate = await lockGate(sql, EVENT, NOW, ATTENDEE);
    expect(gate.nextSlotAt).toEqual(at("2026-12-05T02:00:05.000Z"));
    expect(gate.latest).toMatchObject({ id: "w1", eventId: EVENT, attendeeId: ATTENDEE, consumedAt: null });
    expect(sql.calls[1]!.text).toContain("for update");
  });

  it("has no latest entry for an attendee who has not joined", async () => {
    const sql = scriptedSql([{ match: /insert into registration.waiting_room_gates/ }, { match: /select next_slot_at/, rows: [{ next_slot_at: NOW }] }, { match: /waiting_room_entries/ }]);
    expect((await lockGate(sql, EVENT, NOW, ATTENDEE)).latest).toBeNull();
  });

  it("takes the next slot, moves the gate on by one interval and writes the entry", async () => {
    const sql = scriptedSql([
      { match: /update registration\.waiting_room_gates/ },
      { match: /insert into registration\.waiting_room_entries/, rows: [entryRow()] },
    ]);
    const entry = await takeSlot(sql, { eventId: EVENT, attendeeId: ATTENDEE, now: NOW, gateNextSlotAt: new Date(NOW.getTime() + 1000), intervalMs: 20 });
    expect(entry.id).toBe("w1");
    // The slot is the gate's next one (a second ahead), and the gate then advances 20 ms.
    expect(sql.calls[0]!.values[0]).toEqual(new Date(NOW.getTime() + 1020));
    expect(sql.calls[1]!.values[3]).toEqual(new Date(NOW.getTime() + 1000));
  });

  it("finds an entry by id, or null", async () => {
    expect(await findEntry(scriptedSql([{ match: /where id = / , rows: [entryRow({ consumed_at: NOW })] }]), "w1")).toMatchObject({ consumedAt: NOW });
    expect(await findEntry(scriptedSql([{ match: /where id = / }]), "w1")).toBeNull();
  });

  it("counts the entries still waiting that come before a slot", async () => {
    const sql = scriptedSql([{ match: /count\(\*\)::int as n/, rows: [{ n: 9 }] }]);
    expect(await waitingAhead(sql, EVENT, new Date(NOW.getTime() + 5000), NOW)).toBe(9);
    expect(sql.calls[0]!.values).toEqual([EVENT, NOW, new Date(NOW.getTime() + 5000)]);
  });

  it("spends an entry exactly once: true only when one row changed", async () => {
    const input = { entryId: "w1", eventId: EVENT, attendeeId: ATTENDEE, now: NOW };
    expect(await spendEntry(scriptedSql([{ match: /set consumed_at/, rows: [{ id: "w1" }] }]), input)).toBe(true);
    expect(await spendEntry(scriptedSql([{ match: /set consumed_at/, rows: [] }]), input)).toBe(false);
  });
});
