import { describe, expect, it } from "vitest";
import { occupiedPeriod, periodsOverlap } from "../../../src/modules/venue/domain/occupancy.js";

/**
 * H3 (CR-01): an event occupies a venue from its start minus the setup time to
 * its end plus the turnaround time, and occupied periods that merely touch do
 * not overlap. I1, I2, J1, L3, M1, N1 and N2 compare these, not the advertised
 * times; they use these functions through the venue module's index.ts.
 */

const at = (time: string) => new Date(`2026-12-02T${time}:00.000Z`);

describe("occupiedPeriod", () => {
  it("is the customer's example: 10:00–12:00 with 30 min setup and 45 min turnaround occupies 09:30–12:45", () => {
    expect(occupiedPeriod({ start: at("10:00"), end: at("12:00") }, { setupMinutes: 30, turnaroundMinutes: 45 })).toEqual({
      start: at("09:30"),
      end: at("12:45"),
    });
  });

  it("is the advertised period itself when both times are 0", () => {
    expect(occupiedPeriod({ start: at("10:00"), end: at("12:00") }, { setupMinutes: 0, turnaroundMinutes: 0 })).toEqual({
      start: at("10:00"),
      end: at("12:00"),
    });
  });
});

describe("periodsOverlap", () => {
  const first = { start: at("09:30"), end: at("12:45") };

  it("is false for periods that merely touch", () => {
    expect(periodsOverlap(first, { start: at("12:45"), end: at("14:45") })).toBe(false);
    expect(periodsOverlap({ start: at("08:00"), end: at("09:30") }, first)).toBe(false);
  });

  it("is true when one starts a minute before the other ends", () => {
    expect(periodsOverlap(first, { start: at("12:44"), end: at("14:45") })).toBe(true);
  });

  it("is true when one lies inside the other", () => {
    expect(periodsOverlap(first, { start: at("10:00"), end: at("11:00") })).toBe(true);
  });

  it("is false for periods apart", () => {
    expect(periodsOverlap(first, { start: at("15:00"), end: at("16:00") })).toBe(false);
  });
});
