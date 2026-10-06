import { describe, expect, it } from "vitest";
import {
  availableQuantity,
  InsufficientEquipmentError,
  isUnitOverlap,
  peakConcurrentUse,
  shortfall,
  UNIT_OVERLAP_CONSTRAINT,
  UnitAlreadyReservedError,
  type QuantityInPeriod,
} from "../../../src/modules/equipment/domain/availability.js";

/**
 * EN-02.2 (ADR-0006, implementation.md §4.6): bulk stock is limited by its
 * **peak concurrent use** inside a window, not by every overlapping reservation
 * added up, so back-to-back reservations don't count as simultaneous. P1's
 * formula waits on CQ-02 (SPM-157), so the rule lives in this one place.
 */

const at = (hhmm: string) => new Date(`2026-11-02T${hhmm}:00+08:00`);
const use = (from: string, until: string, quantity: number): QuantityInPeriod => ({
  start: at(from),
  end: at(until),
  quantity,
});
const window = (from: string, until: string) => ({ start: at(from), end: at(until) });

describe("peakConcurrentUse", () => {
  it("is zero when nothing is in use", () => {
    expect(peakConcurrentUse([], window("09:00", "17:00"))).toBe(0);
  });

  it("is the quantity of a single use inside the window", () => {
    expect(peakConcurrentUse([use("10:00", "12:00", 4)], window("09:00", "17:00"))).toBe(4);
  });

  it("adds uses that overlap each other", () => {
    expect(peakConcurrentUse([use("10:00", "12:00", 4), use("11:00", "13:00", 3)], window("09:00", "17:00"))).toBe(7);
  });

  it("does not add back-to-back uses: periods that merely touch do not overlap", () => {
    expect(peakConcurrentUse([use("10:00", "12:00", 4), use("12:00", "14:00", 5)], window("09:00", "17:00"))).toBe(5);
  });

  it("takes the highest moment, not the sum of everything in the window", () => {
    const uses = [use("09:00", "10:00", 6), use("11:00", "12:00", 2), use("11:30", "13:00", 3), use("15:00", "16:00", 4)];
    expect(peakConcurrentUse(uses, window("09:00", "17:00"))).toBe(6);
    expect(peakConcurrentUse(uses, window("10:00", "17:00"))).toBe(5);
  });

  it("ignores uses outside the window, including ones that only touch its edges", () => {
    const uses = [use("08:00", "09:00", 9), use("17:00", "18:00", 9), use("12:00", "13:00", 1)];
    expect(peakConcurrentUse(uses, window("09:00", "17:00"))).toBe(1);
  });

  it("counts only the part of a use that falls inside the window", () => {
    const uses = [use("08:00", "10:00", 3), use("09:30", "11:00", 2), use("16:00", "18:00", 4)];
    expect(peakConcurrentUse(uses, window("10:00", "17:00"))).toBe(4);
  });

  it("matches a minute-by-minute count on many random cases", () => {
    const random = seeded(20261006);
    for (let run = 0; run < 300; run += 1) {
      const uses = Array.from({ length: Math.floor(random() * 8) }, () => {
        const start = Math.floor(random() * 24 * 4) * 15;
        const length = (1 + Math.floor(random() * 16)) * 15;
        return { start: minute(start), end: minute(start + length), quantity: 1 + Math.floor(random() * 5) };
      });
      const from = Math.floor(random() * 20 * 4) * 15;
      const span = { start: minute(from), end: minute(from + (1 + Math.floor(random() * 24)) * 15) };

      expect(peakConcurrentUse(uses, span)).toBe(bruteForcePeak(uses, span));
    }
  });
});

describe("availableQuantity and shortfall", () => {
  it("is the total less the peak use, never below zero", () => {
    expect(availableQuantity(10, 4)).toBe(6);
    expect(availableQuantity(10, 10)).toBe(0);
    expect(availableQuantity(3, 5)).toBe(0);
  });

  it("is the requested quantity beyond what is available, or zero", () => {
    expect(shortfall(5, 6)).toBe(0);
    expect(shortfall(6, 6)).toBe(0);
    expect(shortfall(8, 6)).toBe(2);
  });
});

describe("isUnitOverlap", () => {
  it("recognises the per-unit exclusion constraint's violation", () => {
    expect(isUnitOverlap({ code: "23P01", constraint_name: UNIT_OVERLAP_CONSTRAINT })).toBe(true);
  });

  it("ignores other constraints and other errors", () => {
    expect(isUnitOverlap({ code: "23P01", constraint_name: "venue_slot_no_overlap" })).toBe(false);
    expect(isUnitOverlap({ code: "23505", constraint_name: UNIT_OVERLAP_CONSTRAINT })).toBe(false);
    expect(isUnitOverlap(new Error("boom"))).toBe(false);
    expect(isUnitOverlap(undefined)).toBe(false);
  });
});

describe("InsufficientEquipmentError", () => {
  it("names insufficient availability and the shortfall (Q1)", () => {
    const error = new InsufficientEquipmentError({ requested: 8, available: 6 });

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("InsufficientEquipmentError");
    expect(error.code).toBe("INSUFFICIENT_EQUIPMENT");
    expect(error.requested).toBe(8);
    expect(error.available).toBe(6);
    expect(error.shortfall).toBe(2);
    expect(error.message).toBe("Not enough available for this period: 8 requested, 6 available, 2 short.");
  });
});

describe("UnitAlreadyReservedError", () => {
  it("names the unit that is already reserved for an overlapping period", () => {
    const error = new UnitAlreadyReservedError("PROJ-01");

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("UnitAlreadyReservedError");
    expect(error.unitLabel).toBe("PROJ-01");
    expect(error.message).toBe("PROJ-01 is already reserved for an overlapping period.");
  });
});

// --- helpers for the random comparison --------------------------------------

const DAY_START = at("00:00").getTime();
const minute = (n: number) => new Date(DAY_START + n * 60_000);

/** Counts use at every minute of the window and keeps the highest. */
function bruteForcePeak(uses: QuantityInPeriod[], span: { start: Date; end: Date }): number {
  let peak = 0;
  for (let t = span.start.getTime(); t < span.end.getTime(); t += 60_000) {
    const inUse = uses
      .filter((u) => u.start.getTime() <= t && t < u.end.getTime())
      .reduce((sum, u) => sum + u.quantity, 0);
    peak = Math.max(peak, inUse);
  }
  return peak;
}

/** A small seeded generator (mulberry32), so a failure can be replayed exactly. */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
