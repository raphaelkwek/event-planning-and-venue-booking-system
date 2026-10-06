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

/**
 * EN-06.2's mutation run showed the tests above check *which* fields fail but
 * not *what they say*, so a refusal could lose its message unnoticed. These
 * pin every message B2 shows, and the boundaries the mutants slipped past.
 */
describe("validateSubmission says exactly what is wrong (B2)", () => {
  const EVERY_MANDATORY_FIELD_MISSING = [
    { field: "name", message: "Event name is required." },
    { field: "purpose", message: "Purpose is required." },
    { field: "description", message: "Description is required." },
    { field: "proposedStartAt", message: "Proposed start date and time is required." },
    { field: "proposedEndAt", message: "Proposed end date and time is required." },
    { field: "expectedAttendance", message: "Expected attendance is required." },
    { field: "registrationRequired", message: "Whether attendee registration is required must be stated." },
    { field: "equipmentRequired", message: "Whether equipment is required must be stated." },
  ];

  it("gives each missing field its own message when the fields are absent", () => {
    expect(validateSubmission({}, NOW)).toEqual(EVERY_MANDATORY_FIELD_MISSING);
  });

  it("gives the same messages when the fields are present but null", () => {
    const allNull = {
      name: null,
      purpose: null,
      description: null,
      proposedStartAt: null,
      proposedEndAt: null,
      expectedAttendance: null,
      registrationRequired: null,
      equipmentRequired: null,
    };
    expect(validateSubmission(allNull, NOW)).toEqual(EVERY_MANDATORY_FIELD_MISSING);
  });

  it("explains a non-positive attendance differently from a missing one", () => {
    expect(validateSubmission(completeRequest({ expectedAttendance: 0 }), NOW)).toEqual([
      { field: "expectedAttendance", message: "Expected attendance must be a whole number greater than zero." },
    ]);
  });

  it("accepts a start exactly at the current moment (boundary: not in the past)", () => {
    const request = completeRequest({
      proposedStartAt: NOW.toISOString(),
      proposedEndAt: new Date(NOW.getTime() + 60 * 60_000).toISOString(),
    });
    expect(validateSubmission(request, NOW)).toEqual([]);
  });

  it("does not compare the registration window with a start that is missing", () => {
    const request = completeRequest({
      proposedStartAt: null,
      registrationRequired: true,
      registrationOpensAt: "2026-09-20T00:00:00.000Z",
      registrationClosesAt: "2026-10-01T00:00:00.000Z",
    });
    expect(validateSubmission(request, NOW)).toEqual([
      { field: "proposedStartAt", message: "Proposed start date and time is required." },
    ]);
  });

  describe("when registration is required", () => {
    const withRegistration = (opensAt: string | null, closesAt: string | null) =>
      completeRequest({ registrationRequired: true, registrationOpensAt: opensAt, registrationClosesAt: closesAt });

    it("asks for both ends of the registration window by name", () => {
      expect(validateSubmission(withRegistration(null, null), NOW)).toEqual([
        {
          field: "registrationOpensAt",
          message: "Registration opening date and time is required when registration is required.",
        },
        {
          field: "registrationClosesAt",
          message: "Registration closing date and time is required when registration is required.",
        },
      ]);
    });

    it("says closing must come after opening (boundary: equal times)", () => {
      const sameMoment = "2026-09-20T00:00:00.000Z";
      expect(validateSubmission(withRegistration(sameMoment, sameMoment), NOW)).toEqual([
        { field: "registrationClosesAt", message: "Registration closing must be later than registration opening." },
      ]);
    });

    it("says closing must be no later than the event start", () => {
      expect(validateSubmission(withRegistration("2026-09-20T00:00:00.000Z", "2026-10-03T00:00:00.000Z"), NOW)).toEqual([
        { field: "registrationClosesAt", message: "Registration closing must be no later than the event start." },
      ]);
    });
  });
});
