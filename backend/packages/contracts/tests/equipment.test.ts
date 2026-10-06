import { describe, expect, it } from "vitest";
import {
  EQUIPMENT_KINDS,
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
