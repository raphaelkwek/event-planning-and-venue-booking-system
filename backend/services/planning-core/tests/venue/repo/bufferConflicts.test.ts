import { afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { testDb } from "../../support/testDb.js";
import { listBookingsForEvent } from "../../../src/modules/venue/repo/eventBookings.js";
import { listLiveSlots, listPendingRequests, openConflictKeys, recordBufferConflicts } from "../../../src/modules/venue/repo/bufferConflicts.js";

/**
 * H3-T10, H3-T11 against real Postgres: which slots and pending requests a
 * change of times considers, and which recorded conflicts each still names. The API cases in
 * tests/venue/api/bufferConflicts.test.ts cover the rest.
 */

const sql = testDb();
const STAFF = "a3333333-0000-0000-0000-000000000093";

afterAll(async () => {
  try {
    const ours = sql`select id from venue.venues where created_by = ${STAFF}`;
    await sql`delete from venue.buffer_conflicts where venue_id in (${ours})`;
    await sql`delete from venue.booking_requests where venue_id in (${ours})`;
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

async function newRequest(venueId: string, from: string, until: string, status = "PENDING", day?: string) {
  const [row] = await sql<{ id: string; reference: string; event_id: string }[]>`
    insert into venue.booking_requests
      (event_id, venue_id, starts_at, ends_at, layout, expected_attendance, event_starts_at, event_ends_at,
       event_attendance, differs_from_event, status, requested_by, withdrawn_by, withdrawn_at, created_by, updated_by)
    values (${randomUUID()}, ${venueId}, ${at(from, day)}, ${at(until, day)}, 'Theatre', 40, ${at(from, day)}, ${at(until, day)},
            40, false, ${status}, ${STAFF}, ${status === "WITHDRAWN" ? STAFF : null}, ${status === "WITHDRAWN" ? new Date() : null},
            ${STAFF}, ${STAFF})
    returning id, reference, event_id
  `;
  return row!;
}

const flagOf = async (table: "venue_slots" | "booking_requests", id: string) =>
  (await sql<{ f: boolean }[]>`select requires_reconfirmation as f from ${sql("venue." + table)} where id = ${id}`)[0]!.f;

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
      { id: sooner, reference: "H3R-1", startsAt: at("10:00"), endsAt: at("12:00"), kind: "BOOKING", eventId, requestedBy: null },
      { id: later, reference: "H3R-2", startsAt: at("14:00"), endsAt: at("16:00"), kind: "HOLD", eventId, requestedBy: null },
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
        new Set(),
        { setupMinutes: 15, turnaroundMinutes: 30 },
        STAFF,
      ),
    );
    expect((await listBookingsForEvent(sql, eventId))[0]!.overlaps).toEqual(["H3R-12"]);

    // Later times under which they fit clear the record; the booking names nothing.
    await sql.begin((tx) => recordBufferConflicts(tx, venueId, [], new Set(), { setupMinutes: 0, turnaroundMinutes: 0 }, STAFF));
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

    expect(await sql.begin((tx) => recordBufferConflicts(tx, venueId, pair, new Set(), times, STAFF))).toEqual(new Set([a, b]));
    expect(await sql.begin((tx) => recordBufferConflicts(tx, venueId, pair, new Set(), times, STAFF))).toEqual(new Set());
    const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from venue.buffer_conflicts where venue_id = ${venueId}`;
    expect(n).toBe(2);
  });
});

describe("pending requests in a change of times (H3-T11)", () => {
  it("lists the venue's pending requests still to end, soonest first, with who requested them", async () => {
    const venueId = await newVenue();
    const later = await newRequest(venueId, "14:00", "16:00");
    const sooner = await newRequest(venueId, "10:00", "12:00");
    await newRequest(venueId, "17:00", "18:00", "WITHDRAWN");
    await newRequest(venueId, "10:00", "12:00", "PENDING", "2026-10-01");

    const requests = await sql.begin((tx) => listPendingRequests(tx, venueId));

    expect(requests).toEqual([
      { id: sooner.id, reference: sooner.reference, startsAt: at("10:00"), endsAt: at("12:00"), pending: true, kind: "REQUEST", eventId: sooner.event_id, requestedBy: STAFF },
      { id: later.id, reference: later.reference, startsAt: at("14:00"), endsAt: at("16:00"), pending: true, kind: "REQUEST", eventId: later.event_id, requestedBy: STAFF },
    ]);
  });

  it("records a request against a booking both ways, flags both, and lists the pair as open", async () => {
    const venueId = await newVenue();
    const booking = await newSlot(venueId, randomUUID(), "H3R-31", "10:00", "12:00");
    const req = await newRequest(venueId, "12:15", "14:00");
    const pair = [
      { slotId: booking, overlapsId: req.id, overlapsReference: req.reference },
      { slotId: req.id, overlapsId: booking, overlapsReference: "H3R-31" },
    ];
    const times = { setupMinutes: 0, turnaroundMinutes: 30 };

    const told = await sql.begin((tx) => recordBufferConflicts(tx, venueId, pair, new Set([req.id]), times, STAFF));

    expect(told).toEqual(new Set([booking, req.id]));
    const rows = await sql<{ slot_id: string | null; booking_request_id: string | null; other_slot_id: string | null; other_booking_request_id: string | null }[]>`
      select slot_id, booking_request_id, other_slot_id, other_booking_request_id from venue.buffer_conflicts where venue_id = ${venueId}
    `;
    expect(rows).toEqual(
      expect.arrayContaining([
        { slot_id: booking, booking_request_id: null, other_slot_id: null, other_booking_request_id: req.id },
        { slot_id: null, booking_request_id: req.id, other_slot_id: booking, other_booking_request_id: null },
      ]),
    );
    expect(await flagOf("venue_slots", booking)).toBe(true);
    expect(await flagOf("booking_requests", req.id)).toBe(true);
    expect(await sql.begin((tx) => openConflictKeys(tx, venueId))).toEqual(new Set([`${booking}:${req.id}`, `${req.id}:${booking}`]));

    // Saved again: recorded once, nobody told twice.
    expect(await sql.begin((tx) => recordBufferConflicts(tx, venueId, pair, new Set([req.id]), times, STAFF))).toEqual(new Set());
  });

  it("clears both flags and the record once the times fit, keeping who and when", async () => {
    const venueId = await newVenue();
    const a = await newRequest(venueId, "10:00", "12:00");
    const b = await newRequest(venueId, "12:15", "14:00");
    const requests = new Set([a.id, b.id]);
    const pair = [
      { slotId: a.id, overlapsId: b.id, overlapsReference: b.reference },
      { slotId: b.id, overlapsId: a.id, overlapsReference: a.reference },
    ];
    await sql.begin((tx) => recordBufferConflicts(tx, venueId, pair, requests, { setupMinutes: 0, turnaroundMinutes: 30 }, STAFF));
    await sql.begin((tx) => recordBufferConflicts(tx, venueId, [], requests, { setupMinutes: 0, turnaroundMinutes: 15 }, STAFF));

    expect(await flagOf("booking_requests", a.id)).toBe(false);
    expect(await flagOf("booking_requests", b.id)).toBe(false);
    const rows = await sql<{ cleared_by: string | null }[]>`select cleared_by from venue.buffer_conflicts where venue_id = ${venueId}`;
    expect(rows.map((r) => r.cleared_by)).toEqual([STAFF, STAFF]);
    expect(await sql.begin((tx) => openConflictKeys(tx, venueId))).toEqual(new Set());
  });
});
