import { describe, expect, it } from "vitest";
import { isSignificantEventField, SIGNIFICANT_EVENT_FIELDS } from "../src/eventFields.js";
import { ERROR_CODES } from "../src/errorCodes.js";

describe("SIGNIFICANT_EVENT_FIELDS", () => {
  it("lists the date and times, expected attendance, and the venue and equipment requirements (G1)", () => {
    expect(SIGNIFICANT_EVENT_FIELDS).toEqual([
      "proposedStartAt",
      "proposedEndAt",
      "expectedAttendance",
      "venueRequirements",
      "equipmentRequired",
      "equipmentRequirements",
    ]);
  });

  it("leaves out the descriptive fields G1 lets people edit", () => {
    for (const field of ["purpose", "description", "accessibilityNeeds", "contactDetails"]) {
      expect(isSignificantEventField(field), field).toBe(false);
    }
    expect(isSignificantEventField("expectedAttendance")).toBe(true);
  });
});

describe("ERROR_CODES", () => {
  it("has G1's refusals: not editable now, change request required, and a stale or missing version", () => {
    for (const code of ["EVENT_NOT_EDITABLE", "CHANGE_REQUEST_REQUIRED", "EVENT_VERSION_MISMATCH", "EVENT_VERSION_REQUIRED"]) {
      expect(ERROR_CODES, code).toContain(code);
    }
  });
});
