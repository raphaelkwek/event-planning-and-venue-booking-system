import { describe, expect, it } from "vitest";
import { MAX_QUANTITY } from "../../../src/shared/limits.js";
import { validateEquipmentType, validateUnavailability } from "../../../src/modules/equipment/domain/inventory.js";
import { validateLine, validateStatusChange } from "../../../src/modules/equipment/domain/requestLines.js";

/** C1 trigger: quantities are `int` columns; a value past the int range raised 22003. Refused at the bound instead. */

const TYPE = "5b0e7a1c-3a52-4d6e-9a41-0a1b2c3d4e5f";
const EVENT = { startsAt: new Date("2026-12-02T06:00:00.000Z"), endsAt: new Date("2026-12-02T10:00:00.000Z") };
const fieldsOf = (result: { ok: boolean; fields?: { field: string; message: string }[] }) => (result.ok ? [] : result.fields!);

describe("equipment quantity bounds (C1)", () => {
  const bulk = (totalQuantity: number | null) =>
    validateEquipmentType({ name: "Chairs", description: "Stackable", characteristics: {}, kind: "BULK", totalQuantity, unitLabels: [] });

  it("accepts a total of 0 and the largest total, and refuses one more", () => {
    expect(bulk(0).ok).toBe(true);
    expect(bulk(MAX_QUANTITY).ok).toBe(true);
    expect(fieldsOf(bulk(MAX_QUANTITY + 1))).toEqual([
      { field: "totalQuantity", message: "Total quantity must be a whole number from 0 to 1000000." },
    ]);
    expect(bulk(3_000_000_000).ok).toBe(false);
  });

  const unavailable = (quantity: number | null) =>
    validateUnavailability(
      { reason: "Repairs", startsAt: new Date("2026-11-02T00:00:00Z"), endsAt: new Date("2026-11-02T04:00:00Z"), unitId: null, quantity },
      "BULK",
    );

  it("bounds the unavailable quantity from 1 to the maximum", () => {
    expect(unavailable(1).ok).toBe(true);
    expect(unavailable(MAX_QUANTITY).ok).toBe(true);
    expect(fieldsOf(unavailable(0))).toHaveLength(1);
    expect(fieldsOf(unavailable(null))).toHaveLength(1);
    expect(fieldsOf(unavailable(MAX_QUANTITY + 1))).toEqual([
      { field: "quantity", message: "Unavailable quantity must be a whole number from 1 to 1000000." },
    ]);
  });

  it("bounds a requested line quantity from 1 to the maximum", () => {
    const line = (quantity: unknown) => validateLine({ equipmentTypeId: TYPE, quantity }, EVENT);
    expect(line(1).ok).toBe(true);
    expect(line(MAX_QUANTITY).ok).toBe(true);
    for (const value of [0, MAX_QUANTITY + 1, 3_000_000_000, "4", 1.5]) {
      expect(fieldsOf(line(value)).map((f) => f.field)).toEqual(["quantity"]);
    }
    expect(fieldsOf(line(MAX_QUANTITY + 1))[0]!.message).toBe("Quantity must be a whole number from 1 to 1000000.");
  });

  it("bounds a substitute quantity from 1 to the maximum", () => {
    const substitution = (substituteQuantity: unknown) =>
      validateStatusChange({ status: "SUBSTITUTED", reason: "Swap", substituteEquipmentTypeId: TYPE, substituteQuantity });
    expect(substitution(MAX_QUANTITY).ok).toBe(true);
    expect(fieldsOf(substitution(MAX_QUANTITY + 1))).toEqual([
      { field: "substituteQuantity", message: "Substitute quantity must be a whole number from 1 to 1000000." },
    ]);
    expect(substitution(0).ok).toBe(false);
  });
});
