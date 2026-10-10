import { describe, expect, it } from "vitest";
import {
  assessSuitability,
  checkAccessibility,
  checkFacilities,
  checkLayoutCapacity,
  checkOperatingHours,
  requirementsFromEvent,
  type SuitabilityRequirements,
  type SuitabilityVenue,
} from "../../../src/modules/venue/domain/suitability.js";

/**
 * K1 — whether a venue suits an event. One pure rule per failing condition, each
 * returning the two values it compared, and the assessment that combines them.
 * Times are Singapore time (UTC+8), so "2026-12-07T08:00:00+08:00" is Monday 7
 * December 2026 at opening time.
 */

const HOURS = {
  monday: { opensAt: "08:00", closesAt: "22:00" },
  tuesday: { opensAt: "08:00", closesAt: "22:00" },
  wednesday: { opensAt: "08:00", closesAt: "22:00" },
  thursday: { opensAt: "08:00", closesAt: "22:00" },
  friday: { opensAt: "08:00", closesAt: "22:00" },
  saturday: { opensAt: "09:00", closesAt: "18:00" },
  sunday: null,
};
const LAYOUTS = [
  { name: "Theatre", capacity: 120 },
  { name: "Classroom", capacity: 60 },
];
const VENUE: SuitabilityVenue = {
  layouts: LAYOUTS,
  facilities: ["Projector", "Microphone", "Livestream"],
  accessibilityFeatures: ["Step-free entrance", "Hearing loop"],
  operatingHours: HOURS,
};
const MONDAY_MORNING = { startsAt: "2026-12-07T10:00:00+08:00", endsAt: "2026-12-07T12:00:00+08:00" };
const FITTING: SuitabilityRequirements = {
  attendance: 100,
  layout: "Theatre",
  facilities: ["Projector"],
  accessibilityFeatures: ["Hearing loop"],
  period: MONDAY_MORNING,
};
const period = (startsAt: string, endsAt: string) => ({ startsAt, endsAt });

describe("checkLayoutCapacity", () => {
  it("fails when attendance exceeds the selected layout's capacity, returning both numbers", () => {
    const result = checkLayoutCapacity("Theatre", 150, LAYOUTS);

    expect(result).toEqual({
      condition: "LAYOUT_CAPACITY",
      outcome: "FAILED",
      required: 150,
      available: 120,
      message: "Expected attendance 150 against layout capacity 120 (Theatre).",
    });
  });

  it("is met when attendance equals the layout's capacity (boundary)", () => {
    const result = checkLayoutCapacity("Theatre", 120, LAYOUTS);

    expect(result.outcome).toBe("MET");
    expect(result).toMatchObject({ required: 120, available: 120 });
  });

  it("fails when attendance is one over the capacity (boundary)", () => {
    expect(checkLayoutCapacity("Theatre", 121, LAYOUTS)).toMatchObject({ outcome: "FAILED", required: 121, available: 120 });
  });

  it("is met when attendance is under the capacity", () => {
    expect(checkLayoutCapacity("Classroom", 59, LAYOUTS)).toMatchObject({ outcome: "MET", available: 60 });
  });

  it("finds the layout whatever its case or surrounding spaces", () => {
    expect(checkLayoutCapacity("  theatre ", 130, LAYOUTS)).toMatchObject({ outcome: "FAILED", available: 120 });
  });

  it("is not assessed when the event records no layout", () => {
    expect(checkLayoutCapacity(null, 100, LAYOUTS)).toEqual({
      condition: "LAYOUT_CAPACITY",
      outcome: "NOT_ASSESSED",
      required: 100,
      available: null,
      message: "The event records no room layout, so attendance was not compared with a layout capacity.",
    });
  });

  it("is not assessed when the event's layout is blank", () => {
    expect(checkLayoutCapacity("   ", 100, LAYOUTS).outcome).toBe("NOT_ASSESSED");
  });

  it("is not assessed when the event records no expected attendance", () => {
    expect(checkLayoutCapacity("Theatre", null, LAYOUTS)).toEqual({
      condition: "LAYOUT_CAPACITY",
      outcome: "NOT_ASSESSED",
      required: null,
      available: 120,
      message: "The event records no expected attendance, so it was not compared with the Theatre layout's capacity.",
    });
  });

  it("is not assessed when the venue does not offer the event's layout", () => {
    expect(checkLayoutCapacity("Banquet", 100, LAYOUTS)).toEqual({
      condition: "LAYOUT_CAPACITY",
      outcome: "NOT_ASSESSED",
      required: 100,
      available: null,
      message: "The venue does not offer the Banquet layout, so attendance was not compared with a layout capacity.",
    });
  });
});

describe("checkFacilities", () => {
  it("is met when the venue offers every required facility", () => {
    expect(checkFacilities(["Projector", "Microphone"], VENUE.facilities)).toEqual({
      condition: "FACILITIES",
      outcome: "MET",
      required: ["Projector", "Microphone"],
      available: ["Projector", "Microphone", "Livestream"],
      missing: [],
      message: "The venue offers every required facility.",
    });
  });

  it("fails naming each absent facility and what the venue offers", () => {
    const result = checkFacilities(["Projector", "Simultaneous interpretation", "Stage lighting"], VENUE.facilities);

    expect(result).toEqual({
      condition: "FACILITIES",
      outcome: "FAILED",
      required: ["Projector", "Simultaneous interpretation", "Stage lighting"],
      available: ["Projector", "Microphone", "Livestream"],
      missing: ["Simultaneous interpretation", "Stage lighting"],
      message:
        "Required facility absent: Simultaneous interpretation, Stage lighting. The venue offers: Projector, Microphone, Livestream.",
    });
  });

  it("says so when the venue offers no facilities at all", () => {
    const result = checkFacilities(["Projector"], []);

    expect(result.outcome).toBe("FAILED");
    expect(result.message).toBe("Required facility absent: Projector. The venue offers no facilities.");
  });

  it("compares without regard to case or surrounding spaces", () => {
    expect(checkFacilities(["  projector "], VENUE.facilities).outcome).toBe("MET");
  });

  it("is met when nothing is required", () => {
    expect(checkFacilities([], VENUE.facilities)).toMatchObject({ outcome: "MET", required: [], missing: [] });
  });

  it("ignores blank and repeated requirements", () => {
    const result = checkFacilities(["Livestream", " ", "livestream", "Livestream "], []);

    expect(result.required).toEqual(["Livestream"]);
    expect(result.missing).toEqual(["Livestream"]);
  });
});

describe("checkAccessibility", () => {
  it("is met when the venue offers every required accessibility feature", () => {
    expect(checkAccessibility(["Hearing loop"], VENUE.accessibilityFeatures)).toEqual({
      condition: "ACCESSIBILITY",
      outcome: "MET",
      required: ["Hearing loop"],
      available: ["Step-free entrance", "Hearing loop"],
      missing: [],
      message: "The venue offers every required accessibility feature.",
    });
  });

  it("fails naming the absent feature and what the venue offers", () => {
    const result = checkAccessibility(["Hearing loop", "Braille signage"], VENUE.accessibilityFeatures);

    expect(result).toEqual({
      condition: "ACCESSIBILITY",
      outcome: "FAILED",
      required: ["Hearing loop", "Braille signage"],
      available: ["Step-free entrance", "Hearing loop"],
      missing: ["Braille signage"],
      message:
        "Required accessibility feature absent: Braille signage. The venue offers: Step-free entrance, Hearing loop.",
    });
  });

  it("says so when the venue offers no accessibility features", () => {
    expect(checkAccessibility(["Braille signage"], []).message).toBe(
      "Required accessibility feature absent: Braille signage. The venue offers no accessibility features.",
    );
  });

  it("is met when nothing is required", () => {
    expect(checkAccessibility([], []).outcome).toBe("MET");
  });
});

describe("checkOperatingHours", () => {
  it("is met when the period is inside the day's hours", () => {
    expect(checkOperatingHours(MONDAY_MORNING, HOURS)).toEqual({
      condition: "OPERATING_HOURS",
      outcome: "MET",
      required: "2026-12-07 10:00–12:00",
      available: "Monday 08:00–22:00",
      message: "The requested period 2026-12-07 10:00–12:00 is within Monday's operating hours 08:00–22:00.",
    });
  });

  it("is met when the period starts exactly at opening and ends exactly at closing (boundary)", () => {
    const result = checkOperatingHours(period("2026-12-12T09:00:00+08:00", "2026-12-12T18:00:00+08:00"), HOURS);

    expect(result).toMatchObject({ outcome: "MET", available: "Saturday 09:00–18:00" });
  });

  it("fails when the period starts one minute before opening (boundary)", () => {
    const result = checkOperatingHours(period("2026-12-12T08:59:00+08:00", "2026-12-12T18:00:00+08:00"), HOURS);

    expect(result.outcome).toBe("FAILED");
  });

  it("fails when the period ends one minute after closing (boundary)", () => {
    const result = checkOperatingHours(period("2026-12-12T09:00:00+08:00", "2026-12-12T18:01:00+08:00"), HOURS);

    expect(result.outcome).toBe("FAILED");
  });

  it("fails when the period ends one second after closing", () => {
    const result = checkOperatingHours(period("2026-12-12T09:00:00+08:00", "2026-12-12T18:00:01+08:00"), HOURS);

    expect(result.outcome).toBe("FAILED");
  });

  it("fails when the period starts before opening, returning the period and the day's hours", () => {
    const result = checkOperatingHours(period("2026-12-07T07:30:00+08:00", "2026-12-07T10:00:00+08:00"), HOURS);

    expect(result).toEqual({
      condition: "OPERATING_HOURS",
      outcome: "FAILED",
      required: "2026-12-07 07:30–10:00",
      available: "Monday 08:00–22:00",
      message: "The requested period 2026-12-07 07:30–10:00 is outside Monday's operating hours 08:00–22:00.",
    });
  });

  it("fails when the period ends after closing", () => {
    const result = checkOperatingHours(period("2026-12-07T20:00:00+08:00", "2026-12-07T22:30:00+08:00"), HOURS);

    expect(result).toMatchObject({ outcome: "FAILED", required: "2026-12-07 20:00–22:30" });
  });

  it("fails on a day the venue is closed", () => {
    const result = checkOperatingHours(period("2026-12-13T10:00:00+08:00", "2026-12-13T12:00:00+08:00"), HOURS);

    expect(result).toEqual({
      condition: "OPERATING_HOURS",
      outcome: "FAILED",
      required: "2026-12-13 10:00–12:00",
      available: "Sunday closed",
      message: "The requested period 2026-12-13 10:00–12:00 is outside Sunday's operating hours: the venue is closed.",
    });
  });

  it("fails on a weekday with no hours recorded at all", () => {
    const result = checkOperatingHours(MONDAY_MORNING, { saturday: HOURS.saturday });

    expect(result).toMatchObject({ outcome: "FAILED", available: "Monday closed" });
  });

  it("reads the day in Singapore time, not UTC", () => {
    // 00:30 on Tuesday in Singapore is 16:30 on Monday in UTC.
    const result = checkOperatingHours(period("2026-12-07T16:30:00Z", "2026-12-07T17:30:00Z"), HOURS);

    expect(result).toMatchObject({ outcome: "FAILED", required: "2026-12-08 00:30–01:30", available: "Tuesday 08:00–22:00" });
  });

  it("fails a period that runs past midnight, naming the day it first leaves the hours", () => {
    const result = checkOperatingHours(period("2026-12-07T20:00:00+08:00", "2026-12-08T09:00:00+08:00"), HOURS);

    expect(result).toEqual({
      condition: "OPERATING_HOURS",
      outcome: "FAILED",
      required: "2026-12-07 20:00 to 2026-12-08 09:00",
      available: "Monday 08:00–22:00",
      message: "The requested period 2026-12-07 20:00 to 2026-12-08 09:00 is outside Monday's operating hours 08:00–22:00.",
    });
  });

  it("fails a period ending at midnight, because the venue does not open until 24:00", () => {
    const result = checkOperatingHours(period("2026-12-07T20:00:00+08:00", "2026-12-08T00:00:00+08:00"), HOURS);

    expect(result).toMatchObject({ outcome: "FAILED", required: "2026-12-07 20:00–24:00", available: "Monday 08:00–22:00" });
  });

  it("is not assessed when the event records no period", () => {
    expect(checkOperatingHours(null, HOURS)).toEqual({
      condition: "OPERATING_HOURS",
      outcome: "NOT_ASSESSED",
      required: null,
      available: null,
      message: "The event records no proposed period, so it was not compared with the venue's operating hours.",
    });
  });

  it("is not assessed when the period's times are not valid", () => {
    expect(checkOperatingHours(period("not a time", "2026-12-07T12:00:00+08:00"), HOURS).outcome).toBe("NOT_ASSESSED");
    expect(checkOperatingHours(period("2026-12-07T12:00:00+08:00", "nonsense"), HOURS).outcome).toBe("NOT_ASSESSED");
  });

  it("is not assessed when the period does not end after it starts", () => {
    expect(checkOperatingHours(period("2026-12-07T12:00:00+08:00", "2026-12-07T12:00:00+08:00"), HOURS).outcome).toBe(
      "NOT_ASSESSED",
    );
    expect(checkOperatingHours(period("2026-12-07T12:00:00+08:00", "2026-12-07T10:00:00+08:00"), HOURS).outcome).toBe(
      "NOT_ASSESSED",
    );
  });
});

describe("assessSuitability", () => {
  it("is Suitable, with no reasons and no warnings, when nothing fails", () => {
    expect(assessSuitability(FITTING, VENUE)).toEqual({ status: "SUITABLE", reasons: [], warnings: [] });
  });

  it("is Not suitable with one reason when one condition fails", () => {
    const result = assessSuitability({ ...FITTING, attendance: 150 }, VENUE);

    expect(result.status).toBe("NOT_SUITABLE");
    expect(result.reasons).toHaveLength(1);
    expect(result.reasons[0]).toMatchObject({ condition: "LAYOUT_CAPACITY", required: 150, available: 120 });
    expect(result.warnings).toEqual([]);
  });

  it("is Suitable when attendance equals the capacity and the period touches both hours (boundaries)", () => {
    const touching = period("2026-12-12T09:00:00+08:00", "2026-12-12T18:00:00+08:00");

    expect(assessSuitability({ ...FITTING, attendance: 120, period: touching }, VENUE)).toEqual({
      status: "SUITABLE",
      reasons: [],
      warnings: [],
    });
  });

  it("lists every failing condition separately, in a fixed order", () => {
    const result = assessSuitability(
      {
        attendance: 150,
        layout: "Theatre",
        facilities: ["Simultaneous interpretation"],
        accessibilityFeatures: ["Braille signage"],
        period: period("2026-12-07T07:00:00+08:00", "2026-12-07T09:00:00+08:00"),
      },
      VENUE,
    );

    expect(result.status).toBe("NOT_SUITABLE");
    expect(result.reasons.map((reason) => reason.condition)).toEqual([
      "LAYOUT_CAPACITY",
      "FACILITIES",
      "ACCESSIBILITY",
      "OPERATING_HOURS",
    ]);
    expect(result.reasons.every((reason) => reason.outcome === "FAILED")).toBe(true);
  });

  it("is Suitable with warnings when a condition could not be assessed and none failed", () => {
    const result = assessSuitability({ ...FITTING, layout: null }, VENUE);

    expect(result.status).toBe("SUITABLE_WITH_WARNINGS");
    expect(result.reasons).toEqual([]);
    expect(result.warnings.map((warning) => warning.condition)).toEqual(["LAYOUT_CAPACITY"]);
  });

  it("lists a warning beside a failure and stays Not suitable", () => {
    const result = assessSuitability({ ...FITTING, layout: null, facilities: ["Stage lighting"], period: null }, VENUE);

    expect(result.status).toBe("NOT_SUITABLE");
    expect(result.reasons.map((reason) => reason.condition)).toEqual(["FACILITIES"]);
    expect(result.warnings.map((warning) => warning.condition)).toEqual(["LAYOUT_CAPACITY", "OPERATING_HOURS"]);
  });

  it("assesses against whatever requirements it is given, so each booking request can supply its own (CR-03)", () => {
    const firstRequest = { ...FITTING, attendance: 100, layout: "Theatre" };
    const secondRequest = { ...FITTING, attendance: 70, layout: "Classroom" };

    expect(assessSuitability(firstRequest, VENUE).status).toBe("SUITABLE");
    expect(assessSuitability(secondRequest, VENUE).reasons[0]).toMatchObject({ required: 70, available: 60 });
  });
});

describe("requirementsFromEvent", () => {
  const event = {
    expectedAttendance: 150,
    venueRequirements: { layout: "Theatre", facilities: ["Projector", "Microphone"], notes: "Near the lift" },
    accessibilityNeeds: "Hearing loop\nBraille signage",
    proposedStartAt: "2026-12-07T02:00:00.000Z",
    proposedEndAt: "2026-12-07T04:00:00.000Z",
  };

  it("reads the attendance, layout, facilities, accessibility needs and period from the event", () => {
    expect(requirementsFromEvent(event)).toEqual({
      attendance: 150,
      layout: "Theatre",
      facilities: ["Projector", "Microphone"],
      accessibilityFeatures: ["Hearing loop", "Braille signage"],
      period: { startsAt: "2026-12-07T02:00:00.000Z", endsAt: "2026-12-07T04:00:00.000Z" },
    });
  });

  it("reads accessibility needs separated by commas, semicolons or lines, and drops blanks", () => {
    const result = requirementsFromEvent({ ...event, accessibilityNeeds: "Hearing loop, Braille signage;Step-free entrance\r\n\n ," });

    expect(result.accessibilityFeatures).toEqual(["Hearing loop", "Braille signage", "Step-free entrance"]);
  });

  it("treats missing requirements as nothing required and nothing to compare", () => {
    expect(
      requirementsFromEvent({
        expectedAttendance: null,
        venueRequirements: null,
        accessibilityNeeds: null,
        proposedStartAt: null,
        proposedEndAt: null,
      }),
    ).toEqual({ attendance: null, layout: null, facilities: [], accessibilityFeatures: [], period: null });
  });

  it("has no period unless both the start and the end are recorded", () => {
    expect(requirementsFromEvent({ ...event, proposedEndAt: null }).period).toBeNull();
    expect(requirementsFromEvent({ ...event, proposedStartAt: null }).period).toBeNull();
  });

  it("ignores venue requirements that are not in the recorded shape", () => {
    const result = requirementsFromEvent({ ...event, venueRequirements: "Theatre" });

    expect(result).toMatchObject({ layout: null, facilities: [] });
  });

  it("handles venue requirements with a layout but no facilities, or facilities but no layout", () => {
    expect(requirementsFromEvent({ ...event, venueRequirements: { layout: "Classroom" } })).toMatchObject({
      layout: "Classroom",
      facilities: [],
    });
    expect(requirementsFromEvent({ ...event, venueRequirements: { facilities: ["Projector"] } })).toMatchObject({
      layout: null,
      facilities: ["Projector"],
    });
    expect(requirementsFromEvent({ ...event, venueRequirements: { layout: null, facilities: null } })).toMatchObject({
      layout: null,
      facilities: [],
    });
  });
});
