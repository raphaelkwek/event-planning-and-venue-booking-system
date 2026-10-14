import { describe, expect, it } from "vitest";
import {
  EQUIPMENT_KINDS,
  EQUIPMENT_LINE_EDITABLE_STATUSES,
  EQUIPMENT_LINE_HISTORY_ACTIONS,
  EQUIPMENT_LINE_STAFF_STATUSES,
  EQUIPMENT_LINE_STATUS_LABELS,
  EQUIPMENT_REQUEST_LINE_STATUSES,
  EQUIPMENT_RESERVATION_STATUSES,
  EQUIPMENT_UNAVAILABILITY_STATUSES,
} from "../src/equipment.js";
import { ERROR_CODES } from "../src/errorCodes.js";

/**
 * EN-02.2 (ADR-0006, implementation.md §4.6): serialized equipment is tracked
 * unit by unit, bulk stock by quantity, and nothing is deleted.
 */

describe("EQUIPMENT_KINDS", () => {
  it("tells individually tracked units from bulk stock", () => {
    expect(EQUIPMENT_KINDS).toEqual(["SERIALIZED", "BULK"]);
  });
});

describe("EQUIPMENT_RESERVATION_STATUSES", () => {
  it("releases a reservation by status, never by deleting it (Q2)", () => {
    expect(EQUIPMENT_RESERVATION_STATUSES).toEqual(["RESERVED", "RELEASED"]);
  });
});

describe("EQUIPMENT_UNAVAILABILITY_STATUSES", () => {
  it("removes unavailability by status, never by deleting it (P2)", () => {
    expect(EQUIPMENT_UNAVAILABILITY_STATUSES).toEqual(["ACTIVE", "REMOVED"]);
  });
});

describe("ERROR_CODES", () => {
  it("has the refusal that names insufficient availability and the shortfall (Q1)", () => {
    expect(ERROR_CODES).toContain("INSUFFICIENT_EQUIPMENT");
  });
});

/** O1/O2: the statuses are the stories' own words; REMOVED is what a removal sets (nothing is deleted). */
describe("EQUIPMENT_REQUEST_LINE_STATUSES", () => {
  it("lists the statuses the stories name, and Removed for O1's removal", () => {
    expect(EQUIPMENT_REQUEST_LINE_STATUSES).toEqual([
      "SUBMITTED",
      "UNDER_REVIEW",
      "CONFIRMED",
      "UNAVAILABLE",
      "SUBSTITUTED",
      "RESERVED",
      "REMOVED",
    ]);
  });

  it("lets the coordinator edit only Submitted and Under Review lines (O1)", () => {
    expect(EQUIPMENT_LINE_EDITABLE_STATUSES).toEqual(["SUBMITTED", "UNDER_REVIEW"]);
  });

  it("lets Technical Support set only the four statuses O2 names", () => {
    expect(EQUIPMENT_LINE_STAFF_STATUSES).toEqual(["UNDER_REVIEW", "CONFIRMED", "UNAVAILABLE", "SUBSTITUTED"]);
  });

  it("labels every status as a user reads it", () => {
    expect(Object.keys(EQUIPMENT_LINE_STATUS_LABELS)).toEqual([...EQUIPMENT_REQUEST_LINE_STATUSES]);
    expect(EQUIPMENT_LINE_STATUS_LABELS.UNDER_REVIEW).toBe("Under Review");
  });

  it("records saves, edits, removals and status changes in the audit trail", () => {
    expect(EQUIPMENT_LINE_HISTORY_ACTIONS).toEqual(["CREATED", "EDITED", "REMOVED", "STATUS_CHANGED"]);
  });
});

describe("ERROR_CODES for equipment request lines", () => {
  it("has a refusal for an unknown line and one for a line that can no longer be edited (O1)", () => {
    expect(ERROR_CODES).toContain("EQUIPMENT_LINE_NOT_FOUND");
    expect(ERROR_CODES).toContain("EQUIPMENT_LINE_NOT_EDITABLE");
  });
});
