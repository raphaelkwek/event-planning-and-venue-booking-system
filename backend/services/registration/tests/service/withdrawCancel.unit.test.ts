import { beforeEach, describe, expect, it, vi } from "vitest";
import { aListing, aRegistration, anEntry, ATTENDEE, EVENT, fakeSql, NOW } from "../support/builders.js";

/**
 * R4, R3, R6 — withdrawing a registration and cancelling an event's, with the
 * repo layer scripted: who may withdraw and when, when a withdrawal tells the
 * waitlist that a place opened, and what a cancellation writes for whom. The
 * SQL runs against Postgres in r3Cards.test.ts, r4Cards.test.ts and r6Cards.test.ts.
 */

const repo = vi.hoisted(() => ({
  findListing: vi.fn(),
  findRegistrationOfAttendee: vi.fn(),
  withdrawRegistration: vi.fn(),
  cancelRegistrationsOfEvent: vi.fn(),
  lockPlaces: vi.fn(),
  releaseSeat: vi.fn(),
  seatUnseated: vi.fn(),
  placeCountsOf: vi.fn(),
  retireSeatsOfEvent: vi.fn(),
  cancelEntriesOfEvent: vi.fn(),
  markWaitingNotified: vi.fn(),
  writeRegistrationOutbox: vi.fn(),
}));

vi.mock("../../src/repo/listings.js", () => ({ findListing: repo.findListing }));
vi.mock("../../src/repo/registrations.js", () => ({
  findRegistrationOfAttendee: repo.findRegistrationOfAttendee,
  withdrawRegistration: repo.withdrawRegistration,
  cancelRegistrationsOfEvent: repo.cancelRegistrationsOfEvent,
}));
vi.mock("../../src/repo/seats.js", () => ({
  lockPlaces: repo.lockPlaces,
  releaseSeat: repo.releaseSeat,
  seatUnseated: repo.seatUnseated,
  placeCountsOf: repo.placeCountsOf,
  retireSeatsOfEvent: repo.retireSeatsOfEvent,
}));
vi.mock("../../src/repo/waitlist.js", () => ({ cancelEntriesOfEvent: repo.cancelEntriesOfEvent, markWaitingNotified: repo.markWaitingNotified }));
vi.mock("../../src/outbox/write.js", () => ({ writeRegistrationOutbox: repo.writeRegistrationOutbox }));

const { withdraw } = await import("../../src/service/withdraw.js");
const { cancelEventRegistrations } = await import("../../src/service/cancel.js");

const input = { registrationId: aRegistration().id, attendeeId: ATTENDEE, now: NOW, correlationId: "corr-w" };
const withdrawn = () => aRegistration({ status: "WITHDRAWN", withdrawnAt: NOW.toISOString() });
const messageTypes = () => repo.writeRegistrationOutbox.mock.calls.map(([, message]) => message.messageType);

beforeEach(() => {
  vi.resetAllMocks();
  repo.findRegistrationOfAttendee.mockResolvedValue(aRegistration());
  repo.findListing.mockResolvedValue(aListing());
  repo.withdrawRegistration.mockResolvedValue(withdrawn());
  repo.releaseSeat.mockResolvedValue("PUBLIC");
  repo.seatUnseated.mockResolvedValue(0);
  repo.placeCountsOf.mockResolvedValue(new Map([[EVENT, { freeSeats: 1, unseatedRegistrations: 0 }]]));
  repo.markWaitingNotified.mockResolvedValue([]);
});

describe("withdraw (R4)", () => {
  it("withdraws: frees the seat, tells the waitlist a place opened and writes registration.withdrawn", async () => {
    repo.markWaitingNotified.mockResolvedValue([anEntry()]);
    const { sql } = fakeSql();

    const outcome = await withdraw(sql, input);

    expect(outcome).toMatchObject({ ok: true, registration: { status: "WITHDRAWN" } });
    expect(repo.lockPlaces).toHaveBeenCalledWith(expect.anything(), EVENT, "exclusive");
    expect(repo.releaseSeat).toHaveBeenCalledWith(expect.anything(), "seat-1");
    expect(messageTypes()).toEqual(["waitlist.place-opened", "registration.withdrawn"]);
    expect(repo.writeRegistrationOutbox.mock.calls[0]![1].data).toMatchObject({ placesRemaining: 1, attendeeId: ATTENDEE });
  });

  it("does not tell the waitlist when the freed seat went to an addition above capacity (R7)", async () => {
    repo.seatUnseated.mockResolvedValue(1);
    const { sql } = fakeSql();
    expect(await withdraw(sql, input)).toMatchObject({ ok: true });
    expect(repo.markWaitingNotified).not.toHaveBeenCalled();
    expect(messageTypes()).toEqual(["registration.withdrawn"]);
  });

  it("does not tell the waitlist when the freed seat was a VIP one", async () => {
    repo.releaseSeat.mockResolvedValue("VIP");
    const { sql } = fakeSql();
    await withdraw(sql, input);
    expect(repo.markWaitingNotified).not.toHaveBeenCalled();
  });

  it("withdraws a registration that holds no seat without touching seats", async () => {
    repo.withdrawRegistration.mockResolvedValue({ ...withdrawn(), seatId: null });
    const { sql } = fakeSql();
    expect(await withdraw(sql, input)).toMatchObject({ ok: true });
    expect(repo.releaseSeat).not.toHaveBeenCalled();
    expect(messageTypes()).toEqual(["registration.withdrawn"]);
  });

  it("answers NOT_FOUND for a registration that is not the caller's, and opens no transaction", async () => {
    repo.findRegistrationOfAttendee.mockResolvedValue(null);
    const { sql, begin } = fakeSql();
    expect(await withdraw(sql, input)).toEqual({ ok: false, code: "NOT_FOUND" });
    expect(begin).not.toHaveBeenCalled();
  });

  it.each(["WITHDRAWN", "CANCELLED"] as const)("answers NOT_ACTIVE for a %s registration", async (status) => {
    const held = aRegistration({ status });
    repo.findRegistrationOfAttendee.mockResolvedValue(held);
    const { sql, begin } = fakeSql();
    expect(await withdraw(sql, input)).toEqual({ ok: false, code: "NOT_ACTIVE", registration: held });
    expect(begin).not.toHaveBeenCalled();
  });

  it("refuses after the deadline, naming it, and changes nothing", async () => {
    repo.findListing.mockResolvedValue(aListing({ withdrawalDeadlineAt: "2026-12-04T10:00:00.000Z" }));
    const { sql, begin } = fakeSql();
    expect(await withdraw(sql, input)).toMatchObject({ ok: false, code: "DEADLINE_PASSED", deadline: { at: "2026-12-04T10:00:00.000Z", isEventStart: false } });
    expect(begin).not.toHaveBeenCalled();
  });

  it("allows a withdrawal at the instant before the deadline", async () => {
    repo.findListing.mockResolvedValue(aListing({ withdrawalDeadlineAt: "2026-12-05T02:00:00.001Z" }));
    const { sql } = fakeSql();
    expect(await withdraw(sql, input)).toMatchObject({ ok: true });
  });

  it("reports NOT_ACTIVE with the current state when the registration changed between the read and the update", async () => {
    const current = aRegistration({ status: "CANCELLED" });
    repo.withdrawRegistration.mockResolvedValue(null);
    repo.findRegistrationOfAttendee.mockResolvedValueOnce(aRegistration()).mockResolvedValueOnce(current);
    const { sql } = fakeSql();
    expect(await withdraw(sql, input)).toEqual({ ok: false, code: "NOT_ACTIVE", registration: current });
    expect(repo.writeRegistrationOutbox).not.toHaveBeenCalled();
  });
});

describe("cancelEventRegistrations (R3, F4, R6)", () => {
  const event = { eventId: EVENT, eventReference: "EVT-000123", eventName: "R Test Symposium", cancelledAt: "2026-12-06T02:00:00.000Z" };

  it("cancels registrations and waiting entries, retires seats and tells each attendee under the exclusive lock", async () => {
    const cancelled = [aRegistration({ id: "r1", status: "CANCELLED", cancelledAt: event.cancelledAt }), aRegistration({ id: "r2", attendeeId: "other", status: "CANCELLED", cancelledAt: event.cancelledAt })];
    repo.cancelRegistrationsOfEvent.mockResolvedValue(cancelled);
    repo.retireSeatsOfEvent.mockResolvedValue(5);
    repo.cancelEntriesOfEvent.mockResolvedValue([anEntry({ status: "CANCELLED", cancelledAt: event.cancelledAt })]);
    const { tx } = fakeSql();

    const result = await cancelEventRegistrations(tx as never, event);

    expect(result).toEqual({ cancelled: 2, retiredSeats: 5, cancelledEntries: 1 });
    expect(repo.lockPlaces).toHaveBeenCalledWith(tx, EVENT, "exclusive");
    expect(messageTypes()).toEqual(["registration.cancelled", "registration.cancelled", "waitlist.cancelled"]);
    const first = repo.writeRegistrationOutbox.mock.calls[0]![1];
    expect(first.actor).toEqual({ userId: null, role: "SYSTEM" });
    expect(first.data).toMatchObject({ registrationId: "r1", eventReference: "EVT-000123", cancelledAt: event.cancelledAt });
    expect(repo.writeRegistrationOutbox.mock.calls[2]![1].data).toMatchObject({ waitlistReference: "WL-000001", attendeeId: ATTENDEE });
  });

  it("is idempotent: a second run finds nothing and writes no message", async () => {
    repo.cancelRegistrationsOfEvent.mockResolvedValue([]);
    repo.retireSeatsOfEvent.mockResolvedValue(0);
    repo.cancelEntriesOfEvent.mockResolvedValue([]);
    const { tx } = fakeSql();
    expect(await cancelEventRegistrations(tx as never, event)).toEqual({ cancelled: 0, retiredSeats: 0, cancelledEntries: 0 });
    expect(repo.writeRegistrationOutbox).not.toHaveBeenCalled();
  });
});
