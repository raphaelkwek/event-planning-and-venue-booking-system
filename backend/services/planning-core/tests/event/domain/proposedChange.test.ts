import { describe, expect, it } from "vitest";
import {
  checkProposedChange,
  type ChangeableEvent,
} from "../../../src/modules/event/domain/proposedChange.js";

/** S1 — proposed values are checked as the event would be after the change. */

const NOW = new Date("2026-11-01T00:00:00Z");

const CURRENT: ChangeableEvent = {
  name: "N",
  purpose: "P",
  description: "D",
  proposedStartAt: "2026-12-02T14:00:00.000Z",
  proposedEndAt: "2026-12-02T18:00:00.000Z",
  expectedAttendance: 150,
  registrationRequired: false,
  registrationOpensAt: null,
  registrationClosesAt: null,
  equipmentRequired: false,
  venueRequirements: null,
  equipmentRequirements: null,
};

function fields(current: ChangeableEvent, changes: Record<string, unknown>) {
  return checkProposedChange(current, changes, NOW).map((error) => error.field);
}

describe("checkProposedChange (S1)", () => {
  it("accepts a start moved within the current end", () => {
    expect(checkProposedChange(CURRENT, { proposedStartAt: "2026-12-02T15:00:00.000Z" }, NOW)).toEqual([]);
  });

  it("accepts an empty change", () => {
    expect(checkProposedChange(CURRENT, {}, NOW)).toEqual([]);
  });

  it("refuses a start in the past, on proposedStartAt", () => {
    expect(fields(CURRENT, { proposedStartAt: "2026-10-31T00:00:00Z" })).toEqual(["proposedStartAt"]);
  });

  it("refuses an end before the current start, on proposedEndAt", () => {
    expect(fields(CURRENT, { proposedEndAt: "2026-12-02T13:00:00.000Z" })).toEqual(["proposedEndAt"]);
  });

  it("refuses a start after the current end, on proposedEndAt", () => {
    expect(fields(CURRENT, { proposedStartAt: "2026-12-02T19:00:00.000Z" })).toEqual(["proposedEndAt"]);
  });

  it.each([0, 2.5, -3])("refuses attendance %s on expectedAttendance", (value) => {
    expect(fields(CURRENT, { expectedAttendance: value })).toEqual(["expectedAttendance"]);
  });

  it("accepts attendance 1", () => {
    expect(fields(CURRENT, { expectedAttendance: 1 })).toEqual([]);
  });

  it("does not blame a change to the end for a current start that is already past", () => {
    const started = { ...CURRENT, proposedStartAt: "2026-10-30T14:00:00.000Z", proposedEndAt: "2026-11-02T18:00:00.000Z" };
    expect(fields(started, { proposedEndAt: "2026-11-03T18:00:00.000Z" })).toEqual([]);
  });

  it("still refuses an end before the current start when only the end moves", () => {
    const started = { ...CURRENT, proposedStartAt: "2026-10-30T14:00:00.000Z" };
    expect(fields(started, { proposedEndAt: "2026-10-30T13:00:00.000Z" })).toEqual(["proposedEndAt"]);
  });

  describe("the registration window", () => {
    const registering: ChangeableEvent = {
      ...CURRENT,
      registrationRequired: true,
      registrationOpensAt: "2026-12-01T08:00:00.000Z",
      registrationClosesAt: "2026-12-02T12:00:00.000Z",
    };

    it("reports on the start when it moves to before registration closes", () => {
      expect(checkProposedChange(registering, { proposedStartAt: "2026-12-02T11:00:00.000Z" }, NOW)).toEqual([
        { field: "proposedStartAt", message: "Registration closes after this start; move registration first." },
      ]);
    });

    it("accepts a start at or after the closing time", () => {
      expect(fields(registering, { proposedStartAt: "2026-12-02T12:00:00.000Z" })).toEqual([]);
    });

    it("says nothing about registration when the start is not proposed", () => {
      expect(fields({ ...registering, registrationClosesAt: "2026-12-03T00:00:00.000Z" }, { expectedAttendance: 10 })).toEqual([]);
    });
  });

  it("names every failing field", () => {
    expect(fields(CURRENT, { proposedStartAt: "2026-10-31T00:00:00Z", expectedAttendance: 0 }).sort()).toEqual([
      "expectedAttendance",
      "proposedStartAt",
    ]);
  });

  it("does not report an error on an untouched field", () => {
    const emptyPurpose = { ...CURRENT, purpose: "", name: "" };
    expect(fields(emptyPurpose, { expectedAttendance: 10 })).toEqual([]);
  });

  it("does not throw on a non-string start or end", () => {
    expect(fields(CURRENT, { proposedStartAt: 5 })).toContain("proposedStartAt");
    expect(fields(CURRENT, { proposedEndAt: { a: 1 } })).toEqual(["proposedEndAt"]);
  });

  it("does not throw on a non-number attendance", () => {
    expect(fields(CURRENT, { expectedAttendance: "many" })).toEqual(["expectedAttendance"]);
  });

  it("refuses null for start, end and attendance as required", () => {
    expect(fields(CURRENT, { proposedStartAt: null })).toContain("proposedStartAt");
    expect(fields(CURRENT, { proposedEndAt: null })).toEqual(["proposedEndAt"]);
    expect(fields(CURRENT, { expectedAttendance: null })).toEqual(["expectedAttendance"]);
  });

  it("refuses an unparseable date string", () => {
    expect(fields(CURRENT, { proposedEndAt: "soon" })).toEqual(["proposedEndAt"]);
  });

  it("ignores keys that are not significant fields", () => {
    expect(fields(CURRENT, { name: "", purpose: "" })).toEqual([]);
  });

  describe("equipmentRequired", () => {
    it("accepts a boolean", () => {
      expect(fields(CURRENT, { equipmentRequired: true })).toEqual([]);
    });
    it.each(["yes", 1, {}])("refuses %s as not a boolean", (value) => {
      expect(fields(CURRENT, { equipmentRequired: value })).toEqual(["equipmentRequired"]);
    });
    it("accepts true while the equipment requirements are still empty", () => {
      expect(checkProposedChange({ ...CURRENT, equipmentRequirements: null }, { equipmentRequired: true }, NOW)).toEqual([]);
    });
    it("refuses null as not stated, once", () => {
      expect(fields(CURRENT, { equipmentRequired: null })).toEqual(["equipmentRequired"]);
    });
  });

  describe("venueRequirements", () => {
    it("refuses a string", () => {
      expect(fields(CURRENT, { venueRequirements: "big room" })).toEqual(["venueRequirements"]);
    });
    it("accepts a valid object and null", () => {
      expect(fields(CURRENT, { venueRequirements: { layout: "theatre", facilities: ["projector"] } })).toEqual([]);
      expect(fields(CURRENT, { venueRequirements: null })).toEqual([]);
    });
  });

  describe("equipmentRequirements", () => {
    it("refuses an invalid line", () => {
      expect(fields(CURRENT, { equipmentRequirements: [{ equipmentType: "mic", quantity: 0 }] })).toEqual([
        "equipmentRequirements",
      ]);
    });
    it("accepts valid lines and null", () => {
      expect(fields(CURRENT, { equipmentRequirements: [{ equipmentType: "mic", quantity: 2 }] })).toEqual([]);
      expect(fields(CURRENT, { equipmentRequirements: null })).toEqual([]);
    });
  });
});
