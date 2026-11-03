import { describe, expect, it } from "vitest";
import { capacityOpensPlaces, mayJoinWaitlist, withdrawalOpensPlace } from "../../src/domain/waitlistRules.js";

/** R6 — the waitlist's rules, pure, with the window judged at the exact millisecond. */

const listing = {
  status: "CONFIRMED",
  registrationRequired: true,
  registrationOpensAt: "2026-12-01T01:00:00.000Z",
  registrationClosesAt: "2026-12-10T10:00:00.000Z",
  withdrawalDeadlineAt: null,
  startsAt: "2026-12-16T06:00:00.000Z",
};
const during = new Date("2026-12-05T02:00:00.000Z");

describe("mayJoinWaitlist", () => {
  it("R6-T1 lets an attendee wait when the event takes registrations, is open and has no place left", () => {
    expect(mayJoinWaitlist(listing, during, 0)).toEqual({ ok: true });
  });

  it("R6-T2 refuses while a place remains, saying how many", () => {
    expect(mayJoinWaitlist(listing, during, 1)).toEqual({ ok: false, code: "PLACES_AVAILABLE", placesRemaining: 1 });
  });

  it("answers an event that takes no registrations as not found, as R2 does", () => {
    expect(mayJoinWaitlist({ ...listing, status: "PLANNING" }, during, 0)).toEqual({ ok: false, code: "EVENT_NOT_FOUND" });
    expect(mayJoinWaitlist({ ...listing, registrationRequired: false }, during, 0)).toEqual({ ok: false, code: "EVENT_NOT_FOUND" });
  });

  it("R6-T12 holds the attendee to the window: open at the closing instant, closed one millisecond after", () => {
    expect(mayJoinWaitlist(listing, new Date("2026-12-10T10:00:00.000Z"), 0)).toEqual({ ok: true });
    expect(mayJoinWaitlist(listing, new Date("2026-12-10T10:00:00.001Z"), 0)).toEqual({ ok: false, code: "OUTSIDE_WINDOW", state: "CLOSED" });
    expect(mayJoinWaitlist(listing, new Date("2026-12-01T00:59:59.999Z"), 0)).toEqual({ ok: false, code: "OUTSIDE_WINDOW", state: "NOT_YET_OPEN" });
  });
});

describe("when a place opens (R6-T6, R6-T11, R7-T12)", () => {
  it("a withdrawal opens one only when it freed a public seat that no addition above capacity took on", () => {
    expect(withdrawalOpensPlace("PUBLIC", 0)).toBe(true);
    expect(withdrawalOpensPlace("PUBLIC", 1)).toBe(false);
    expect(withdrawalOpensPlace("VIP", 0)).toBe(false);
    expect(withdrawalOpensPlace(null, 0)).toBe(false);
  });

  it("a further confirmed booking opens places only when more remain than before", () => {
    expect(capacityOpensPlaces(0, 2)).toBe(true);
    expect(capacityOpensPlaces(0, 0)).toBe(false);
    expect(capacityOpensPlaces(2, 1)).toBe(false);
    expect(capacityOpensPlaces(1, 1)).toBe(false);
  });
});
