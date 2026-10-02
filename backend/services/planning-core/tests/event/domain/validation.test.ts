import { describe, expect, it } from "vitest";
import { validateSubmission } from "../../../src/modules/event/domain/validation.js";

/** B2 — validation applied before an event request may be submitted. */

const NOW = new Date("2026-09-15T09:00:00.000Z");

function completeRequest(overrides: Record<string, unknown> = {}) {
  return {
    name: "Annual Research Symposium",
    purpose: "Share faculty research",
    description: "A one-day symposium for the school of computing.",
    proposedStartAt: "2026-10-02T14:00:00.000Z",
    proposedEndAt: "2026-10-02T18:00:00.000Z",
    expectedAttendance: 150,
    registrationRequired: false,
    equipmentRequired: true,
    ...overrides,
  };
}

function fieldsIn(errors: { field: string }[]) {
  return errors.map((error) => error.field);
}

describe("validateSubmission (B2)", () => {
  it("accepts a complete request", () => {
    expect(validateSubmission(completeRequest(), NOW)).toEqual([]);
  });

  it("names every missing mandatory field, not only the first", () => {
    const errors = validateSubmission(
      {
        name: "",
        purpose: "",
        description: "",
        proposedStartAt: null,
        proposedEndAt: null,
        expectedAttendance: null,
        registrationRequired: null,
        equipmentRequired: null,
      },
      NOW
    );

    expect(fieldsIn(errors)).toEqual(
      expect.arrayContaining([
        "name",
        "purpose",
        "description",
        "proposedStartAt",
        "proposedEndAt",
        "expectedAttendance",
        "registrationRequired",
        "equipmentRequired",
      ])
    );
  });

  it("treats a whitespace-only value as missing", () => {
    const errors = validateSubmission(completeRequest({ name: "   " }), NOW);
    expect(fieldsIn(errors)).toContain("name");
  });

  it("rejects an end time equal to the start time, saying why", () => {
    const errors = validateSubmission(
      completeRequest({
        proposedStartAt: "2026-10-02T14:00:00.000Z",
        proposedEndAt: "2026-10-02T14:00:00.000Z",
      }),
      NOW
    );

    expect(fieldsIn(errors)).toEqual(["proposedEndAt"]);
    expect(errors[0]!.message).toMatch(/later than the start/i);
  });

  it("rejects an end time earlier than the start time", () => {
    const errors = validateSubmission(
      completeRequest({
        proposedStartAt: "2026-10-02T14:00:00.000Z",
        proposedEndAt: "2026-10-02T10:00:00.000Z",
      }),
      NOW
    );

    expect(fieldsIn(errors)).toEqual(["proposedEndAt"]);
  });

  it("rejects a start date and time in the past", () => {
    const errors = validateSubmission(
      completeRequest({
        proposedStartAt: "2026-09-15T08:00:00.000Z",
        proposedEndAt: "2026-09-15T10:00:00.000Z",
      }),
      NOW
    );

    expect(fieldsIn(errors)).toEqual(["proposedStartAt"]);
    expect(errors[0]!.message).toMatch(/past/i);
  });

  it("names a start time that is present but not a valid date, and checks nothing that depends on it", () => {
    const errors = validateSubmission(completeRequest({ proposedStartAt: "next Friday afternoon" }), NOW);

    expect(errors).toEqual([
      { field: "proposedStartAt", message: "Proposed start date and time is not a valid date." },
    ]);
  });

  it("names an end time that is present but not a valid date", () => {
    const errors = validateSubmission(completeRequest({ proposedEndAt: "2026-10-02T99:00:00.000Z" }), NOW);

    expect(errors).toEqual([{ field: "proposedEndAt", message: "Proposed end date and time is not a valid date." }]);
  });

  it("rejects an expected attendance of zero", () => {
    const errors = validateSubmission(completeRequest({ expectedAttendance: 0 }), NOW);
    expect(fieldsIn(errors)).toEqual(["expectedAttendance"]);
  });

  it("rejects a fractional expected attendance", () => {
    const errors = validateSubmission(completeRequest({ expectedAttendance: 12.5 }), NOW);
    expect(fieldsIn(errors)).toEqual(["expectedAttendance"]);
  });

  describe("when registration is required", () => {
    it("requires both the opening and the closing date/time", () => {
      const errors = validateSubmission(
        completeRequest({
          registrationRequired: true,
          registrationOpensAt: null,
          registrationClosesAt: null,
        }),
        NOW
      );

      expect(fieldsIn(errors)).toEqual(
        expect.arrayContaining(["registrationOpensAt", "registrationClosesAt"])
      );
    });

    it("requires the closing to be later than the opening", () => {
      const errors = validateSubmission(
        completeRequest({
          registrationRequired: true,
          registrationOpensAt: "2026-09-20T09:00:00.000Z",
          registrationClosesAt: "2026-09-20T09:00:00.000Z",
        }),
        NOW
      );

      expect(fieldsIn(errors)).toContain("registrationClosesAt");
    });

    it("requires the closing to be no later than the event start", () => {
      const errors = validateSubmission(
        completeRequest({
          registrationRequired: true,
          registrationOpensAt: "2026-09-20T09:00:00.000Z",
          registrationClosesAt: "2026-10-02T15:00:00.000Z",
        }),
        NOW
      );

      expect(fieldsIn(errors)).toContain("registrationClosesAt");
    });

    it("names an opening time that is present but not a valid date, and still checks the closing", () => {
      const errors = validateSubmission(
        completeRequest({
          registrationRequired: true,
          registrationOpensAt: "the week before",
          registrationClosesAt: "2026-10-01T17:00:00.000Z",
        }),
        NOW
      );

      expect(errors).toEqual([
        { field: "registrationOpensAt", message: "Registration opening date and time is not a valid date." },
      ]);
    });

    it("names a closing time that is present but not a valid date", () => {
      const errors = validateSubmission(
        completeRequest({
          registrationRequired: true,
          registrationOpensAt: "2026-09-20T09:00:00.000Z",
          registrationClosesAt: "2026-13-45T25:00:00.000Z",
        }),
        NOW
      );

      expect(errors).toEqual([
        { field: "registrationClosesAt", message: "Registration closing date and time is not a valid date." },
      ]);
    });

    it("accepts a window that closes exactly at the event start", () => {
      const errors = validateSubmission(
        completeRequest({
          registrationRequired: true,
          registrationOpensAt: "2026-09-20T09:00:00.000Z",
          registrationClosesAt: "2026-10-02T14:00:00.000Z",
        }),
        NOW
      );

      expect(errors).toEqual([]);
    });
  });

  it("does not ask for a registration window when registration is not required", () => {
    const errors = validateSubmission(
      completeRequest({ registrationRequired: false, registrationOpensAt: null }),
      NOW
    );

    expect(errors).toEqual([]);
  });

  it("accepts 'no equipment required' as a stated equipment flag", () => {
    const errors = validateSubmission(completeRequest({ equipmentRequired: false }), NOW);
    expect(errors).toEqual([]);
  });
});
