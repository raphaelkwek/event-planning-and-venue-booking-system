import { describe, expect, it } from "vitest";
import {
  isListed,
  mayWithdraw,
  placesRemaining,
  takesRegistrations,
  windowState,
  withdrawalDeadline,
  type ListingFacts,
} from "../../src/domain/registrationRules.js";

/**
 * R1, R2, R4 — the rules, at their boundaries: the closing instant (R1), the
 * opening and closing instants (R2), the deadline and the event's start (R4),
 * and places remaining that never goes negative (D-01).
 */

const OPENS = "2026-12-01T01:00:00.000Z";
const CLOSES = "2026-12-10T10:00:00.000Z";
const DEADLINE = "2026-12-14T10:00:00.000Z";
const START = "2026-12-16T06:00:00.000Z";

const open: ListingFacts = {
  status: "CONFIRMED",
  registrationRequired: true,
  registrationOpensAt: OPENS,
  registrationClosesAt: CLOSES,
  withdrawalDeadlineAt: DEADLINE,
  startsAt: START,
};

const ms = (iso: string, offset = 0) => new Date(Date.parse(iso) + offset);

describe("takesRegistrations (R2)", () => {
  it("is true only for a Confirmed event with registration enabled", () => {
    expect(takesRegistrations(open)).toBe(true);
    expect(takesRegistrations({ ...open, registrationRequired: false })).toBe(false);
    for (const status of ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "APPROVED", "PLANNING", "SAFETY_REVIEW", "REJECTED", "CANCELLED", "COMPLETED"]) {
      expect(takesRegistrations({ ...open, status }), status).toBe(false);
    }
  });
});

describe("isListed (R1)", () => {
  it("R1-T1 lists a Confirmed event with registration enabled before its closing", () => {
    expect(isListed(open, ms(OPENS))).toBe(true);
  });

  it("R1-T5 lists it exactly at the closing instant, which has not passed, and not a millisecond after", () => {
    expect(isListed(open, ms(CLOSES, -1))).toBe(true);
    expect(isListed(open, ms(CLOSES))).toBe(true);
    expect(isListed(open, ms(CLOSES, 1))).toBe(false);
  });

  it("R1-T5 lists an event whose registration has not opened yet, as its closing has not passed", () => {
    expect(isListed(open, ms(OPENS, -86_400_000))).toBe(true);
  });

  it("R1-T3 R1-T4 does not list one without registration, in any other status, or with no closing", () => {
    expect(isListed({ ...open, registrationRequired: false }, ms(OPENS))).toBe(false);
    expect(isListed({ ...open, status: "PLANNING" }, ms(OPENS))).toBe(false);
    expect(isListed({ ...open, registrationClosesAt: null }, ms(OPENS))).toBe(false);
  });
});

describe("windowState (R2)", () => {
  it("R2-T7 R2-T8 is open exactly at the opening instant, and not yet open a millisecond before", () => {
    expect(windowState(open, ms(OPENS, -1))).toBe("NOT_YET_OPEN");
    expect(windowState(open, ms(OPENS))).toBe("OPEN");
  });

  it("R2-T9 R2-T10 is open exactly at the closing instant, and closed a millisecond after", () => {
    expect(windowState(open, ms(CLOSES))).toBe("OPEN");
    expect(windowState(open, ms(CLOSES, 1))).toBe("CLOSED");
  });

  it("treats a window missing either end as closed", () => {
    expect(windowState({ ...open, registrationOpensAt: null }, ms(OPENS))).toBe("CLOSED");
    expect(windowState({ ...open, registrationClosesAt: null }, ms(OPENS))).toBe("CLOSED");
  });
});

describe("withdrawalDeadline and mayWithdraw (R4)", () => {
  it("R4-T5 R4-T6 allows withdrawal exactly at the organiser's deadline, and refuses it a millisecond after", () => {
    expect(withdrawalDeadline(open)).toEqual({ at: DEADLINE, isEventStart: false });
    expect(mayWithdraw(open, ms(DEADLINE))).toBe(true);
    expect(mayWithdraw(open, ms(DEADLINE, 1))).toBe(false);
  });

  it("R4-T7 without a deadline, allows withdrawal up to and including the event's start", () => {
    const none = { ...open, withdrawalDeadlineAt: null };
    expect(withdrawalDeadline(none)).toEqual({ at: START, isEventStart: true });
    expect(mayWithdraw(none, ms(START))).toBe(true);
    expect(mayWithdraw(none, ms(START, 1))).toBe(false);
  });

  it("holds a deadline later than the start to the start", () => {
    const late = { ...open, withdrawalDeadlineAt: "2026-12-17T00:00:00.000Z" };
    expect(withdrawalDeadline(late)).toEqual({ at: START, isEventStart: true });
    expect(withdrawalDeadline({ ...open, withdrawalDeadlineAt: START })).toEqual({ at: START, isEventStart: false });
  });

  it("keeps a deadline when the event has no start, and has no limit with neither", () => {
    expect(withdrawalDeadline({ ...open, startsAt: null })).toEqual({ at: DEADLINE, isEventStart: false });
    expect(withdrawalDeadline({ ...open, withdrawalDeadlineAt: null, startsAt: null })).toBeNull();
    expect(mayWithdraw({ ...open, withdrawalDeadlineAt: null, startsAt: null }, ms(START, 1))).toBe(true);
  });
});

describe("placesRemaining (R2, D-01)", () => {
  it("is the number of free seats when every registration holds one", () => {
    expect(placesRemaining(3, 0)).toBe(3);
    expect(placesRemaining(1, 0)).toBe(1);
    expect(placesRemaining(0, 0)).toBe(0);
  });

  it("R2-T13 counts an addition above capacity (R7) against the free seats, and is never negative", () => {
    expect(placesRemaining(2, 1)).toBe(1);
    expect(placesRemaining(1, 1)).toBe(0);
    expect(placesRemaining(0, 1)).toBe(0);
    expect(placesRemaining(0, 3)).toBe(0);
  });
});
