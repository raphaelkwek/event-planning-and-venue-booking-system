import { beforeEach, describe, expect, it, vi } from "vitest";
import { aListing, aRegistration, anEntry, ATTENDEE, EVENT, fakeSql, NOW } from "../support/builders.js";

/**
 * R7, R6 — adding an attendee by hand and joining or leaving the waitlist,
 * with the repo layer scripted: the order the decisions are taken in and what
 * each refusal leaves behind (nothing). The SQL and the locks run against
 * Postgres in r5Cards.test.ts to r7Cards.test.ts.
 */

const repo = vi.hoisted(() => ({
  findListing: vi.fn(),
  findActiveRegistration: vi.fn(),
  insertManualRegistration: vi.fn(),
  registrationCountsOf: vi.fn(),
  claimSeat: vi.fn(),
  lockAttendee: vi.fn(),
  lockPlaces: vi.fn(),
  placeCountsOf: vi.fn(),
  capacityOf: vi.fn(),
  closeEntryRegistered: vi.fn(),
  findWaitingEntry: vi.fn(),
  insertWaitlistEntry: vi.fn(),
  findEntryOfAttendee: vi.fn(),
  withdrawEntry: vi.fn(),
  markWaitingNotified: vi.fn(),
  writeRegistrationOutbox: vi.fn(),
}));

vi.mock("../../src/repo/listings.js", () => ({ findListing: repo.findListing }));
vi.mock("../../src/repo/registrations.js", () => ({
  DuplicateRegistrationError: class DuplicateRegistrationError extends Error {},
  findActiveRegistration: repo.findActiveRegistration,
  insertManualRegistration: repo.insertManualRegistration,
  registrationCountsOf: repo.registrationCountsOf,
}));
vi.mock("../../src/repo/seats.js", () => ({
  claimSeat: repo.claimSeat,
  lockAttendee: repo.lockAttendee,
  lockPlaces: repo.lockPlaces,
  placeCountsOf: repo.placeCountsOf,
}));
vi.mock("../../src/repo/venues.js", () => ({ capacityOf: repo.capacityOf }));
vi.mock("../../src/repo/waitlist.js", () => ({
  DuplicateWaitlistEntryError: class DuplicateWaitlistEntryError extends Error {},
  closeEntryRegistered: repo.closeEntryRegistered,
  findWaitingEntry: repo.findWaitingEntry,
  insertWaitlistEntry: repo.insertWaitlistEntry,
  findEntryOfAttendee: repo.findEntryOfAttendee,
  withdrawEntry: repo.withdrawEntry,
  markWaitingNotified: repo.markWaitingNotified,
}));
vi.mock("../../src/outbox/write.js", () => ({ writeRegistrationOutbox: repo.writeRegistrationOutbox }));

const { addManually } = await import("../../src/service/addManually.js");
const { joinWaitlist, leaveWaitlist, notifyWaitlist } = await import("../../src/service/waitlist.js");
const { DuplicateRegistrationError } = await import("../../src/repo/registrations.js");
const { DuplicateWaitlistEntryError } = await import("../../src/repo/waitlist.js");

const attendee = { id: ATTENDEE, displayName: "Attendee One", email: "attendee@connectsphere.test" };
const addition = (over: Record<string, unknown> = {}) => ({
  listing: aListing(),
  attendee,
  addedBy: { id: "organiser-1", role: "EVENT_ORGANISER" as const, name: "Organiser One" },
  reason: "VIP guest",
  confirmOverCapacity: false,
  now: NOW,
  correlationId: "corr-a",
  ...over,
});

beforeEach(() => {
  vi.resetAllMocks();
  repo.findListing.mockResolvedValue(aListing());
  repo.findActiveRegistration.mockResolvedValue(null);
  repo.capacityOf.mockResolvedValue({ capacity: 10, confirmedBookings: 1 });
  repo.registrationCountsOf.mockResolvedValue({ registered: 3 });
  repo.claimSeat.mockResolvedValue({ id: "seat-9" });
  repo.insertManualRegistration.mockResolvedValue(aRegistration({ addedBy: "organiser-1" }));
});

describe("addManually (R7)", () => {
  it("claims a VIP seat first and writes registration.added with who added it", async () => {
    const { sql } = fakeSql();
    const outcome = await addManually(sql, addition());

    expect(outcome).toMatchObject({ ok: true, preview: { capacity: 10 } });
    expect(repo.lockPlaces).toHaveBeenCalledWith(expect.anything(), EVENT, "exclusive");
    expect(repo.claimSeat).toHaveBeenCalledTimes(1);
    expect(repo.claimSeat).toHaveBeenCalledWith(expect.anything(), { eventId: EVENT, pool: "VIP", attendeeId: ATTENDEE });
    expect(repo.insertManualRegistration).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ seatId: "seat-9", addedBy: "organiser-1", reason: "VIP guest" }));
    expect(repo.writeRegistrationOutbox).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        messageType: "registration.added",
        actor: { userId: "organiser-1", role: "EVENT_ORGANISER" },
        data: expect.objectContaining({ addedBy: "organiser-1", addedByName: "Organiser One", addedOverCapacity: false }),
      }),
    );
  });

  it("falls back to a public seat when no VIP seat is free", async () => {
    repo.claimSeat.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "seat-p" });
    const { sql } = fakeSql();
    expect(await addManually(sql, addition())).toMatchObject({ ok: true });
    expect(repo.claimSeat.mock.calls.map(([, claim]) => claim.pool)).toEqual(["VIP", "PUBLIC"]);
    expect(repo.insertManualRegistration).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ seatId: "seat-p" }));
  });

  it("refuses above capacity unless the caller confirmed it, and saves nothing", async () => {
    repo.claimSeat.mockResolvedValue(null);
    repo.registrationCountsOf.mockResolvedValue({ registered: 10 });
    const { sql } = fakeSql();
    const outcome = await addManually(sql, addition());
    expect(outcome).toMatchObject({ ok: false, code: "OVER_CAPACITY_UNCONFIRMED", registered: 10, preview: { capacity: 10, totalAfter: 11 } });
    expect(repo.insertManualRegistration).not.toHaveBeenCalled();
    expect(repo.writeRegistrationOutbox).not.toHaveBeenCalled();
  });

  it("saves an addition above capacity, holding no seat, once the caller confirmed it", async () => {
    repo.claimSeat.mockResolvedValue(null);
    repo.insertManualRegistration.mockResolvedValue(aRegistration({ seatId: null, addedOverCapacity: true }));
    const { sql } = fakeSql();
    expect(await addManually(sql, addition({ confirmOverCapacity: true }))).toMatchObject({ ok: true });
    expect(repo.insertManualRegistration).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ seatId: null }));
    expect(repo.writeRegistrationOutbox.mock.calls[0]![1].data.addedOverCapacity).toBe(true);
  });

  it("re-reads the event inside the lock and refuses when it closed in the meantime", async () => {
    repo.findListing.mockResolvedValue(aListing({ status: "CANCELLED" }));
    const { sql } = fakeSql();
    expect(await addManually(sql, addition())).toEqual({ ok: false, code: "EVENT_CLOSED", status: "CANCELLED" });
    expect(repo.claimSeat).not.toHaveBeenCalled();
  });

  it("refuses as closed, with the status it was given, when the event has vanished", async () => {
    repo.findListing.mockResolvedValue(null);
    const { sql } = fakeSql();
    expect(await addManually(sql, addition({ listing: aListing({ status: "CONFIRMED" }) }))).toEqual({ ok: false, code: "EVENT_CLOSED", status: "CONFIRMED" });
  });

  it("refuses a duplicate naming the registration the attendee holds", async () => {
    const held = aRegistration({ reference: "REG-000077" });
    repo.findActiveRegistration.mockResolvedValue(held);
    const { sql } = fakeSql();
    expect(await addManually(sql, addition())).toEqual({ ok: false, code: "DUPLICATE", existing: held });
    expect(repo.claimSeat).not.toHaveBeenCalled();
  });

  it("turns a unique-index refusal into DUPLICATE, or rethrows when nothing is found", async () => {
    const held = aRegistration({ reference: "REG-000078" });
    repo.insertManualRegistration.mockRejectedValue(new DuplicateRegistrationError());
    repo.findActiveRegistration.mockResolvedValueOnce(null).mockResolvedValueOnce(held);
    const { sql } = fakeSql();
    expect(await addManually(sql, addition())).toEqual({ ok: false, code: "DUPLICATE", existing: held });

    repo.findActiveRegistration.mockReset().mockResolvedValue(null);
    await expect(addManually(sql, addition())).rejects.toBeInstanceOf(DuplicateRegistrationError);
  });

  it("rethrows any other failure", async () => {
    repo.insertManualRegistration.mockRejectedValue(new Error("disk full"));
    const { sql } = fakeSql();
    await expect(addManually(sql, addition())).rejects.toThrow("disk full");
  });
});

describe("joinWaitlist (R6)", () => {
  const input = { eventId: EVENT, attendeeId: ATTENDEE, now: NOW };
  beforeEach(() => {
    repo.placeCountsOf.mockResolvedValue(new Map([[EVENT, { freeSeats: 0, unseatedRegistrations: 0 }]]));
    repo.findWaitingEntry.mockResolvedValue(null);
    repo.insertWaitlistEntry.mockResolvedValue(anEntry());
    repo.findEntryOfAttendee.mockResolvedValue(anEntry({ position: 4 }));
  });

  it("joins a full event and returns the entry with its place in the line", async () => {
    const { sql } = fakeSql();
    const outcome = await joinWaitlist(sql, input);
    expect(outcome).toMatchObject({ ok: true, entry: { position: 4 } });
    expect(repo.lockPlaces).toHaveBeenCalledWith(expect.anything(), EVENT, "shared");
  });

  it("answers EVENT_NOT_FOUND for an unknown event, and for one that takes no registrations", async () => {
    const { sql } = fakeSql();
    repo.findListing.mockResolvedValueOnce(null);
    expect(await joinWaitlist(sql, input)).toEqual({ ok: false, code: "EVENT_NOT_FOUND" });
    repo.findListing.mockResolvedValueOnce(aListing({ status: "PLANNING" }));
    expect(await joinWaitlist(sql, input)).toEqual({ ok: false, code: "EVENT_NOT_FOUND" });
  });

  it("refuses outside the window, with the listing", async () => {
    const { sql } = fakeSql();
    expect(await joinWaitlist(sql, { ...input, now: new Date("2026-12-11T00:00:00.000Z") })).toMatchObject({ ok: false, code: "OUTSIDE_WINDOW", state: "CLOSED", listing: { eventId: EVENT } });
  });

  it("refuses while a place remains, saying how many", async () => {
    repo.placeCountsOf.mockResolvedValue(new Map([[EVENT, { freeSeats: 3, unseatedRegistrations: 1 }]]));
    const { sql } = fakeSql();
    expect(await joinWaitlist(sql, input)).toMatchObject({ ok: false, code: "PLACES_AVAILABLE", placesRemaining: 2 });
    expect(repo.insertWaitlistEntry).not.toHaveBeenCalled();
  });

  it("refuses an attendee who already holds a registration", async () => {
    const held = aRegistration();
    repo.findActiveRegistration.mockResolvedValue(held);
    const { sql } = fakeSql();
    expect(await joinWaitlist(sql, input)).toMatchObject({ ok: false, code: "REGISTERED", registration: held });
  });

  it("refuses an attendee who is already waiting", async () => {
    const waiting = anEntry();
    repo.findWaitingEntry.mockResolvedValue(waiting);
    const { sql } = fakeSql();
    expect(await joinWaitlist(sql, input)).toMatchObject({ ok: false, code: "DUPLICATE", existing: waiting });
    expect(repo.insertWaitlistEntry).not.toHaveBeenCalled();
  });

  it("turns a unique-index refusal into DUPLICATE, or rethrows when nothing is found", async () => {
    const waiting = anEntry({ reference: "WL-000042" });
    repo.insertWaitlistEntry.mockRejectedValue(new DuplicateWaitlistEntryError());
    repo.findWaitingEntry.mockResolvedValueOnce(null).mockResolvedValueOnce(waiting);
    const { sql } = fakeSql();
    expect(await joinWaitlist(sql, input)).toMatchObject({ ok: false, code: "DUPLICATE", existing: waiting });

    repo.findWaitingEntry.mockReset().mockResolvedValue(null);
    await expect(joinWaitlist(sql, input)).rejects.toBeInstanceOf(DuplicateWaitlistEntryError);
  });

  it("rethrows any other failure", async () => {
    repo.insertWaitlistEntry.mockRejectedValue(new Error("deadlock detected"));
    const { sql } = fakeSql();
    await expect(joinWaitlist(sql, input)).rejects.toThrow("deadlock detected");
  });
});

describe("leaveWaitlist (R6)", () => {
  const input = { entryId: "44444444-4444-4444-8444-444444444444", attendeeId: ATTENDEE, now: NOW };

  it("leaves a waiting entry", async () => {
    const left = anEntry({ status: "WITHDRAWN", withdrawnAt: NOW.toISOString() });
    repo.withdrawEntry.mockResolvedValue(left);
    const { sql } = fakeSql();
    expect(await leaveWaitlist(sql, input)).toEqual({ ok: true, entry: left });
  });

  it("answers NOT_ACTIVE with the entry when it has stopped waiting", async () => {
    const closed = anEntry({ status: "REGISTERED" });
    repo.withdrawEntry.mockResolvedValue(null);
    repo.findEntryOfAttendee.mockResolvedValue(closed);
    const { sql } = fakeSql();
    expect(await leaveWaitlist(sql, input)).toEqual({ ok: false, code: "NOT_ACTIVE", entry: closed });
  });

  it("answers NOT_FOUND for an entry that is not the caller's", async () => {
    repo.withdrawEntry.mockResolvedValue(null);
    repo.findEntryOfAttendee.mockResolvedValue(null);
    const { sql } = fakeSql();
    expect(await leaveWaitlist(sql, input)).toEqual({ ok: false, code: "NOT_FOUND" });
  });
});

describe("notifyWaitlist (R6)", () => {
  it("writes one waitlist.place-opened per waiting entry and returns how many were told", async () => {
    repo.markWaitingNotified.mockResolvedValue([anEntry({ id: "e1", reference: "WL-1" }), anEntry({ id: "e2", reference: "WL-2", attendeeId: "other" })]);
    const { tx } = fakeSql();
    const told = await notifyWaitlist(tx as never, { eventId: EVENT, eventReference: "EVT-000123", name: "R Test Symposium" }, {
      placesRemaining: 2,
      at: NOW,
      actor: { userId: null, role: "SYSTEM" },
      correlationId: null,
    });
    expect(told).toBe(2);
    expect(repo.writeRegistrationOutbox.mock.calls.map(([, m]) => m.data.waitlistEntryId)).toEqual(["e1", "e2"]);
    expect(repo.writeRegistrationOutbox.mock.calls[0]![1].data).toMatchObject({ placesRemaining: 2, openedAt: NOW.toISOString(), eventName: "R Test Symposium" });
  });

  it("tells nobody when nobody is waiting", async () => {
    repo.markWaitingNotified.mockResolvedValue([]);
    const { tx } = fakeSql();
    expect(await notifyWaitlist(tx as never, { eventId: EVENT, eventReference: "E", name: "N" }, { placesRemaining: 1, at: NOW, actor: { userId: null, role: "SYSTEM" }, correlationId: null })).toBe(0);
    expect(repo.writeRegistrationOutbox).not.toHaveBeenCalled();
  });
});
