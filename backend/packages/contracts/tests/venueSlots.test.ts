import { describe, expect, it } from "vitest";
import {
  BLOCKING_SLOT_STATUSES,
  UNAVAILABILITY_BLOCK_STATUSES,
  UNAVAILABILITY_REASON_TYPES,
  VENUE_SLOT_STATUSES,
} from "../src/venueSlots.js";
import { ERROR_CODES } from "../src/errorCodes.js";

/**
 * EN-02.1 (ADR-0006, implementation.md §4.6): the values a venue slot and an
 * unavailability block may hold. The venue migration's check constraints list
 * the same values, and planning-core's boundaries tests compare the two.
 */

describe("VENUE_SLOT_STATUSES", () => {
  it("lists every status a hold or booking's slot can be in", () => {
    expect(VENUE_SLOT_STATUSES).toEqual(["HELD", "CONFIRMED", "RELEASED", "EXPIRED"]);
  });

  it("has no Requires Reconfirmation status: that is a flag, so a flagged booking keeps its slot", () => {
    expect(VENUE_SLOT_STATUSES).not.toContain("REQUIRES_RECONFIRMATION");
  });
});

describe("BLOCKING_SLOT_STATUSES", () => {
  it("is only HELD and CONFIRMED, the statuses the exclusion constraint covers", () => {
    expect(BLOCKING_SLOT_STATUSES).toEqual(["HELD", "CONFIRMED"]);
  });
});

describe("UNAVAILABILITY_REASON_TYPES", () => {
  it("has I2's reason types as CR-02 lists them", () => {
    expect(UNAVAILABILITY_REASON_TYPES).toEqual(["MAINTENANCE", "EQUIPMENT_FAILURE", "RENOVATION", "SAFETY", "OTHER"]);
  });
});

describe("UNAVAILABILITY_BLOCK_STATUSES", () => {
  it("removes a block by status, never by deleting it", () => {
    expect(UNAVAILABILITY_BLOCK_STATUSES).toEqual(["ACTIVE", "REMOVED"]);
  });
});

describe("ERROR_CODES", () => {
  it("has the refusal for a hold or booking that overlaps another", () => {
    expect(ERROR_CODES).toContain("VENUE_SLOT_CONFLICT");
  });
});
