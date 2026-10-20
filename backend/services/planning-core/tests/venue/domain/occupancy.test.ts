import { describe, expect, it } from "vitest";
import { bufferConflicts, occupiedPeriod, periodsOverlap } from "../../../src/modules/venue/domain/occupancy.js";

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

describe("bufferConflicts (H3-T10)", () => {
  const slot = (id: string, reference: string, from: string, until: string) => ({ id, reference, startsAt: at(from), endsAt: at(until) });
  const morning = slot("a", "BKR-000001", "10:00", "12:00");
  const afternoon = slot("b", "BKR-000002", "12:15", "14:00");
  const none = { setupMinutes: 0, turnaroundMinutes: 0 };

  it("finds nothing when no occupied periods overlap", () => {
    expect(bufferConflicts([morning, afternoon], none)).toEqual([]);
    expect(bufferConflicts([], none)).toEqual([]);
    expect(bufferConflicts([morning], { setupMinutes: 30, turnaroundMinutes: 45 })).toEqual([]);
  });

  it("flags both of two bookings whose occupied periods now overlap, each naming the other", () => {
    expect(bufferConflicts([morning, afternoon], { setupMinutes: 0, turnaroundMinutes: 30 })).toEqual([
      { slotId: "a", overlapsId: "b", overlapsReference: "BKR-000002" },
      { slotId: "b", overlapsId: "a", overlapsReference: "BKR-000001" },
    ]);
  });

  it("counts the setup time too: a booking's setup can reach back into the one before it", () => {
    expect(bufferConflicts([morning, afternoon], { setupMinutes: 20, turnaroundMinutes: 0 }).map((c) => c.slotId)).toEqual(["a", "b"]);
    expect(bufferConflicts([morning, afternoon], { setupMinutes: 15, turnaroundMinutes: 0 })).toEqual([]);
  });

  it("leaves occupied periods that only touch alone: 12:00 plus 15 minutes meets 12:15 exactly", () => {
    expect(bufferConflicts([morning, afternoon], { setupMinutes: 0, turnaroundMinutes: 15 })).toEqual([]);
    expect(bufferConflicts([morning, afternoon], { setupMinutes: 0, turnaroundMinutes: 16 })).toHaveLength(2);
  });

  it("names every other booking a booking overlaps, soonest first, whatever order the slots come in", () => {
    const evening = slot("c", "BKR-000003", "14:10", "16:00");
    const found = bufferConflicts([evening, afternoon, morning], { setupMinutes: 0, turnaroundMinutes: 30 });
    expect(found.filter((c) => c.slotId === "b").map((c) => c.overlapsReference)).toEqual(["BKR-000001", "BKR-000003"]);
    expect(found.map((c) => c.slotId)).toEqual(["a", "b", "b", "c"]);
  });

  it("never pairs a booking with itself", () => {
    expect(bufferConflicts([morning], { setupMinutes: 600, turnaroundMinutes: 600 })).toEqual([]);
  });
});
