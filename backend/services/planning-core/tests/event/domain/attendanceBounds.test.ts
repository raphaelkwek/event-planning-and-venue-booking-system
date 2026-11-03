import { describe, expect, it } from "vitest";
import { MAX_HEADCOUNT } from "../../../src/shared/limits.js";
import { validateSubmission } from "../../../src/modules/event/domain/validation.js";

/** C1 trigger: expected_attendance is an `int` column; a value past the int range raised 22003. */

const NOW = new Date("2026-09-15T09:00:00.000Z");
const request = (expectedAttendance: unknown) => ({
  name: "Symposium",
  purpose: "Share research",
  description: "A one-day symposium.",
  proposedStartAt: "2026-10-02T14:00:00.000Z",
  proposedEndAt: "2026-10-02T18:00:00.000Z",
  expectedAttendance,
  registrationRequired: false,
  equipmentRequired: true,
});

describe("expectedAttendance bound on an event submission (C1)", () => {
  it("accepts 1 and the largest attendance", () => {
    expect(validateSubmission(request(1) as never, NOW)).toEqual([]);
    expect(validateSubmission(request(MAX_HEADCOUNT) as never, NOW)).toEqual([]);
  });

  it("refuses 0, one more than the bound, and a number too big for an int", () => {
    for (const value of [0, MAX_HEADCOUNT + 1, 3_000_000_000]) {
      expect(validateSubmission(request(value) as never, NOW)).toEqual([
        { field: "expectedAttendance", message: "Expected attendance must be a whole number from 1 to 1000000." },
      ]);
    }
  });
});
