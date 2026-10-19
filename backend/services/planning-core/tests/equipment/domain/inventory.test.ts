import { describe, expect, it } from "vitest";
import {
  InventoryReductionConflictError,
  UnavailabilityExceedsTotalError,
  validateEquipmentType,
  validateUnavailability,
  type EquipmentTypeInput,
  type UnavailabilityInput,
} from "../../../src/modules/equipment/domain/inventory.js";

const bulk = (changes: Partial<EquipmentTypeInput> = {}): EquipmentTypeInput => ({
  name: " Folding chairs ",
  description: " Stackable chairs ",
  characteristics: { " Colour ": " Blue " },
  kind: "BULK",
  totalQuantity: 20,
  unitLabels: [],
  ...changes,
});

const unavailable = (changes: Partial<UnavailabilityInput> = {}): UnavailabilityInput => ({
  unitId: null,
  quantity: 3,
  startsAt: new Date("2026-11-02T02:00:00.000Z"),
  endsAt: new Date("2026-11-02T04:00:00.000Z"),
  reason: " Repairs ",
  ...changes,
});

describe("validateEquipmentType (P2 AC1)", () => {
  it("accepts zero bulk stock and normalises its text and characteristics", () => {
    expect(validateEquipmentType(bulk({ totalQuantity: 0 }))).toEqual({
      ok: true,
      equipmentType: {
        name: "Folding chairs",
        description: "Stackable chairs",
        characteristics: { Colour: "Blue" },
        kind: "BULK",
        totalQuantity: 0,
        unitLabels: [],
      },
    });
  });

  it.each([null, -1, 1.5])("refuses invalid bulk total %s", (totalQuantity) => {
    const result = validateEquipmentType(bulk({ totalQuantity }));
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected invalid equipment type");
    expect(result.fields.map(({ field }) => field)).toContain("totalQuantity");
  });

  it("names all blank and contradictory bulk fields", () => {
    const result = validateEquipmentType(bulk({
      name: " ",
      description: " ",
      characteristics: { " ": " ", Size: " " },
      unitLabels: ["CHAIR-1"],
    }));
    expect(result).toMatchObject({ ok: false });
    if (result.ok) throw new Error("expected invalid equipment type");
    expect(result.fields.map(({ field }) => field)).toEqual(expect.arrayContaining([
      "name", "description", "characteristics", "characteristics.value", "characteristics.Size", "unitLabels",
    ]));
  });

  it("accepts serialized labels, derives their quantity elsewhere, and trims them", () => {
    expect(validateEquipmentType(bulk({
      kind: "SERIALIZED",
      totalQuantity: null,
      unitLabels: [" PROJ-01 ", "PROJ-02"],
    }))).toMatchObject({
      ok: true,
      equipmentType: { kind: "SERIALIZED", totalQuantity: null, unitLabels: ["PROJ-01", "PROJ-02"] },
    });
    expect(validateEquipmentType(bulk({ kind: "SERIALIZED", totalQuantity: null, unitLabels: [] })).ok).toBe(true);
  });

  it("refuses a stored serialized total, blank labels and case-insensitive duplicates", () => {
    const result = validateEquipmentType(bulk({
      kind: "SERIALIZED",
      totalQuantity: 2,
      unitLabels: ["PROJ-01", " ", "proj-01"],
    }));
    expect(result).toMatchObject({ ok: false });
    if (result.ok) throw new Error("expected invalid equipment type");
    expect(result.fields.map(({ field }) => field)).toEqual(["unitLabels", "totalQuantity", "unitLabels"]);
  });
});

describe("validateUnavailability (P2 AC2)", () => {
  it("accepts and trims bulk unavailability", () => {
    expect(validateUnavailability(unavailable(), "BULK")).toEqual({
      ok: true,
      unavailability: { ...unavailable(), reason: "Repairs" },
    });
  });

  it.each([null, 0, -1, 1.5])("refuses invalid unavailable bulk quantity %s", (quantity) => {
    const result = validateUnavailability(unavailable({ quantity }), "BULK");
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected invalid unavailability");
    expect(result.fields.map(({ field }) => field)).toContain("quantity");
  });

  it("refuses a unit target, blank reason and an end not later than start for bulk", () => {
    const startsAt = new Date("2026-11-02T04:00:00.000Z");
    const result = validateUnavailability(unavailable({
      unitId: "00000000-0000-0000-0000-000000000001",
      reason: " ",
      startsAt,
      endsAt: startsAt,
    }), "BULK");
    expect(result).toMatchObject({ ok: false });
    if (result.ok) throw new Error("expected invalid unavailability");
    expect(result.fields.map(({ field }) => field)).toEqual(["reason", "endsAt", "unitId"]);
  });

  it("accepts a serialized unit and refuses quantity or a missing unit", () => {
    const valid = unavailable({ unitId: "00000000-0000-0000-0000-000000000001", quantity: null });
    expect(validateUnavailability(valid, "SERIALIZED")).toMatchObject({ ok: true });
    const invalid = validateUnavailability(unavailable({ unitId: null, quantity: 1 }), "SERIALIZED");
    expect(invalid).toMatchObject({ ok: false });
    if (invalid.ok) throw new Error("expected invalid unavailability");
    expect(invalid.fields.map(({ field }) => field)).toEqual(["quantity", "unitId"]);
  });
});

describe("P2 inventory refusals", () => {
  it("names every affected event reference and reserved quantity", () => {
    const error = new InventoryReductionConflictError(4, [
      { eventReference: "EVT-101", quantity: 3 },
      { eventReference: "EVT-202", quantity: 2 },
    ]);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("InventoryReductionConflictError");
    expect(error.code).toBe("INSUFFICIENT_EQUIPMENT");
    expect(error.message).toContain("EVT-101 (3), EVT-202 (2)");
  });

  it("names recorded unavailability when it alone prevents a reduction", () => {
    expect(new InventoryReductionConflictError(1, []).message).toContain("recorded unavailability");
  });

  it("reports unavailable bulk stock beyond the held total", () => {
    const error = new UnavailabilityExceedsTotalError(6, 5);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("UnavailabilityExceedsTotalError");
    expect(error.code).toBe("INSUFFICIENT_EQUIPMENT");
    expect(error.message).toBe("Cannot mark 6 unavailable because only 5 are held.");
  });
});
