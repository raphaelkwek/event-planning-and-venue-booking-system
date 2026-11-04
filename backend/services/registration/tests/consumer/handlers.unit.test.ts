import { beforeEach, describe, expect, it, vi } from "vitest";
import { aListing, EVENT } from "../support/builders.js";
import { scriptedSql } from "../support/scriptedSql.js";
import { approvalMessage, cancelledMessage, listingMessage } from "../support/fixtures.js";

/**
 * EN-13, R1, R3, R6, R7 — what the two Kafka handlers do with a message, with
 * the repos scripted: the inbox row comes first so a redelivery changes
 * nothing, a replaced booking moves attendees' seats before new ones are built,
 * the waitlist is told only when places grew, and a cancellation from either
 * topic cancels registrations. The statements run against Postgres in
 * handleApproval.test.ts and handleListing.test.ts.
 */

const repo = vi.hoisted(() => ({
  createSeats: vi.fn(),
  lockPlaces: vi.fn(),
  moveClaimedSeats: vi.fn(),
  placeCountsOf: vi.fn(),
  retireFreeSeatsOfBooking: vi.fn(),
  seatUnseated: vi.fn(),
  findListing: vi.fn(),
  applyListing: vi.fn(),
  closeListing: vi.fn(),
  recordVenue: vi.fn(),
  replaceVenue: vi.fn(),
  notifyWaitlist: vi.fn(),
  cancelEventRegistrations: vi.fn(),
}));

vi.mock("../../src/repo/seats.js", () => ({
  createSeats: repo.createSeats,
  lockPlaces: repo.lockPlaces,
  moveClaimedSeats: repo.moveClaimedSeats,
  placeCountsOf: repo.placeCountsOf,
  retireFreeSeatsOfBooking: repo.retireFreeSeatsOfBooking,
  seatUnseated: repo.seatUnseated,
}));
vi.mock("../../src/repo/listings.js", () => ({ findListing: repo.findListing, applyListing: repo.applyListing, closeListing: repo.closeListing }));
vi.mock("../../src/repo/venues.js", () => ({ recordVenue: repo.recordVenue, replaceVenue: repo.replaceVenue }));
vi.mock("../../src/service/waitlist.js", () => ({ notifyWaitlist: repo.notifyWaitlist }));
vi.mock("../../src/service/cancel.js", () => ({ cancelEventRegistrations: repo.cancelEventRegistrations }));

const { handleMessage, INBOX_CONSUMER } = await import("../../src/consumer/handleApproval.js");
const { handleListingMessage, LISTING_CONSUMER } = await import("../../src/consumer/handleListing.js");

/** The inbox accepts the message the first time and refuses it the second. */
const inbox = (fresh = true) => scriptedSql([{ match: /insert into registration\.consumed_messages/, rows: fresh ? [{ message_id: "m" }] : [] }]);
const counts = (free: number, unseated = 0) => new Map([[EVENT, { freeSeats: free, unseatedRegistrations: unseated }]]);
const approval = (seats: number, replacedBookingId?: string) => approvalMessage(EVENT, { seats, ...(replacedBookingId ? { replacedBookingId } : {}) }).value;

beforeEach(() => {
  vi.resetAllMocks();
  repo.createSeats.mockResolvedValue(10);
  repo.moveClaimedSeats.mockResolvedValue(0);
  repo.retireFreeSeatsOfBooking.mockResolvedValue(0);
  repo.seatUnseated.mockResolvedValue(0);
  repo.placeCountsOf.mockResolvedValue(counts(10));
  repo.findListing.mockResolvedValue(aListing());
  repo.notifyWaitlist.mockResolvedValue(0);
  repo.applyListing.mockResolvedValue(true);
  repo.cancelEventRegistrations.mockResolvedValue({ cancelled: 0, retiredSeats: 0, cancelledEntries: 0 });
});

describe("the seat builder (EN-13)", () => {
  it("records the message in the inbox first, then builds the seats and the venue under the exclusive lock", async () => {
    const sql = inbox();
    const outcome = await handleMessage(approval(10), { sql });

    expect(outcome).toEqual({ outcome: "built", seats: 10, retired: 0, moved: 0, seated: 0, told: 0 });
    expect(sql.calls[0]!.values[1]).toBe(INBOX_CONSUMER);
    expect(repo.lockPlaces).toHaveBeenCalledWith(expect.anything(), EVENT, "exclusive");
    expect(repo.createSeats).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ eventId: EVENT, capacity: 10, replacedBookingId: null }));
    expect(repo.recordVenue).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ eventId: EVENT, layoutCapacity: 10, venueName: "Lee Kong Chian Auditorium" }));
    expect(repo.moveClaimedSeats).not.toHaveBeenCalled();
  });

  it("does nothing for a message already consumed", async () => {
    expect(await handleMessage(approval(10), { sql: inbox(false) })).toEqual({ outcome: "duplicate" });
    expect(repo.createSeats).not.toHaveBeenCalled();
    expect(repo.lockPlaces).not.toHaveBeenCalled();
  });

  it("moves attendees' seats onto a replacing booking, retires the old free ones and replaces the venue, before building", async () => {
    const order: string[] = [];
    repo.moveClaimedSeats.mockImplementation(async () => (order.push("move"), 3));
    repo.retireFreeSeatsOfBooking.mockImplementation(async () => (order.push("retire"), 7));
    repo.replaceVenue.mockImplementation(async () => void order.push("replace"));
    repo.createSeats.mockImplementation(async () => (order.push("create"), 7));

    const old = "99999999-9999-4999-8999-999999999999";
    const outcome = await handleMessage(approval(10, old), { sql: inbox() });

    expect(order).toEqual(["move", "retire", "replace", "create"]);
    expect(repo.moveClaimedSeats).toHaveBeenCalledWith(expect.anything(), old, expect.any(String));
    expect(outcome).toMatchObject({ outcome: "built", moved: 3, retired: 7, seats: 7 });
  });

  it("tells the waiting attendees when the approval left more places than before, under the event as attendees know it", async () => {
    repo.placeCountsOf.mockResolvedValueOnce(counts(0)).mockResolvedValueOnce(counts(10));
    repo.notifyWaitlist.mockResolvedValue(2);
    const outcome = await handleMessage(approval(10), { sql: inbox() });

    expect(outcome).toMatchObject({ outcome: "built", told: 2 });
    expect(repo.notifyWaitlist).toHaveBeenCalledWith(
      expect.anything(),
      { eventId: EVENT, eventReference: "EVT-000123", name: "R Test Symposium" },
      expect.objectContaining({ placesRemaining: 10, actor: { userId: null, role: "SYSTEM" } }),
    );
  });

  it("names the event from the approval when the listing has not arrived yet", async () => {
    repo.placeCountsOf.mockResolvedValueOnce(counts(0)).mockResolvedValueOnce(counts(5));
    repo.findListing.mockResolvedValue(null);
    await handleMessage(approval(5), { sql: inbox() });
    expect(repo.notifyWaitlist.mock.calls[0]![1]).toEqual({ eventId: EVENT, eventReference: "EVT-000123", name: "R Test Symposium" });
  });

  it("tells nobody when places did not grow", async () => {
    repo.placeCountsOf.mockResolvedValue(counts(4));
    expect(await handleMessage(approval(4), { sql: inbox() })).toMatchObject({ told: 0 });
    expect(repo.notifyWaitlist).not.toHaveBeenCalled();
  });

  it("counts places remaining net of registrations still waiting for a seat", async () => {
    // 3 free seats less 2 additions awaiting one is 1 place: growing from 0 to 1 opens a place.
    repo.placeCountsOf.mockResolvedValueOnce(counts(0)).mockResolvedValueOnce(counts(3, 2));
    await handleMessage(approval(3), { sql: inbox() });
    expect(repo.notifyWaitlist.mock.calls[0]![2].placesRemaining).toBe(1);
  });

  it("ignores a message of another type, and an approval that names no layout capacity", async () => {
    expect(await handleMessage(listingMessage(EVENT, "EVT-000123"), { sql: inbox() })).toEqual({ outcome: "ignored", reason: "other-type" });

    const data = JSON.parse(approval(10));
    delete data.data.layout;
    delete data.data.layoutCapacity;
    expect(await handleMessage(JSON.stringify(data), { sql: inbox() })).toEqual({ outcome: "ignored", reason: "no-layout-capacity" });
    expect(repo.createSeats).not.toHaveBeenCalled();
  });

  it.each([[null], ["not json"], ["{}"]])("reports a message that cannot be read (%s) as invalid, never throws", async (value) => {
    const outcome = await handleMessage(value, { sql: inbox() });
    expect(outcome.outcome).toBe("invalid");
  });

  it("lets a database failure through so the consumer gets the message again", async () => {
    repo.createSeats.mockRejectedValue(new Error("deadlock detected"));
    await expect(handleMessage(approval(10), { sql: inbox() })).rejects.toThrow("deadlock detected");
  });
});

describe("the listing consumer (R1, R3)", () => {
  const listing = (status = "CONFIRMED") => listingMessage(EVENT, "EVT-000123", { status });

  it("applies a listing snapshot after recording it in the inbox", async () => {
    const sql = inbox();
    expect(await handleListingMessage(listing(), { sql })).toEqual({ outcome: "applied", stale: false, cancelled: 0 });
    expect(sql.calls[0]!.values[1]).toBe(LISTING_CONSUMER);
    expect(repo.applyListing).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ eventId: EVENT, status: "CONFIRMED" }));
    expect(repo.cancelEventRegistrations).not.toHaveBeenCalled();
  });

  it("says a snapshot was stale when a newer one is already applied, and cancels nothing", async () => {
    repo.applyListing.mockResolvedValue(false);
    expect(await handleListingMessage(listing(), { sql: inbox() })).toEqual({ outcome: "applied", stale: true, cancelled: 0 });
  });

  it("cancels the registrations when a snapshot says the event is Cancelled", async () => {
    repo.cancelEventRegistrations.mockResolvedValue({ cancelled: 4, retiredSeats: 10, cancelledEntries: 1 });
    const outcome = await handleListingMessage(listing("CANCELLED"), { sql: inbox() });
    expect(outcome).toEqual({ outcome: "applied", stale: false, cancelled: 4 });
    expect(repo.cancelEventRegistrations).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ eventId: EVENT, cancelledAt: expect.any(String) }));
  });

  it("records an event.cancelled and cancels its registrations at the time it was cancelled", async () => {
    repo.cancelEventRegistrations.mockResolvedValue({ cancelled: 2, retiredSeats: 5, cancelledEntries: 0 });
    const outcome = await handleListingMessage(cancelledMessage(EVENT, "EVT-000123", "2026-12-06T02:00:00.000Z"), { sql: inbox() });
    expect(outcome).toEqual({ outcome: "applied", stale: false, cancelled: 2 });
    expect(repo.closeListing).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ eventId: EVENT }));
    expect(repo.cancelEventRegistrations).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ cancelledAt: "2026-12-06T02:00:00.000Z" }));
    expect(repo.applyListing).not.toHaveBeenCalled();
  });

  it("does nothing for a message already consumed", async () => {
    expect(await handleListingMessage(listing(), { sql: inbox(false) })).toEqual({ outcome: "duplicate" });
    expect(repo.applyListing).not.toHaveBeenCalled();
  });

  it("ignores a message of another type, and reports an unreadable one as invalid", async () => {
    expect(await handleListingMessage(approval(10), { sql: inbox() })).toEqual({ outcome: "ignored", reason: "other-type" });
    expect((await handleListingMessage("{", { sql: inbox() })).outcome).toBe("invalid");
    expect((await handleListingMessage(null, { sql: inbox() })).outcome).toBe("invalid");
  });
});
