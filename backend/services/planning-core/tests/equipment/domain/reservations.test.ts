import { describe, expect, it } from "vitest";
import { decideQuantity, reservationTarget, statusAfterRelease, validateReleaseBody, validateReservationBody } from "../../../src/modules/equipment/domain/reservations.js";

const line = (changes: Record<string, unknown> = {}) => ({
  status: "CONFIRMED" as const,
  equipmentTypeId: "type-chairs",
  quantity: 5,
  substituteEquipmentTypeId: null,
  substituteQuantity: null,
  ...changes,
});

describe("reservationTarget (Q1)", () => {
  it("a Confirmed line reserves its own type and quantity", () => {
    expect(reservationTarget(line())).toEqual({ equipmentTypeId: "type-chairs", requestedQuantity: 5 });
  });

  it("a Substituted line reserves the substitute type and quantity", () => {
    expect(
      reservationTarget(line({ status: "SUBSTITUTED", substituteEquipmentTypeId: "type-stools", substituteQuantity: 3 })),
    ).toEqual({ equipmentTypeId: "type-stools", requestedQuantity: 3 });
  });

  it("a Substituted line missing its substitute is not reservable", () => {
    expect(reservationTarget(line({ status: "SUBSTITUTED", substituteEquipmentTypeId: "type-stools", substituteQuantity: null }))).toBeNull();
    expect(reservationTarget(line({ status: "SUBSTITUTED", substituteEquipmentTypeId: null, substituteQuantity: 3 }))).toBeNull();
  });

  it.each(["SUBMITTED", "UNDER_REVIEW", "UNAVAILABLE", "RESERVED", "REMOVED"] as const)("a %s line is not reservable", (status) => {
    expect(reservationTarget(line({ status }))).toBeNull();
  });
});

describe("validateReservationBody (Q1)", () => {
  it("accepts an empty body", () => {
    expect(validateReservationBody({})).toEqual({ ok: true, body: { quantity: null, partial: false } });
  });

  it("accepts a quantity and partial", () => {
    expect(validateReservationBody({ quantity: 3, partial: true })).toEqual({ ok: true, body: { quantity: 3, partial: true } });
  });

  it.each([0, -1, 2.5, "3", null])("refuses quantity %p", (quantity) => {
    const result = validateReservationBody({ quantity });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fields.map((f) => f.field)).toEqual(["quantity"]);
  });

  it("refuses a partial that is not a boolean", () => {
    const result = validateReservationBody({ partial: "yes" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fields.map((f) => f.field)).toEqual(["partial"]);
  });

  it("refuses a body that is not an object", () => {
    const result = validateReservationBody(undefined);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fields.map((f) => f.field)).toEqual(["body"]);
  });
});

describe("decideQuantity (Q1)", () => {
  it("no quantity reserves the requested quantity", () => {
    expect(decideQuantity(5, { quantity: null, partial: false })).toEqual({ ok: true, quantity: 5 });
  });

  it("the requested quantity itself needs no partial", () => {
    expect(decideQuantity(5, { quantity: 5, partial: false })).toEqual({ ok: true, quantity: 5 });
  });

  it("a lower quantity with partial is accepted", () => {
    expect(decideQuantity(5, { quantity: 3, partial: true })).toEqual({ ok: true, quantity: 3 });
  });

  it("a lower quantity without partial is refused, naming both numbers", () => {
    expect(decideQuantity(5, { quantity: 3, partial: false })).toEqual({
      ok: false,
      code: "PARTIAL_NOT_CONFIRMED",
      message: "5 were requested. Confirm a partial reservation to reserve 3.",
    });
  });

  it("a quantity above the requested one is refused on the field", () => {
    expect(decideQuantity(5, { quantity: 6, partial: true })).toEqual({
      ok: false,
      code: "VALIDATION_FAILED",
      fields: [{ field: "quantity", message: "You can reserve at most 5, the quantity requested." }],
    });
  });
});

describe("validateReleaseBody (Q2)", () => {
  it("accepts a reason and trims it", () => {
    expect(validateReleaseBody({ reason: "  Event moved  " })).toEqual({ ok: true, reason: "Event moved" });
  });
  it.each([{}, { reason: "" }, { reason: "   " }, { reason: 5 }, undefined, null])("refuses %p on reason", (body) => {
    const result = validateReleaseBody(body);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fields.map((f) => f.field)).toEqual(["reason"]);
  });
  it("refuses a reason longer than O2's limit", () => {
    const result = validateReleaseBody({ reason: "x".repeat(1001) });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fields.map((f) => f.field)).toEqual(["reason"]);
  });
  it("accepts a reason exactly at the limit", () => {
    expect(validateReleaseBody({ reason: "x".repeat(1000) }).ok).toBe(true);
  });
});

describe("statusAfterRelease (Q2)", () => {
  it("a line with a substitute goes back to Substituted", () => {
    expect(statusAfterRelease({ substituteEquipmentTypeId: "t", substituteQuantity: 5 })).toBe("SUBSTITUTED");
  });
  it("a line without one goes back to Confirmed", () => {
    expect(statusAfterRelease({ substituteEquipmentTypeId: null, substituteQuantity: null })).toBe("CONFIRMED");
  });
  it("a type without a quantity goes back to Confirmed", () => {
    expect(statusAfterRelease({ substituteEquipmentTypeId: "t", substituteQuantity: null })).toBe("CONFIRMED");
  });
  it("a quantity without a type goes back to Confirmed", () => {
    expect(statusAfterRelease({ substituteEquipmentTypeId: null, substituteQuantity: 5 })).toBe("CONFIRMED");
  });
});
