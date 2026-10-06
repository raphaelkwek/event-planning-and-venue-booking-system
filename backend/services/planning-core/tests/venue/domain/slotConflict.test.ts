import { describe, expect, it } from "vitest";
import {
  isSlotOverlap,
  SLOT_OVERLAP_CONSTRAINT,
  slotConflictMessage,
  VenueSlotConflictError,
} from "../../../src/modules/venue/domain/slotConflict.js";

/**
 * EN-02.1: Postgres decides whether two slots overlap (the exclusion
 * constraint, ADR-0006). These rules only recognise its refusal and name what
 * the new period overlaps (implementation.md §4.6).
 */

describe("isSlotOverlap", () => {
  it("recognises the venue slot exclusion constraint's violation", () => {
    expect(isSlotOverlap({ code: "23P01", constraint_name: SLOT_OVERLAP_CONSTRAINT })).toBe(true);
  });

  it("ignores an exclusion violation from any other constraint", () => {
    expect(isSlotOverlap({ code: "23P01", constraint_name: "unit_not_double_reserved" })).toBe(false);
  });

  it("ignores other database errors on the same constraint name", () => {
    expect(isSlotOverlap({ code: "23505", constraint_name: SLOT_OVERLAP_CONSTRAINT })).toBe(false);
  });

  it("ignores errors that are not database errors at all", () => {
    expect(isSlotOverlap(new Error("connection reset"))).toBe(false);
    expect(isSlotOverlap(null)).toBe(false);
    expect(isSlotOverlap("23P01")).toBe(false);
  });
});

describe("slotConflictMessage", () => {
  it("names the hold or booking the period overlaps", () => {
    expect(slotConflictMessage(["BR-0001"])).toBe(
      "This period overlaps BR-0001 at this venue, counting setup and turnaround time.",
    );
  });

  it("names two overlapped references with 'and'", () => {
    expect(slotConflictMessage(["BR-0001", "HOLD-0002"])).toBe(
      "This period overlaps BR-0001 and HOLD-0002 at this venue, counting setup and turnaround time.",
    );
  });

  it("names three or more as a list", () => {
    expect(slotConflictMessage(["BR-1", "BR-2", "HOLD-3"])).toBe(
      "This period overlaps BR-1, BR-2 and HOLD-3 at this venue, counting setup and turnaround time.",
    );
  });

  it("still refuses plainly when the overlapped slot can no longer be found", () => {
    expect(slotConflictMessage([])).toBe(
      "This period overlaps another hold or booking at this venue, counting setup and turnaround time.",
    );
  });
});

describe("VenueSlotConflictError", () => {
  it("carries the shared error code, the references and the message", () => {
    const error = new VenueSlotConflictError(["BR-0001"]);

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("VenueSlotConflictError");
    expect(error.code).toBe("VENUE_SLOT_CONFLICT");
    expect(error.conflictingReferences).toEqual(["BR-0001"]);
    expect(error.message).toBe(slotConflictMessage(["BR-0001"]));
  });
});
