import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { testDb } from "../../support/testDb.js";
import { cleanVenueFixtures } from "../../support/venueFixtures.js";
import {
  availabilityChangedReason,
  bookingsForImpact,
  carryRequestFlagsToBooking,
  flagBookings,
  outstandingBookingFlags,
} from "../../../src/modules/venue/repo/arrangementFlags.js";
import { venueArrangementsForEvent } from "../../../src/modules/venue/repo/eventArrangements.js";
import { clearDisruptions, disruptedBy, flagDisruptions, insertBlock, removeBlock } from "../../../src/modules/venue/repo/unavailability.js";

/**
 * S3 against real Postgres: the bookings, holds and pending requests an
 * approved change is assessed against, the flags it stores on them, how a
 * request's flags reach the booking M1 confirms, and the flags still
 * outstanding (AC8), which F5 also reads (AC9).
 */

const sql = testDb();
const STAFF = "a5333333-0000-0000-0000-000000000031";
const COORDINATOR = "a5333333-0000-0000-0000-000000000032";

const cleanUp = () => cleanVenueFixtures(sql, STAFF);

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

/** A booking request for `layout`; APPROVED with `bookingId` when given, else PENDING. */
async function newRequest(
  venueId: string,
  eventId: string,
  layout: string,
  options: { bookingId?: string; from?: string; until?: string } = {}
): Promise<{ id: string; reference: string }> {
  const { bookingId = null, from = "14:00", until = "18:00" } = options;
  const approved = bookingId !== null;
  const [row] = await sql<{ id: string; reference: string }[]>`
    insert into venue.booking_requests (
      event_id, venue_id, starts_at, ends_at, layout, expected_attendance, event_starts_at, event_ends_at,
      event_attendance, differs_from_event, requested_by, status, decided_by, decided_at, booking_id
    ) values (
      ${eventId}, ${venueId}, ${at(from)}, ${at(until)}, ${layout}, 60, ${at(from)}, ${at(until)}, 60, false,
      ${COORDINATOR}, ${approved ? "APPROVED" : "PENDING"}, ${approved ? STAFF : null}, ${approved ? new Date() : null}, ${bookingId}
    )
    returning id, reference
  `;
  return row!;
}

/** A hold placed on `slotId` and converted into `requestId` (L3). */
async function convertedHold(venueId: string, eventId: string, slotId: string, requestId: string, from: string, until: string) {
  await sql`
    insert into venue.holds (
      event_id, venue_id, starts_at, ends_at, reminder_lead_minutes, status, requested_by,
      slot_id, placed_by, placed_at, expires_at, converted_request_id, converted_by, converted_at
    ) values (
      ${eventId}, ${venueId}, ${at(from)}, ${at(until)}, 60, 'CONVERTED', ${COORDINATOR},
      ${slotId}, ${STAFF}, now(), now() + interval '1 day', ${requestId}, ${COORDINATOR}, now()
    )
  `;
}

const read = (eventId: string) => sql.begin((tx) => bookingsForImpact(tx, eventId));
const columns = async (table: "venue_slots" | "booking_requests", id: string) =>
  (
    await sql<{ requires_reconfirmation: boolean; period_mismatch: boolean; unsuitable: boolean }[]>`
      select requires_reconfirmation, period_mismatch, unsuitable from ${sql("venue." + table)} where id = ${id}`
  )[0]!;

describe("bookingsForImpact (S3)", () => {
  it("reads the event's confirmed bookings in order, with the booked layout's capacity and the venue's staff", async () => {
    const hall = await newVenue("S3 Hall");
    const eventId = randomUUID();
    const later = await newSlot(hall.id, eventId, "BKR-930002", "14:00", "18:00");
    await newRequest(hall.id, eventId, "Banquet", { bookingId: later });
    const earlier = await newSlot(hall.id, eventId, "BKR-930001", "08:00", "12:00");
    await newRequest(hall.id, eventId, "Theatre", { bookingId: earlier, from: "08:00", until: "12:00" });

    expect(await read(eventId)).toEqual([
      {
        arrangement: "BOOKING",
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
        arrangement: "BOOKING",
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

  it("matches the booked layout regardless of case and surrounding spaces, in the venue's spelling", async () => {
    const hall = await newVenue("S3 Spelling");
    const eventId = randomUUID();
    const slot = await newSlot(hall.id, eventId, "BKR-930009", "14:00", "18:00");
    await newRequest(hall.id, eventId, "  banquet ", { bookingId: slot });
    expect(await read(eventId)).toMatchObject([{ layout: "Banquet", layoutCapacity: 80 }]);
  });

  it("falls back to the venue's maximum capacity when no request records a layout", async () => {
    const hall = await newVenue("S3 Direct", 150);
    const eventId = randomUUID();
    await newSlot(hall.id, eventId, "BKR-930003", "14:00", "18:00");
    expect(await read(eventId)).toMatchObject([{ layout: null, layoutCapacity: 150 }]);
  });

  it("falls back to the maximum capacity, naming no layout, when the venue no longer offers the booked one", async () => {
    const hall = await newVenue("S3 Renamed", 140);
    const eventId = randomUUID();
    const slot = await newSlot(hall.id, eventId, "BKR-930004", "14:00", "18:00");
    await newRequest(hall.id, eventId, "Cabaret", { bookingId: slot });
    expect(await read(eventId)).toMatchObject([{ layout: null, layoutCapacity: 140 }]);
  });

  it("reads confirmed bookings, then held holds, then pending requests of this event, and nothing else", async () => {
    const hall = await newVenue("S3 Kinds");
    const eventId = randomUUID();
    const hold = await newSlot(hall.id, eventId, "HLD-930006", "10:00", "11:00", "HELD");
    const confirmed = await newSlot(hall.id, eventId, "BKR-930005", "12:00", "13:00");
    await newSlot(hall.id, eventId, "BKR-930007", "16:00", "17:00", "RELEASED");
    await newSlot(hall.id, randomUUID(), "BKR-930008", "18:00", "19:00");
    const pending = await newRequest(hall.id, eventId, "Banquet", { from: "20:00", until: "21:00" });

    expect((await read(eventId)).map((row) => [row.arrangement, row.id, row.layout, row.layoutCapacity])).toEqual([
      ["BOOKING", confirmed, null, 200],
      ["HOLD", hold, null, 200],
      ["BOOKING_REQUEST", pending.id, "Banquet", 80],
    ]);
  });

  it("reads a converted hold once, as its held slot with the request's layout", async () => {
    const hall = await newVenue("S3 Converted");
    const eventId = randomUUID();
    const slot = await newSlot(hall.id, eventId, "BKR-930030", "14:00", "18:00", "HELD");
    const request = await newRequest(hall.id, eventId, "Banquet");
    await convertedHold(hall.id, eventId, slot, request.id, "14:00", "18:00");

    expect(await read(eventId)).toMatchObject([{ arrangement: "HOLD", id: slot, layout: "Banquet", layoutCapacity: 80 }]);
  });
});

describe("flagBookings and outstandingBookingFlags (S3, AC8)", () => {
  it("sets S3's own columns on a slot and records why, and the event shows them oldest first", async () => {
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

    // I2's and H3's column is left alone: S3 has its own.
    expect(await columns("venue_slots", slot)).toEqual({ requires_reconfirmation: false, period_mismatch: true, unsuitable: true });
    const stored = await sql`
      select slot_id, booking_request_id, event_id, change_request_id, flag, reason, details from venue.arrangement_flags
      where slot_id = ${slot} order by flagged_at, flag`;
    expect(stored).toEqual([
      { slot_id: slot, booking_request_id: null, event_id: eventId, change_request_id: changeRequestId, flag: "REQUIRES_RECONFIRMATION", reason: "The event moved.", details: { eventStartsAt: "x" } },
      { slot_id: slot, booking_request_id: null, event_id: eventId, change_request_id: changeRequestId, flag: "UNSUITABLE", reason: "Too many people.", details: { expectedAttendance: 150, capacity: 120 } },
    ]);

    const outstanding = await outstandingBookingFlags(sql, eventId);
    expect(outstanding).toMatchObject([
      { arrangement: "BOOKING", id: slot, reference: "BKR-930010", venueName: hall.name, flag: "REQUIRES_RECONFIRMATION", reason: "The event moved." },
      { arrangement: "BOOKING", id: slot, reference: "BKR-930010", venueName: hall.name, flag: "UNSUITABLE", reason: "Too many people." },
    ]);
    for (const flag of outstanding) expect(Number.isNaN(Date.parse(flag.flaggedAt))).toBe(false);
  });

  it("flags a pending request on the request, and a hold on its slot", async () => {
    const hall = await newVenue("S3 Request");
    const eventId = randomUUID();
    const hold = await newSlot(hall.id, eventId, "HLD-930014", "08:00", "09:00", "HELD");
    const request = await newRequest(hall.id, eventId, "Banquet");

    await sql.begin((tx) =>
      flagBookings(tx, eventId, randomUUID(), [
        { bookingId: hold, arrangement: "HOLD", flag: "REQUIRES_RECONFIRMATION", reason: "Hold moved.", details: {} },
        { bookingId: request.id, arrangement: "BOOKING_REQUEST", flag: "REQUIRES_RECONFIRMATION", reason: "Request moved.", details: {} },
        { bookingId: request.id, arrangement: "BOOKING_REQUEST", flag: "UNSUITABLE", reason: "Request too small.", details: {} },
      ])
    );

    expect(await columns("venue_slots", hold)).toEqual({ requires_reconfirmation: false, period_mismatch: true, unsuitable: false });
    expect(await columns("booking_requests", request.id)).toEqual({ requires_reconfirmation: false, period_mismatch: true, unsuitable: true });
    expect(await sql`select slot_id from venue.arrangement_flags where booking_request_id = ${request.id}`).toEqual([
      { slot_id: null },
      { slot_id: null },
    ]);
    expect((await outstandingBookingFlags(sql, eventId)).map((f) => [f.arrangement, f.id, f.flag, f.reason]).sort()).toEqual(
      [
        ["HOLD", hold, "REQUIRES_RECONFIRMATION", "Hold moved."],
        ["BOOKING_REQUEST", request.id, "REQUIRES_RECONFIRMATION", "Request moved."],
        ["BOOKING_REQUEST", request.id, "UNSUITABLE", "Request too small."],
      ].sort()
    );
  });

  it("does nothing for an empty list", async () => {
    const eventId = randomUUID();
    await sql.begin((tx) => flagBookings(tx, eventId, randomUUID(), []));
    expect(await sql`select 1 from venue.arrangement_flags where event_id = ${eventId}`).toHaveLength(0);
  });

  it("leaves out released bookings, decided requests and flags whose column has since been cleared", async () => {
    const hall = await newVenue("S3 Cleared");
    const eventId = randomUUID();
    const released = await newSlot(hall.id, eventId, "BKR-930011", "08:00", "09:00");
    const reconfirmed = await newSlot(hall.id, eventId, "BKR-930012", "10:00", "11:00");
    const still = await newSlot(hall.id, eventId, "BKR-930013", "12:00", "13:00");
    const withdrawn = await newRequest(hall.id, eventId, "Theatre", { from: "15:00", until: "16:00" });
    await sql.begin((tx) =>
      flagBookings(tx, eventId, randomUUID(), [
        { bookingId: released, flag: "UNSUITABLE", reason: "Too small.", details: {} },
        { bookingId: reconfirmed, flag: "REQUIRES_RECONFIRMATION", reason: "Moved.", details: {} },
        { bookingId: still, flag: "UNSUITABLE", reason: "Still too small.", details: {} },
        { bookingId: withdrawn.id, arrangement: "BOOKING_REQUEST", flag: "UNSUITABLE", reason: "Request too small.", details: {} },
      ])
    );
    await sql`update venue.venue_slots set status = 'RELEASED', release_reason = 'replaced' where id = ${released}`;
    await sql`update venue.venue_slots set period_mismatch = false where id = ${reconfirmed}`;
    await sql`
      update venue.booking_requests set status = 'WITHDRAWN', withdrawn_by = ${COORDINATOR}, withdrawn_at = now()
      where id = ${withdrawn.id}`;

    expect((await outstandingBookingFlags(sql, eventId)).map((f) => f.id)).toEqual([still]);
  });

  it("lists each arrangement and flag once, with the newest reason", async () => {
    const hall = await newVenue("S3 Twice");
    const eventId = randomUUID();
    const slot = await newSlot(hall.id, eventId, "BKR-930015", "14:00", "18:00");
    await sql.begin((tx) =>
      flagBookings(tx, eventId, randomUUID(), [{ bookingId: slot, flag: "UNSUITABLE", reason: "Attendance is now 150.", details: {} }])
    );
    await sql`update venue.arrangement_flags set flagged_at = now() - interval '1 hour' where slot_id = ${slot}`;
    await sql.begin((tx) =>
      flagBookings(tx, eventId, randomUUID(), [{ bookingId: slot, flag: "UNSUITABLE", reason: "Attendance is now 180.", details: {} }])
    );

    expect((await outstandingBookingFlags(sql, eventId)).map((f) => [f.id, f.flag, f.reason])).toEqual([
      [slot, "UNSUITABLE", "Attendance is now 180."],
    ]);
  });

  it("also lists a Requires Reconfirmation I2 or H3 set, with a general reason, once beside S3's own", async () => {
    const hall = await newVenue("S3 I2 Only");
    const eventId = randomUUID();
    const byBlock = await newSlot(hall.id, eventId, "BKR-930016", "08:00", "09:00");
    const both = await newSlot(hall.id, eventId, "BKR-930017", "10:00", "11:00");
    const request = await newRequest(hall.id, eventId, "Theatre", { from: "12:00", until: "13:00" });
    await sql`update venue.venue_slots set requires_reconfirmation = true where id in ${sql([byBlock, both])}`;
    await sql`update venue.booking_requests set requires_reconfirmation = true where id = ${request.id}`;
    await sql.begin((tx) =>
      flagBookings(tx, eventId, randomUUID(), [{ bookingId: both, flag: "REQUIRES_RECONFIRMATION", reason: "The event moved.", details: {} }])
    );

    expect((await outstandingBookingFlags(sql, eventId)).map((f) => [f.arrangement, f.id, f.flag, f.reason]).sort()).toEqual(
      [
        ["BOOKING", byBlock, "REQUIRES_RECONFIRMATION", availabilityChangedReason("BOOKING")],
        ["BOOKING", both, "REQUIRES_RECONFIRMATION", "The event moved."],
        ["BOOKING_REQUEST", request.id, "REQUIRES_RECONFIRMATION", availabilityChangedReason("BOOKING_REQUEST")],
      ].sort()
    );
  });

  it("words the general reason for each kind of arrangement", () => {
    expect(availabilityChangedReason("BOOKING")).toBe(
      "The venue's availability changed after this booking was made; Venue Staff must reconfirm it."
    );
    expect(availabilityChangedReason("HOLD")).toContain("after this hold was made");
    expect(availabilityChangedReason("BOOKING_REQUEST")).toContain("after this booking request was made");
  });
});

describe("S3's Requires Reconfirmation outlives I2's", () => {
  it("stays on the booking when a block on it is added and removed", async () => {
    const hall = await newVenue("S3 Block");
    const eventId = randomUUID();
    const slot = await newSlot(hall.id, eventId, "BKR-930040", "14:00", "18:00");
    await sql.begin((tx) =>
      flagBookings(tx, eventId, randomUUID(), [{ bookingId: slot, flag: "REQUIRES_RECONFIRMATION", reason: "The event moved.", details: {} }])
    );

    // I2: a block over the booking flags it, and removing the block clears I2's flag.
    const block = await sql.begin(async (tx) => {
      const recorded = await insertBlock(tx, {
        venueId: hall.id,
        startsAt: at("15:00"),
        endsAt: at("16:00"),
        reasonType: "MAINTENANCE",
        description: "Air conditioning repair",
        actorUserId: STAFF,
      });
      await flagDisruptions(tx, recorded.id, await disruptedBy(tx, hall.id, at("15:00"), at("16:00")), STAFF);
      return recorded;
    });
    expect(await columns("venue_slots", slot)).toMatchObject({ requires_reconfirmation: true, period_mismatch: true });
    const cleared = await sql.begin(async (tx) => {
      await removeBlock(tx, block.id, STAFF);
      return clearDisruptions(tx, block.id);
    });
    expect(cleared).toMatchObject([{ id: slot, stillDisrupted: false }]);
    expect(await columns("venue_slots", slot)).toEqual({ requires_reconfirmation: false, period_mismatch: true, unsuitable: false });

    const { bookings } = await sql.begin((tx) => venueArrangementsForEvent(tx, eventId));
    expect(bookings.map((b) => [b.id, b.flags])).toEqual([[slot, ["REQUIRES_RECONFIRMATION"]]]);
    expect((await outstandingBookingFlags(sql, eventId)).map((f) => [f.id, f.flag, f.reason])).toEqual([
      [slot, "REQUIRES_RECONFIRMATION", "The event moved."],
    ]);
  });
});

describe("carryRequestFlagsToBooking (S3, M1)", () => {
  it("carries a request's columns and flag rows to the booking confirmed from it", async () => {
    const hall = await newVenue("S3 Carry");
    const eventId = randomUUID();
    const changeRequestId = randomUUID();
    const request = await newRequest(hall.id, eventId, "Banquet");
    await sql.begin((tx) =>
      flagBookings(tx, eventId, changeRequestId, [
        { bookingId: request.id, arrangement: "BOOKING_REQUEST", flag: "REQUIRES_RECONFIRMATION", reason: "Moved.", details: { a: 1 } },
      ])
    );
    const slot = await newSlot(hall.id, eventId, request.reference, "14:00", "18:00");

    await sql.begin((tx) => carryRequestFlagsToBooking(tx, request.id, slot));

    expect(await columns("venue_slots", slot)).toEqual({ requires_reconfirmation: false, period_mismatch: true, unsuitable: false });
    const [original] = await sql<{ flagged_at: Date }[]>`select flagged_at from venue.arrangement_flags where booking_request_id = ${request.id}`;
    expect(await sql`select event_id, change_request_id, flag, reason, details, flagged_at from venue.arrangement_flags where slot_id = ${slot}`).toEqual([
      { event_id: eventId, change_request_id: changeRequestId, flag: "REQUIRES_RECONFIRMATION", reason: "Moved.", details: { a: 1 }, flagged_at: original!.flagged_at },
    ]);
  });

  it("keeps the flags a converted hold's slot already carries, and changes nothing for an unflagged request", async () => {
    const hall = await newVenue("S3 Carry Hold");
    const eventId = randomUUID();
    const slot = await newSlot(hall.id, eventId, "BKR-930050", "14:00", "18:00", "HELD");
    await sql.begin((tx) =>
      flagBookings(tx, eventId, randomUUID(), [{ bookingId: slot, arrangement: "HOLD", flag: "UNSUITABLE", reason: "Too small.", details: {} }])
    );
    const request = await newRequest(hall.id, eventId, "Banquet");

    await sql.begin((tx) => carryRequestFlagsToBooking(tx, request.id, slot));

    expect(await columns("venue_slots", slot)).toEqual({ requires_reconfirmation: false, period_mismatch: false, unsuitable: true });
    expect(await sql`select 1 from venue.arrangement_flags where slot_id = ${slot}`).toHaveLength(1);
  });
});

describe("venueArrangementsForEvent (F5, AC9)", () => {
  it("reports S3's flags on bookings, holds and requests, Requires Reconfirmation once whoever set it", async () => {
    const hall = await newVenue("S3 F5");
    const eventId = randomUUID();
    const both = await newSlot(hall.id, eventId, "BKR-930020", "08:00", "09:00");
    const unsuitable = await newSlot(hall.id, eventId, "BKR-930021", "10:00", "11:00");
    const clean = await newSlot(hall.id, eventId, "BKR-930022", "12:00", "13:00");
    const request = await newRequest(hall.id, eventId, "Theatre", { from: "15:00", until: "16:00" });
    await sql`update venue.venue_slots set requires_reconfirmation = true where id = ${both}`;
    await sql.begin((tx) =>
      flagBookings(tx, eventId, randomUUID(), [
        { bookingId: both, flag: "REQUIRES_RECONFIRMATION", reason: "Moved.", details: {} },
        { bookingId: both, flag: "UNSUITABLE", reason: "Too small.", details: {} },
        { bookingId: unsuitable, flag: "UNSUITABLE", reason: "Too small.", details: {} },
        { bookingId: request.id, arrangement: "BOOKING_REQUEST", flag: "REQUIRES_RECONFIRMATION", reason: "Moved.", details: {} },
        { bookingId: request.id, arrangement: "BOOKING_REQUEST", flag: "UNSUITABLE", reason: "Too small.", details: {} },
      ])
    );

    const { bookings, requests } = await sql.begin((tx) => venueArrangementsForEvent(tx, eventId));
    expect(bookings.map((b) => [b.id, b.flags])).toEqual([
      [both, ["REQUIRES_RECONFIRMATION", "UNSUITABLE"]],
      [unsuitable, ["UNSUITABLE"]],
      [clean, []],
    ]);
    expect(requests.map((r) => [r.id, r.flags])).toEqual([[request.id, ["REQUIRES_RECONFIRMATION", "UNSUITABLE"]]]);
  });
});
