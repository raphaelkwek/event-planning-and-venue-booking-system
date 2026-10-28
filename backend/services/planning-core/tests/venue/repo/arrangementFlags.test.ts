import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { testDb } from "../../support/testDb.js";
import {
  bookingsForImpact,
  flagBookings,
  outstandingBookingFlags,
} from "../../../src/modules/venue/repo/arrangementFlags.js";
import { venueArrangementsForEvent } from "../../../src/modules/venue/repo/eventArrangements.js";

/**
 * S3 against real Postgres: the confirmed bookings an approved change is
 * assessed against, the flags it stores on them, and the flags still
 * outstanding (AC8), which F5 also reads (AC9).
 */

const sql = testDb();
const STAFF = "a5333333-0000-0000-0000-000000000031";
const COORDINATOR = "a5333333-0000-0000-0000-000000000032";

async function cleanUp() {
  const ours = sql`select id from venue.venues where created_by = ${STAFF}`;
  await sql`delete from venue.arrangement_flags where slot_id in (select id from venue.venue_slots where venue_id in (${ours}))`;
  await sql`delete from venue.booking_requests where venue_id in (${ours})`;
  await sql`delete from venue.venue_slots where venue_id in (${ours})`;
  await sql`delete from venue.venue_staff where venue_id in (${ours})`;
  await sql`delete from venue.venues where created_by = ${STAFF}`;
}

beforeEach(cleanUp);
afterAll(async () => {
  try {
    await cleanUp();
  } finally {
    await sql.end();
  }
});

async function newVenue(name: string, maxCapacity = 200): Promise<{ id: string; name: string }> {
  const unique = `${name} ${randomUUID().slice(0, 8)}`;
  const [row] = await sql<{ id: string }[]>`
    insert into venue.venues (name, building, max_capacity, layouts, operating_hours, created_by, updated_by)
    values (${unique}, 'S3 Test Building', ${maxCapacity},
            ${sql.json([{ name: "Theatre", capacity: 120 }, { name: "Banquet", capacity: 80 }])}, ${sql.json({})}, ${STAFF}, ${STAFF})
    returning id
  `;
  await sql`insert into venue.venue_staff (venue_id, user_id, created_by) values (${row!.id}, ${STAFF}, ${STAFF})`;
  return { id: row!.id, name: unique };
}

const at = (hhmm: string, day = "02") => new Date(`2026-12-${day}T${hhmm}:00+08:00`);

async function newSlot(venueId: string, eventId: string, reference: string, from: string, until: string, status = "CONFIRMED") {
  const [row] = await sql<{ id: string }[]>`
    insert into venue.venue_slots (venue_id, event_id, reference, starts_at, ends_at, status, release_reason, created_by, updated_by)
    values (${venueId}, ${eventId}, ${reference}, ${at(from)}, ${at(until)}, ${status}, ${status === "RELEASED" ? "replaced" : null}, ${STAFF}, ${STAFF})
    returning id
  `;
  return row!.id;
}

/** The approved request M1 confirmed the slot for, which carries the booked layout. */
async function approvedRequest(venueId: string, eventId: string, slotId: string, layout: string) {
  await sql`
    insert into venue.booking_requests (
      event_id, venue_id, starts_at, ends_at, layout, expected_attendance, event_starts_at, event_ends_at,
      event_attendance, differs_from_event, requested_by, status, decided_by, decided_at, booking_id
    ) values (
      ${eventId}, ${venueId}, ${at("14:00")}, ${at("18:00")}, ${layout}, 60, ${at("14:00")}, ${at("18:00")}, 60, false,
      ${COORDINATOR}, 'APPROVED', ${STAFF}, now(), ${slotId}
    )
  `;
}

const read = (eventId: string) => sql.begin((tx) => bookingsForImpact(tx, eventId));

describe("bookingsForImpact (S3)", () => {
  it("reads the event's confirmed bookings in order, with the booked layout's capacity and the venue's staff", async () => {
    const hall = await newVenue("S3 Hall");
    const eventId = randomUUID();
    const later = await newSlot(hall.id, eventId, "BKR-930002", "14:00", "18:00");
    await approvedRequest(hall.id, eventId, later, "Banquet");
    const earlier = await newSlot(hall.id, eventId, "BKR-930001", "08:00", "12:00");
    await approvedRequest(hall.id, eventId, earlier, "Theatre");

    expect(await read(eventId)).toEqual([
      {
        id: earlier,
        reference: "BKR-930001",
        venueId: hall.id,
        venueName: hall.name,
        startsAt: at("08:00").toISOString(),
        endsAt: at("12:00").toISOString(),
        layout: "Theatre",
        layoutCapacity: 120,
        staffIds: [STAFF],
      },
      {
        id: later,
        reference: "BKR-930002",
        venueId: hall.id,
        venueName: hall.name,
        startsAt: at("14:00").toISOString(),
        endsAt: at("18:00").toISOString(),
        layout: "Banquet",
        layoutCapacity: 80,
        staffIds: [STAFF],
      },
    ]);
  });

  it("falls back to the venue's maximum capacity when no request records a layout", async () => {
    const hall = await newVenue("S3 Direct", 150);
    const eventId = randomUUID();
    await newSlot(hall.id, eventId, "BKR-930003", "14:00", "18:00");
    expect(await read(eventId)).toMatchObject([{ layout: null, layoutCapacity: 150 }]);
  });

  it("falls back to the maximum capacity when the venue no longer offers the booked layout", async () => {
    const hall = await newVenue("S3 Renamed", 140);
    const eventId = randomUUID();
    const slot = await newSlot(hall.id, eventId, "BKR-930004", "14:00", "18:00");
    await approvedRequest(hall.id, eventId, slot, "Cabaret");
    expect(await read(eventId)).toMatchObject([{ layout: "Cabaret", layoutCapacity: 140 }]);
  });

  it("reads only confirmed bookings of this event", async () => {
    const hall = await newVenue("S3 Only");
    const eventId = randomUUID();
    const confirmed = await newSlot(hall.id, eventId, "BKR-930005", "08:00", "09:00");
    await newSlot(hall.id, eventId, "BKR-930006", "10:00", "11:00", "HELD");
    await newSlot(hall.id, eventId, "BKR-930007", "12:00", "13:00", "RELEASED");
    await newSlot(hall.id, randomUUID(), "BKR-930008", "14:00", "15:00");
    expect((await read(eventId)).map((b) => b.id)).toEqual([confirmed]);
  });
});

describe("flagBookings and outstandingBookingFlags (S3, AC8)", () => {
  it("sets each flag's column and records why, and the event shows them oldest first", async () => {
    const hall = await newVenue("S3 Flagged");
    const eventId = randomUUID();
    const changeRequestId = randomUUID();
    const slot = await newSlot(hall.id, eventId, "BKR-930010", "14:00", "18:00");

    await sql.begin((tx) =>
      flagBookings(tx, eventId, changeRequestId, [
        { bookingId: slot, flag: "REQUIRES_RECONFIRMATION", reason: "The event moved.", details: { eventStartsAt: "x" } },
        { bookingId: slot, flag: "UNSUITABLE", reason: "Too many people.", details: { expectedAttendance: 150, capacity: 120 } },
      ])
    );

    const [row] = await sql`select requires_reconfirmation, unsuitable from venue.venue_slots where id = ${slot}`;
    expect(row).toEqual({ requires_reconfirmation: true, unsuitable: true });
    const stored = await sql`
      select slot_id, event_id, change_request_id, flag, reason, details from venue.arrangement_flags
      where slot_id = ${slot} order by flagged_at, flag`;
    expect(stored).toEqual([
      { slot_id: slot, event_id: eventId, change_request_id: changeRequestId, flag: "REQUIRES_RECONFIRMATION", reason: "The event moved.", details: { eventStartsAt: "x" } },
      { slot_id: slot, event_id: eventId, change_request_id: changeRequestId, flag: "UNSUITABLE", reason: "Too many people.", details: { expectedAttendance: 150, capacity: 120 } },
    ]);

    const outstanding = await outstandingBookingFlags(sql, eventId);
    expect(outstanding).toMatchObject([
      { bookingId: slot, reference: "BKR-930010", venueName: hall.name, flag: "REQUIRES_RECONFIRMATION", reason: "The event moved." },
      { bookingId: slot, reference: "BKR-930010", venueName: hall.name, flag: "UNSUITABLE", reason: "Too many people." },
    ]);
    for (const flag of outstanding) expect(Number.isNaN(Date.parse(flag.flaggedAt))).toBe(false);
  });

  it("does nothing for an empty list", async () => {
    const eventId = randomUUID();
    await sql.begin((tx) => flagBookings(tx, eventId, randomUUID(), []));
    expect(await sql`select 1 from venue.arrangement_flags where event_id = ${eventId}`).toHaveLength(0);
  });

  it("leaves out released bookings and flags whose column has since been cleared", async () => {
    const hall = await newVenue("S3 Cleared");
    const eventId = randomUUID();
    const released = await newSlot(hall.id, eventId, "BKR-930011", "08:00", "09:00");
    const reconfirmed = await newSlot(hall.id, eventId, "BKR-930012", "10:00", "11:00");
    const still = await newSlot(hall.id, eventId, "BKR-930013", "12:00", "13:00");
    await sql.begin((tx) =>
      flagBookings(tx, eventId, randomUUID(), [
        { bookingId: released, flag: "UNSUITABLE", reason: "Too small.", details: {} },
        { bookingId: reconfirmed, flag: "REQUIRES_RECONFIRMATION", reason: "Moved.", details: {} },
        { bookingId: still, flag: "UNSUITABLE", reason: "Still too small.", details: {} },
      ])
    );
    await sql`update venue.venue_slots set status = 'RELEASED', release_reason = 'replaced' where id = ${released}`;
    await sql`update venue.venue_slots set requires_reconfirmation = false where id = ${reconfirmed}`;

    expect((await outstandingBookingFlags(sql, eventId)).map((f) => f.bookingId)).toEqual([still]);
  });
});

describe("venueArrangementsForEvent (F5, AC9)", () => {
  it("reports a booking's Unsuitable flag beside Requires Reconfirmation", async () => {
    const hall = await newVenue("S3 F5");
    const eventId = randomUUID();
    const both = await newSlot(hall.id, eventId, "BKR-930020", "08:00", "09:00");
    const unsuitable = await newSlot(hall.id, eventId, "BKR-930021", "10:00", "11:00");
    const clean = await newSlot(hall.id, eventId, "BKR-930022", "12:00", "13:00");
    await sql.begin((tx) =>
      flagBookings(tx, eventId, randomUUID(), [
        { bookingId: both, flag: "REQUIRES_RECONFIRMATION", reason: "Moved.", details: {} },
        { bookingId: both, flag: "UNSUITABLE", reason: "Too small.", details: {} },
        { bookingId: unsuitable, flag: "UNSUITABLE", reason: "Too small.", details: {} },
      ])
    );

    const { bookings } = await sql.begin((tx) => venueArrangementsForEvent(tx, eventId));
    expect(bookings.map((b) => [b.id, b.flags])).toEqual([
      [both, ["REQUIRES_RECONFIRMATION", "UNSUITABLE"]],
      [unsuitable, ["UNSUITABLE"]],
      [clean, []],
    ]);
  });
});
