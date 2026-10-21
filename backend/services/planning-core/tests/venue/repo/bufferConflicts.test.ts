import { afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { testDb } from "../../support/testDb.js";
import { listBookingsForEvent } from "../../../src/modules/venue/repo/eventBookings.js";
import { listLiveSlots, recordBufferConflicts } from "../../../src/modules/venue/repo/bufferConflicts.js";

/**
 * H3-T10 against real Postgres: which slots a change of times considers, and
 * which recorded conflicts a booking still names. The API cases in
 * tests/venue/api/bufferConflicts.test.ts cover the rest.
 */

const sql = testDb();
const STAFF = "a3333333-0000-0000-0000-000000000093";

afterAll(async () => {
  try {
    const ours = sql`select id from venue.venues where created_by = ${STAFF}`;
    await sql`delete from venue.buffer_conflicts where venue_id in (${ours})`;
    await sql`delete from venue.venue_slots where venue_id in (${ours})`;
    await sql`delete from venue.venues where created_by = ${STAFF}`;
  } finally {
    await sql.end();
  }
});

async function newVenue(): Promise<string> {
  const [row] = await sql<{ id: string }[]>`
    insert into venue.venues (name, building, max_capacity, layouts, operating_hours, created_by, updated_by)
    values (${`H3 Repo Hall ${randomUUID().slice(0, 8)}`}, 'H3 Test Building', 50,
            ${sql.json([{ name: "Theatre", capacity: 50 }])}, ${sql.json({})}, ${STAFF}, ${STAFF})
    returning id
  `;
  return row!.id;
}

const at = (hhmm: string, day = "2026-12-02") => new Date(`${day}T${hhmm}:00+08:00`);

async function newSlot(venueId: string, eventId: string, reference: string, from: string, until: string, status = "CONFIRMED", day?: string) {
  const [row] = await sql<{ id: string }[]>`
    insert into venue.venue_slots (venue_id, event_id, reference, starts_at, ends_at, status, release_reason, created_by, updated_by)
    values (${venueId}, ${eventId}, ${reference}, ${at(from, day)}, ${at(until, day)}, ${status},
            ${status === "RELEASED" ? "replaced" : null}, ${STAFF}, ${STAFF})
    returning id
  `;
  return row!.id;
}

describe("listLiveSlots (H3-T10)", () => {
  it("lists the venue's holds and confirmed bookings still to end, soonest first, and nothing released or over", async () => {
    const venueId = await newVenue();
    const eventId = randomUUID();
    const later = await newSlot(venueId, eventId, "H3R-2", "14:00", "16:00", "HELD");
    const sooner = await newSlot(venueId, eventId, "H3R-1", "10:00", "12:00");
    await newSlot(venueId, eventId, "H3R-3", "17:00", "18:00", "RELEASED");
    await newSlot(venueId, eventId, "H3R-4", "10:00", "12:00", "CONFIRMED", "2026-10-01");

    const slots = await sql.begin((tx) => listLiveSlots(tx, venueId));

    expect(slots).toEqual([
      { id: sooner, reference: "H3R-1", startsAt: at("10:00"), endsAt: at("12:00"), kind: "BOOKING", eventId },
      { id: later, reference: "H3R-2", startsAt: at("14:00"), endsAt: at("16:00"), kind: "HOLD", eventId },
    ]);
  });
});

describe("a booking's overlaps (H3-T10, L5)", () => {
  it("names only open conflicts with bookings and holds that are still live", async () => {
    const venueId = await newVenue();
    const eventId = randomUUID();
    const mine = await newSlot(venueId, eventId, "H3R-11", "10:00", "12:00");
    const live = await newSlot(venueId, randomUUID(), "H3R-12", "12:15", "14:00");
    const released = await newSlot(venueId, randomUUID(), "H3R-13", "08:00", "09:50", "RELEASED");
    await sql.begin((tx) =>
      recordBufferConflicts(
        tx,
        venueId,
        [
          { slotId: mine, overlapsId: live, overlapsReference: "H3R-12" },
          { slotId: mine, overlapsId: released, overlapsReference: "H3R-13" },
        ],
        { setupMinutes: 15, turnaroundMinutes: 30 },
        STAFF,
      ),
    );
    expect((await listBookingsForEvent(sql, eventId))[0]!.overlaps).toEqual(["H3R-12"]);

    // Later times under which they fit clear the record; the booking names nothing.
    await sql.begin((tx) => recordBufferConflicts(tx, venueId, [], { setupMinutes: 0, turnaroundMinutes: 0 }, STAFF));
    const [booking] = await listBookingsForEvent(sql, eventId);
    expect(booking).toMatchObject({ overlaps: [], requiresReconfirmation: false });
  });

  it("tells only of slots that gained a conflict, recording each pair once", async () => {
    const venueId = await newVenue();
    const a = await newSlot(venueId, randomUUID(), "H3R-21", "10:00", "12:00");
    const b = await newSlot(venueId, randomUUID(), "H3R-22", "12:15", "14:00");
    const pair = [
      { slotId: a, overlapsId: b, overlapsReference: "H3R-22" },
      { slotId: b, overlapsId: a, overlapsReference: "H3R-21" },
    ];
    const times = { setupMinutes: 0, turnaroundMinutes: 30 };

    expect(await sql.begin((tx) => recordBufferConflicts(tx, venueId, pair, times, STAFF))).toEqual(new Set([a, b]));
    expect(await sql.begin((tx) => recordBufferConflicts(tx, venueId, pair, times, STAFF))).toEqual(new Set());
    const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from venue.buffer_conflicts where venue_id = ${venueId}`;
    expect(n).toBe(2);
  });
});
