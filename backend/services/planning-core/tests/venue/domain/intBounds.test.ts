import { describe, expect, it } from "vitest";
import { MAX_HEADCOUNT, MAX_REMINDER_LEAD_MINUTES, MAX_SETUP_MINUTES } from "../../../src/shared/limits.js";
import { validateVenue, type VenueInput } from "../../../src/modules/venue/domain/venueRecord.js";
import { readBookingRequest } from "../../../src/modules/venue/domain/bookingRequest.js";
import { readHoldRequest } from "../../../src/modules/venue/domain/hold.js";

/**
 * C1 trigger: a whole number that does not fit a Postgres `int` raised 22003 from
 * the driver, an unhandled rejection that ended the process. Each int input is
 * refused with VALIDATION_FAILED, naming the field and its bound, at the bound.
 */

const open = { opensAt: "08:00", closesAt: "22:00" };
const venue = (changes: Partial<VenueInput> = {}): VenueInput => ({
  name: "Hall",
  building: "Block A",
  maxCapacity: 300,
  layouts: [{ name: "Theatre", capacity: 300 }],
  facilities: [],
  accessibilityFeatures: [],
  operatingHours: { monday: open, tuesday: open, wednesday: open, thursday: open, friday: open, saturday: null, sunday: null },
  setupMinutes: 0,
  turnaroundMinutes: 0,
  isActive: true,
  ...changes,
});
const venueFields = (input: VenueInput) => {
  const result = validateVenue(input);
  return result.ok ? [] : result.fields;
};

describe("venue integer bounds (C1)", () => {
  it("accepts the largest capacity and refuses one more, naming the bound", () => {
    expect(venueFields(venue({ maxCapacity: MAX_HEADCOUNT, layouts: [{ name: "T", capacity: MAX_HEADCOUNT }] }))).toEqual([]);
    expect(venueFields(venue({ maxCapacity: MAX_HEADCOUNT + 1, layouts: [{ name: "T", capacity: MAX_HEADCOUNT + 1 }] }))).toEqual([
      { field: "maxCapacity", message: "Maximum capacity must be a whole number from 1 to 1000000." },
      { field: "layouts[0].capacity", message: "Layout capacity must be a whole number from 1 to 1000000." },
    ]);
  });

  it("still refuses a capacity of zero and accepts 1", () => {
    expect(venueFields(venue({ maxCapacity: 0 })).map((f) => f.field)).toEqual(["maxCapacity"]);
    expect(venueFields(venue({ maxCapacity: 1, layouts: [{ name: "T", capacity: 1 }] }))).toEqual([]);
  });

  it("accepts the largest setup and turnaround and refuses one more minute", () => {
    expect(venueFields(venue({ setupMinutes: MAX_SETUP_MINUTES, turnaroundMinutes: MAX_SETUP_MINUTES }))).toEqual([]);
    expect(venueFields(venue({ setupMinutes: MAX_SETUP_MINUTES + 1, turnaroundMinutes: 3_000_000_000 }))).toEqual([
      { field: "setupMinutes", message: "Setup time must be a whole number of minutes from 0 to 10080." },
      { field: "turnaroundMinutes", message: "Turnaround time must be a whole number of minutes from 0 to 10080." },
    ]);
  });

  it("refuses a negative or fractional number of minutes", () => {
    expect(venueFields(venue({ setupMinutes: -1, turnaroundMinutes: 1.5 })).map((f) => f.field)).toEqual([
      "setupMinutes",
      "turnaroundMinutes",
    ]);
  });
});

const EVENT = "22222222-2222-4222-8222-222222222222";
const VENUE = "33333333-3333-4333-8333-333333333333";
const booking = (expectedAttendance: unknown) => ({
  eventId: EVENT,
  venueId: VENUE,
  startsAt: "2026-12-02T14:00+08:00",
  endsAt: "2026-12-02T18:00+08:00",
  layout: "Theatre",
  expectedAttendance,
  facilities: [],
  accessibilityFeatures: [],
});

describe("expectedAttendance bound on a booking request (C1)", () => {
  it("accepts 1 and the largest attendance", () => {
    expect(readBookingRequest(booking(1)).ok).toBe(true);
    expect(readBookingRequest(booking(MAX_HEADCOUNT)).ok).toBe(true);
  });

  it("refuses 0, one more than the bound, and a number too big for an int", () => {
    for (const value of [0, MAX_HEADCOUNT + 1, 3_000_000_000]) {
      expect(readBookingRequest(booking(value))).toEqual({
        ok: false,
        fields: [{ field: "expectedAttendance", message: "Expected attendance must be a whole number from 1 to 1000000." }],
      });
    }
  });

  it("refuses text and fractions", () => {
    expect(readBookingRequest(booking("5")).ok).toBe(false);
    expect(readBookingRequest(booking(2.5)).ok).toBe(false);
  });
});

const hold = (reminderLeadMinutes: unknown) => ({
  eventId: EVENT,
  venueId: VENUE,
  startsAt: "2026-12-02T14:00+08:00",
  endsAt: "2026-12-02T18:00+08:00",
  reminderLeadMinutes,
});

describe("reminderLeadMinutes bound on a hold (C1)", () => {
  it("accepts 1 and the largest lead", () => {
    expect(readHoldRequest(hold(1)).ok).toBe(true);
    expect(readHoldRequest(hold(MAX_REMINDER_LEAD_MINUTES)).ok).toBe(true);
  });

  it("refuses 0, one more than the bound, and a number too big for an int", () => {
    for (const value of [0, MAX_REMINDER_LEAD_MINUTES + 1, 3_000_000_000]) {
      expect(readHoldRequest(hold(value))).toEqual({
        ok: false,
        fields: [{ field: "reminderLeadMinutes", message: "Enter a whole number of minutes from 1 to 525600." }],
      });
    }
  });
});
