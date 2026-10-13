import { describe, expect, it } from "vitest";
import {
  EQUIPMENT_REQUEST_LINE_STATUSES,
  type EquipmentRequestLineStatus,
} from "@connectsphere/contracts";
import {
  canChangeStatus,
  isEditableByCoordinator,
  MAX_LINES_PER_REQUEST,
  MAX_NOTES_LENGTH,
  MAX_REASON_LENGTH,
  validateLine,
  validateNewLines,
  validateStatusChange,
  type EventTimes,
} from "../../../src/modules/equipment/domain/requestLines.js";

const TYPE = "5b0e7a1c-3a52-4d6e-9a41-0a1b2c3d4e5f";
const OTHER_TYPE = "6c1f8b2d-4b63-4e7f-8b52-1b2c3d4e5f60";
const EVENT: EventTimes = { startsAt: new Date("2026-12-02T06:00:00.000Z"), endsAt: new Date("2026-12-02T10:00:00.000Z") };

const line = (changes: Record<string, unknown> = {}) => ({ equipmentTypeId: TYPE, quantity: 4, notes: "Rows of 10", ...changes });

describe("validateLine (O1)", () => {
  it("takes required-from and required-to from the event when none are given", () => {
    const result = validateLine(line(), EVENT);
    expect(result).toEqual({
      ok: true,
      line: { equipmentTypeId: TYPE, quantity: 4, notes: "Rows of 10", requiredFrom: EVENT.startsAt, requiredTo: EVENT.endsAt },
    });
  });

  it("treats null and empty times as not given", () => {
    const result = validateLine(line({ requiredFrom: null, requiredTo: "" }), EVENT);
    expect(result).toMatchObject({ ok: true, line: { requiredFrom: EVENT.startsAt, requiredTo: EVENT.endsAt } });
  });

  it("keeps times the coordinator edits", () => {
    const result = validateLine(line({ requiredFrom: "2026-12-02T05:00:00.000Z", requiredTo: "2026-12-02T11:30:00.000Z" }), EVENT);
    expect(result).toMatchObject({
      ok: true,
      line: { requiredFrom: new Date("2026-12-02T05:00:00.000Z"), requiredTo: new Date("2026-12-02T11:30:00.000Z") },
    });
  });

  it("accepts a period of one minute (the smallest later end)", () => {
    const result = validateLine(line({ requiredFrom: "2026-12-02T07:00:00.000Z", requiredTo: "2026-12-02T07:01:00.000Z" }), EVENT);
    expect(result.ok).toBe(true);
  });

  it("refuses required-to equal to required-from", () => {
    const result = validateLine(line({ requiredFrom: "2026-12-02T07:00:00.000Z", requiredTo: "2026-12-02T07:00:00.000Z" }), EVENT);
    expect(result).toEqual({ ok: false, fields: [{ field: "requiredTo", message: "Required-to must be later than required-from." }] });
  });

  it("refuses required-to before required-from", () => {
    const result = validateLine(line({ requiredFrom: "2026-12-02T08:00:00.000Z", requiredTo: "2026-12-02T07:00:00.000Z" }), EVENT);
    expect(result).toEqual({ ok: false, fields: [{ field: "requiredTo", message: "Required-to must be later than required-from." }] });
  });

  it("refuses a default that makes the period empty when only one time is edited", () => {
    const result = validateLine(line({ requiredFrom: "2026-12-02T11:00:00.000Z" }), EVENT);
    expect(result).toMatchObject({ ok: false, fields: [{ field: "requiredTo" }] });
  });

  it("asks for a time when none is given and the event has none to offer", () => {
    const result = validateLine(line(), { startsAt: null, endsAt: null });
    expect(result).toEqual({
      ok: false,
      fields: [
        { field: "requiredFrom", message: "Enter the required-from date and time." },
        { field: "requiredTo", message: "Enter the required-to date and time." },
      ],
    });
  });

  it("refuses a time that is not a date instead of replacing it with the default", () => {
    const result = validateLine(line({ requiredFrom: "next Tuesday", requiredTo: 12 }), EVENT);
    expect(result).toEqual({
      ok: false,
      fields: [
        { field: "requiredFrom", message: "Enter a valid required-from date and time." },
        { field: "requiredTo", message: "Enter a valid required-to date and time." },
      ],
    });
  });

  it("refuses a blank string time that is only spaces", () => {
    const result = validateLine(line({ requiredFrom: "   " }), EVENT);
    expect(result).toMatchObject({ ok: false, fields: [{ field: "requiredFrom", message: "Enter a valid required-from date and time." }] });
  });

  it("accepts quantity 1 (exactly at the minimum)", () => {
    expect(validateLine(line({ quantity: 1 }), EVENT).ok).toBe(true);
  });

  it.each([0, -1, 1.5, "ten", "4", null, undefined, Number.NaN, Number.POSITIVE_INFINITY])(
    "refuses quantity %s",
    (quantity) => {
      const result = validateLine(line({ quantity }), EVENT);
      expect(result).toEqual({
        ok: false,
        fields: [{ field: "quantity", message: "Quantity must be a whole number greater than zero." }],
      });
    },
  );

  it.each([undefined, null, "", "not-a-uuid", 7])("refuses equipment type %s", (equipmentTypeId) => {
    const result = validateLine(line({ equipmentTypeId }), EVENT);
    expect(result).toEqual({ ok: false, fields: [{ field: "equipmentTypeId", message: "Choose an equipment type." }] });
  });

  it("defaults missing notes to empty and trims notes", () => {
    expect(validateLine({ equipmentTypeId: TYPE, quantity: 2 }, EVENT)).toMatchObject({ ok: true, line: { notes: "" } });
    expect(validateLine(line({ notes: "  padded  " }), EVENT)).toMatchObject({ ok: true, line: { notes: "padded" } });
  });

  it("refuses notes that are not text", () => {
    expect(validateLine(line({ notes: 5 }), EVENT)).toEqual({
      ok: false,
      fields: [{ field: "notes", message: "Technical notes must be text." }],
    });
  });

  it("accepts notes of the maximum length and refuses one more", () => {
    expect(validateLine(line({ notes: "n".repeat(MAX_NOTES_LENGTH) }), EVENT).ok).toBe(true);
    expect(validateLine(line({ notes: "n".repeat(MAX_NOTES_LENGTH + 1) }), EVENT)).toEqual({
      ok: false,
      fields: [{ field: "notes", message: `Technical notes can be at most ${MAX_NOTES_LENGTH} characters.` }],
    });
  });

  it("reports every problem, not only the first, under the prefix it is given", () => {
    const result = validateLine({ equipmentTypeId: "x", quantity: 0, notes: 3, requiredFrom: "bad", requiredTo: "bad" }, EVENT, "lines.2.");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fields.map((entry) => entry.field)).toEqual([
      "lines.2.equipmentTypeId",
      "lines.2.quantity",
      "lines.2.notes",
      "lines.2.requiredFrom",
      "lines.2.requiredTo",
    ]);
  });
});

describe("validateNewLines (O1)", () => {
  it("returns every valid line, in order", () => {
    const result = validateNewLines([line(), line({ equipmentTypeId: OTHER_TYPE, quantity: 1 })], EVENT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.lines.map((entry) => [entry.equipmentTypeId, entry.quantity])).toEqual([[TYPE, 4], [OTHER_TYPE, 1]]);
  });

  it("refuses the whole request when one line is invalid, naming that line", () => {
    const result = validateNewLines([line(), line({ quantity: 0 })], EVENT);
    expect(result).toEqual({
      ok: false,
      fields: [{ field: "lines.1.quantity", message: "Quantity must be a whole number greater than zero." }],
    });
  });

  it("names the problems of several lines", () => {
    const result = validateNewLines([line({ quantity: 0 }), line(), line({ equipmentTypeId: "" })], EVENT);
    expect(result).toMatchObject({ ok: false });
    if (result.ok) return;
    expect(result.fields.map((entry) => entry.field)).toEqual(["lines.0.quantity", "lines.2.equipmentTypeId"]);
  });

  it("refuses a request with no lines", () => {
    expect(validateNewLines([], EVENT)).toEqual({ ok: false, fields: [{ field: "lines", message: "Add at least one equipment line." }] });
  });

  it("accepts the maximum number of lines and refuses one more", () => {
    const many = (count: number) => Array.from({ length: count }, () => line());
    expect(validateNewLines(many(MAX_LINES_PER_REQUEST), EVENT).ok).toBe(true);
    expect(validateNewLines(many(MAX_LINES_PER_REQUEST + 1), EVENT)).toEqual({
      ok: false,
      fields: [{ field: "lines", message: `A request can have at most ${MAX_LINES_PER_REQUEST} lines.` }],
    });
  });
});

describe("which lines may be edited or changed", () => {
  const editable: EquipmentRequestLineStatus[] = ["SUBMITTED", "UNDER_REVIEW"];

  it.each(EQUIPMENT_REQUEST_LINE_STATUSES)("%s: the coordinator may edit or remove it only while Submitted or Under Review (O1)", (status) => {
    expect(isEditableByCoordinator(status)).toBe(editable.includes(status));
  });

  it.each(EQUIPMENT_REQUEST_LINE_STATUSES)("%s: Technical Support may change it unless it is Reserved or Removed (O2)", (status) => {
    expect(canChangeStatus(status)).toBe(status !== "RESERVED" && status !== "REMOVED");
  });
});

describe("validateStatusChange (O2)", () => {
  it.each(["UNDER_REVIEW", "CONFIRMED"])("accepts %s on its own and ignores a stray reason or substitute", (status) => {
    const result = validateStatusChange({ status, reason: "ignored", substituteEquipmentTypeId: TYPE, substituteQuantity: 3 });
    expect(result).toEqual({
      ok: true,
      change: { status, reason: null, substituteEquipmentTypeId: null, substituteQuantity: null },
    });
  });

  it("accepts Unavailable with a reason, trimmed", () => {
    expect(validateStatusChange({ status: "UNAVAILABLE", reason: "  Out for repair  " })).toEqual({
      ok: true,
      change: { status: "UNAVAILABLE", reason: "Out for repair", substituteEquipmentTypeId: null, substituteQuantity: null },
    });
  });

  it("accepts a one-character reason", () => {
    expect(validateStatusChange({ status: "UNAVAILABLE", reason: "x" })).toMatchObject({ ok: true, change: { reason: "x" } });
  });

  it.each([undefined, null, "", "   ", 5])("refuses Unavailable with reason %s", (reason) => {
    expect(validateStatusChange({ status: "UNAVAILABLE", reason })).toEqual({
      ok: false,
      fields: [{ field: "reason", message: "Give a reason why the equipment is unavailable." }],
    });
  });

  it("accepts a reason of the maximum length and refuses one more", () => {
    expect(validateStatusChange({ status: "UNAVAILABLE", reason: "r".repeat(MAX_REASON_LENGTH) }).ok).toBe(true);
    expect(validateStatusChange({ status: "UNAVAILABLE", reason: "r".repeat(MAX_REASON_LENGTH + 1) })).toEqual({
      ok: false,
      fields: [{ field: "reason", message: `The reason can be at most ${MAX_REASON_LENGTH} characters.` }],
    });
  });

  it("accepts Substituted with a substitute type and quantity", () => {
    expect(validateStatusChange({ status: "SUBSTITUTED", substituteEquipmentTypeId: OTHER_TYPE, substituteQuantity: 3, reason: "ignored" })).toEqual({
      ok: true,
      change: { status: "SUBSTITUTED", reason: null, substituteEquipmentTypeId: OTHER_TYPE, substituteQuantity: 3 },
    });
  });

  it("accepts a substitute quantity of 1", () => {
    expect(validateStatusChange({ status: "SUBSTITUTED", substituteEquipmentTypeId: OTHER_TYPE, substituteQuantity: 1 }).ok).toBe(true);
  });

  it.each([0, -1, 1.5, "3", null, undefined])("refuses a substitute quantity of %s", (substituteQuantity) => {
    expect(validateStatusChange({ status: "SUBSTITUTED", substituteEquipmentTypeId: OTHER_TYPE, substituteQuantity })).toEqual({
      ok: false,
      fields: [{ field: "substituteQuantity", message: "Substitute quantity must be a whole number greater than zero." }],
    });
  });

  it.each([undefined, null, "", "nope", 4])("refuses a substitute type of %s", (substituteEquipmentTypeId) => {
    expect(validateStatusChange({ status: "SUBSTITUTED", substituteEquipmentTypeId, substituteQuantity: 2 })).toEqual({
      ok: false,
      fields: [{ field: "substituteEquipmentTypeId", message: "Choose the substitute equipment type." }],
    });
  });

  it("names both substitute fields when neither is given", () => {
    const result = validateStatusChange({ status: "SUBSTITUTED" });
    expect(result).toMatchObject({ ok: false });
    if (result.ok) return;
    expect(result.fields.map((entry) => entry.field)).toEqual(["substituteEquipmentTypeId", "substituteQuantity"]);
  });

  it.each(["RESERVED", "SUBMITTED", "REMOVED", "DONE", "", undefined, null, 3])("refuses the status %s, which O2 cannot set", (status) => {
    expect(validateStatusChange({ status })).toEqual({
      ok: false,
      fields: [{ field: "status", message: "Choose Under Review, Confirmed, Unavailable or Substituted." }],
    });
  });
});
