import { afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { testDb } from "../../support/testDb.js";
import {
  activeBlocksOverlapping,
  approveBookingRequest,
  bookingsOverlapping,
  isVenueStaff,
  rejectBookingRequest,
  releaseReplacedBooking,
} from "../../../src/modules/venue/repo/bookingDecisions.js";
import { findBookingRequest } from "../../../src/modules/venue/repo/bookingRequests.js";

/**
 * M1, M2 against real Postgres: a decision is recorded with who and when
 * (migration venue/0007's check refuses one that isn't), the look-ups that name
 * what an approval overlaps, and CR-02's release of the replaced booking.
 *
 * Every test makes its own venue, so none depends on or disturbs another's rows.
 */

const sql = testDb();
const STAFF = "a3333333-0000-0000-0000-000000000071";
const COORDINATOR = "a3333333-0000-0000-0000-000000000072";
/** Postgres check_violation and unique_violation. */
const CHECK_VIOLATION = "23514";
const UNIQUE_VIOLATION = "23505";

afterAll(async () => {
  try {
    const ours = sql`select id from venue.venues where created_by = ${STAFF}`;
    await sql`delete from venue.booking_requests where venue_id in (${ours})`;
    await sql`delete from venue.venue_slots where venue_id in (${ours})`;
    await sql`delete from venue.unavailability_blocks where venue_id in (${ours})`;
    await sql`delete from venue.venue_staff where venue_id in (${ours})`;
    await sql`delete from venue.venues where created_by = ${STAFF}`;
  } finally {
    await sql.end();
  }
});

async function newVenue(): Promise<string> {
  const [row] = await sql<{ id: string }[]>`
    insert into venue.venues (name, building, max_capacity, layouts, operating_hours, created_by, updated_by)
    values (${`M1 Test Room ${randomUUID().slice(0, 8)}`}, 'M1 Test Building', 50,
            ${sql.json([{ name: "Theatre", capacity: 50 }])}, ${sql.json({})}, ${STAFF}, ${STAFF})
    returning id
  `;
  await sql`insert into venue.venue_staff (venue_id, user_id, created_by, updated_by) values (${row!.id}, ${STAFF}, ${STAFF}, ${STAFF})`;
  return row!.id;
}

/** A time on Wednesday 2 Dec 2026, Singapore time. */
const at = (hhmm: string) => new Date(`2026-12-02T${hhmm}:00+08:00`);

async function newRequest(venueId: string, from = "14:00", until = "18:00"): Promise<string> {
  const [row] = await sql<{ id: string }[]>`
    insert into venue.booking_requests (
      event_id, venue_id, starts_at, ends_at, layout, expected_attendance, event_starts_at, event_ends_at,
      event_attendance, differs_from_event, requested_by, created_by, updated_by
    ) values (
      ${randomUUID()}, ${venueId}, ${at(from)}, ${at(until)}, 'Theatre', 40, ${at(from)}, ${at(until)}, 40, false,
      ${COORDINATOR}, ${COORDINATOR}, ${COORDINATOR}
    )
    returning id
  `;
  return row!.id;
}

async function newSlot(
  venueId: string,
  options: { from?: string; until?: string; setup?: number; turnaround?: number; status?: string; eventId?: string } = {},
): Promise<string> {
  const [row] = await sql<{ id: string }[]>`
    insert into venue.venue_slots
      (venue_id, event_id, reference, starts_at, ends_at, setup_minutes, turnaround_minutes, status, created_by, updated_by)
    values (${venueId}, ${options.eventId ?? randomUUID()}, ${`M1-${randomUUID().slice(0, 8)}`}, ${at(options.from ?? "10:00")},
            ${at(options.until ?? "12:00")}, ${options.setup ?? 0}, ${options.turnaround ?? 0}, ${options.status ?? "CONFIRMED"},
            ${STAFF}, ${STAFF})
    returning id
  `;
  return row!.id;
}

async function newBlock(venueId: string, from: string, until: string, status = "ACTIVE"): Promise<string> {
  const [row] = await sql<{ id: string }[]>`
    insert into venue.unavailability_blocks (venue_id, starts_at, ends_at, reason_type, description, status, created_by, updated_by)
    values (${venueId}, ${at(from)}, ${at(until)}, 'MAINTENANCE', 'Stage rigging inspection', ${status}, ${STAFF}, ${STAFF})
    returning id
  `;
  return row!.id;
}

const codeOf = (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (error: { code?: string }) => error.code,
  );

describe("approveBookingRequest and rejectBookingRequest", () => {
  it("records an approval: Approved, its booking, who and when (M1-T3)", async () => {
    const venueId = await newVenue();
    const id = await newRequest(venueId);
    const bookingId = await newSlot(venueId, { from: "14:00", until: "18:00" });
    const before = Date.now();

    await sql.begin((tx) => approveBookingRequest(tx, id, STAFF, bookingId));

    const request = (await findBookingRequest(sql, id))!;
    expect(request).toMatchObject({ status: "APPROVED", decidedBy: STAFF, bookingId, rejectionReason: null, suggestedAlternative: null });
    expect(Date.parse(request.decidedAt!)).toBeGreaterThanOrEqual(before - 5000);
  });

  it("records a rejection: Rejected, the reason, any suggestion, who and when (M2-T2, M2-T3)", async () => {
    const venueId = await newVenue();
    const withSuggestion = await newRequest(venueId);
    const without = await newRequest(venueId, "18:00", "20:00");

    await sql.begin((tx) => rejectBookingRequest(tx, withSuggestion, STAFF, "Closed for exams", "Seminar Room 2-1"));
    await sql.begin((tx) => rejectBookingRequest(tx, without, STAFF, "Closed for exams", null));

    expect(await findBookingRequest(sql, withSuggestion)).toMatchObject({
      status: "REJECTED",
      decidedBy: STAFF,
      bookingId: null,
      rejectionReason: "Closed for exams",
      suggestedAlternative: "Seminar Room 2-1",
    });
    expect((await findBookingRequest(sql, without))!.suggestedAlternative).toBeNull();
  });

  it("starts every request undecided", async () => {
    const id = await newRequest(await newVenue());
    expect(await findBookingRequest(sql, id)).toMatchObject({
      decidedBy: null,
      decidedAt: null,
      bookingId: null,
      rejectionReason: null,
      suggestedAlternative: null,
    });
  });
});

describe("migration venue/0007's checks", () => {
  it("refuses a decision without who and when, an approval without its booking, and a rejection without a reason (M2-T1)", async () => {
    const venueId = await newVenue();
    const id = await newRequest(venueId);
    const bookingId = await newSlot(venueId, { from: "14:00", until: "18:00" });
    const set = (fields: Record<string, unknown>) => codeOf(sql`update venue.booking_requests set ${sql(fields)} where id = ${id}`);

    expect(await set({ status: "APPROVED", booking_id: bookingId })).toBe(CHECK_VIOLATION);
    expect(await set({ status: "APPROVED", decided_by: STAFF, decided_at: new Date() })).toBe(CHECK_VIOLATION);
    expect(await set({ status: "REJECTED", decided_by: STAFF, decided_at: new Date() })).toBe(CHECK_VIOLATION);
    expect(await set({ status: "REJECTED", decided_by: STAFF, decided_at: new Date(), rejection_reason: "   " })).toBe(CHECK_VIOLATION);
    expect(
      await set({ status: "REJECTED", decided_by: STAFF, decided_at: new Date(), rejection_reason: "No", suggested_alternative: " " }),
    ).toBe(CHECK_VIOLATION);
    expect(await set({ decided_by: STAFF, decided_at: new Date() })).toBe(CHECK_VIOLATION);
    expect(await set({ status: "REJECTED", decided_by: STAFF, decided_at: new Date(), rejection_reason: "No", booking_id: bookingId })).toBe(
      CHECK_VIOLATION,
    );
    expect((await findBookingRequest(sql, id))!.status).toBe("PENDING");
  });

  it("lets one booking be the approval of only one request", async () => {
    const venueId = await newVenue();
    const first = await newRequest(venueId);
    const second = await newRequest(venueId, "18:00", "20:00");
    const bookingId = await newSlot(venueId, { from: "14:00", until: "18:00" });

    await sql.begin((tx) => approveBookingRequest(tx, first, STAFF, bookingId));
    expect(await codeOf(sql.begin((tx) => approveBookingRequest(tx, second, STAFF, bookingId)))).toBe(UNIQUE_VIOLATION);
  });

  it("allows a release reason only on a released booking, and never a blank one", async () => {
    const venueId = await newVenue();
    const confirmed = await newSlot(venueId);
    const released = await newSlot(venueId, { from: "13:00", until: "14:00", status: "RELEASED" });

    expect(await codeOf(sql`update venue.venue_slots set release_reason = 'replaced' where id = ${confirmed}`)).toBe(CHECK_VIOLATION);
    expect(await codeOf(sql`update venue.venue_slots set release_reason = ' ' where id = ${released}`)).toBe(CHECK_VIOLATION);
    expect(await codeOf(sql`update venue.venue_slots set release_reason = 'replaced' where id = ${released}`)).toBeNull();
  });
});

describe("activeBlocksOverlapping (M1-T5)", () => {
  it("returns the venue's active blocks overlapping the period, soonest first, never a removed one or one that only touches", async () => {
    const venueId = await newVenue();
    const later = await newBlock(venueId, "16:00", "19:00");
    const earlier = await newBlock(venueId, "13:00", "14:30");
    await newBlock(venueId, "10:00", "14:00");
    await newBlock(venueId, "18:00", "20:00");
    await newBlock(venueId, "15:00", "16:00", "REMOVED");
    await newBlock(await newVenue(), "14:00", "18:00");

    const blocks = await sql.begin((tx) => activeBlocksOverlapping(tx, venueId, at("14:00"), at("18:00"), 0, 0));

    expect(blocks.map((b) => b.id)).toEqual([earlier, later]);
    expect(blocks[1]).toEqual({
      id: later,
      reasonType: "MAINTENANCE",
      description: "Stage rigging inspection",
      startsAt: at("16:00").toISOString(),
      endsAt: at("19:00").toISOString(),
    });
  });

  it("compares the booking's occupied period, setup and turnaround included (CR-01)", async () => {
    const venueId = await newVenue();
    await newBlock(venueId, "12:00", "13:45");

    expect(await sql.begin((tx) => activeBlocksOverlapping(tx, venueId, at("14:00"), at("18:00"), 0, 0))).toEqual([]);
    expect(await sql.begin((tx) => activeBlocksOverlapping(tx, venueId, at("14:00"), at("18:00"), 30, 0))).toHaveLength(1);
  });
});

describe("bookingsOverlapping (M1-T4, M1-T6)", () => {
  it("returns the holds and confirmed bookings whose occupied periods overlap, with those periods, soonest first", async () => {
    const venueId = await newVenue();
    const otherEvent = randomUUID();
    await newSlot(venueId, { from: "10:00", until: "12:00", setup: 30, turnaround: 45, eventId: otherEvent });
    await newSlot(venueId, { from: "13:00", until: "15:00", status: "HELD" });
    await newSlot(venueId, { from: "12:00", until: "13:00", status: "RELEASED" });
    await newSlot(venueId, { from: "08:00", until: "09:30" });

    const found = await sql.begin((tx) => bookingsOverlapping(tx, venueId, at("12:30"), at("14:00"), 0, 0));

    expect(found).toEqual([
      { eventId: otherEvent, status: "CONFIRMED", occupiedFrom: at("09:30").toISOString(), occupiedUntil: at("12:45").toISOString() },
      { eventId: expect.any(String), status: "HELD", occupiedFrom: at("13:00").toISOString(), occupiedUntil: at("15:00").toISOString() },
    ]);
  });
});

describe("releaseReplacedBooking (CR-02, M1-T10)", () => {
  it("releases a confirmed booking with the reason replaced and keeps it; a second release changes nothing", async () => {
    const venueId = await newVenue();
    const slotId = await newSlot(venueId);

    expect(await sql.begin((tx) => releaseReplacedBooking(tx, slotId, STAFF))).toBe(true);
    const [row] = await sql`select status, release_reason, updated_by from venue.venue_slots where id = ${slotId}`;
    expect(row).toEqual({ status: "RELEASED", release_reason: "replaced", updated_by: STAFF });

    expect(await sql.begin((tx) => releaseReplacedBooking(tx, slotId, STAFF))).toBe(false);
  });
});

describe("isVenueStaff (M1-T11)", () => {
  it("is true only for the Venue Staff linked to the venue", async () => {
    const venueId = await newVenue();
    expect(await isVenueStaff(sql, venueId, STAFF)).toBe(true);
    expect(await isVenueStaff(sql, venueId, COORDINATOR)).toBe(false);
    expect(await isVenueStaff(sql, await newVenue(), COORDINATOR)).toBe(false);
  });
});
