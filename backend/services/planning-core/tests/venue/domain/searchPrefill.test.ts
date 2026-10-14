import { describe, expect, it } from "vitest";
import { prefillFromEvent, type CatalogueOptions, type EventForPrefill } from "../../../src/modules/venue/domain/searchPrefill.js";

/**
 * J1 AC8 — what the search is pre-filled with when it is opened from an event.
 * The event's layout and facilities are lists of names and its accessibility
 * needs are free text, so they are matched to the catalogue's spellings.
 */

const OPTIONS: CatalogueOptions = {
  layouts: ["Theatre", "Classroom", "Boardroom"],
  facilities: ["Projector", "Wireless microphones", "Stage lighting"],
  accessibilityFeatures: ["Step-free access", "Hearing loop", "Accessible toilet"],
};

const EVENT: EventForPrefill = {
  proposedStartAt: "2026-12-14T04:00:00.000Z",
  proposedEndAt: "2026-12-14T06:00:00.000Z",
  expectedAttendance: 150,
  venueRequirements: { layout: "Theatre", facilities: ["Projector", "Wireless microphones"] },
  accessibilityNeeds: "Step-free access, Hearing loop, Reserved seating",
};

describe("prefillFromEvent", () => {
  it("fills the window, attendance, layout, facilities and the accessibility needs it can match (J1-T21)", () => {
    expect(prefillFromEvent(EVENT, OPTIONS)).toEqual({
      filters: {
        from: "2026-12-14T04:00:00.000Z",
        to: "2026-12-14T06:00:00.000Z",
        minCapacity: 150,
        layout: "Theatre",
        facilities: ["Projector", "Wireless microphones"],
        accessibility: ["Step-free access", "Hearing loop"],
      },
      unmatchedAccessibility: ["Reserved seating"],
    });
  });

  it("fills nothing from an event that records nothing", () => {
    expect(
      prefillFromEvent(
        { proposedStartAt: null, proposedEndAt: null, expectedAttendance: null, venueRequirements: null, accessibilityNeeds: null },
        OPTIONS,
      ),
    ).toEqual({
      filters: { from: null, to: null, minCapacity: null, layout: null, facilities: [], accessibility: [] },
      unmatchedAccessibility: [],
    });
  });

  it("fills a window only when the event has both ends", () => {
    const only = (patch: Partial<EventForPrefill>) => prefillFromEvent({ ...EVENT, ...patch }, OPTIONS).filters;
    expect(only({ proposedEndAt: null })).toMatchObject({ from: null, to: null });
    expect(only({ proposedStartAt: null })).toMatchObject({ from: null, to: null });
  });

  it("leaves minimum capacity blank for an attendance of zero or less, and fills it for 1", () => {
    const capacity = (expectedAttendance: number) => prefillFromEvent({ ...EVENT, expectedAttendance }, OPTIONS).filters.minCapacity;
    expect(capacity(0)).toBeNull();
    expect(capacity(-4)).toBeNull();
    expect(capacity(1)).toBe(1);
  });

  it("uses the catalogue's spelling when a name matches ignoring case, and the event's own otherwise", () => {
    const { filters } = prefillFromEvent(
      { ...EVENT, venueRequirements: { layout: " theatre ", facilities: ["PROJECTOR", "projector", "Smoke machine"] } },
      OPTIONS,
    );
    expect(filters.layout).toBe("Theatre");
    expect(filters.facilities).toEqual(["Projector", "Smoke machine"]);
    expect(prefillFromEvent({ ...EVENT, venueRequirements: { layout: "Banquet" } }, OPTIONS).filters.layout).toBe("Banquet");
  });

  it("leaves layout blank when the event's is blank or missing", () => {
    expect(prefillFromEvent({ ...EVENT, venueRequirements: { layout: "   " } }, OPTIONS).filters.layout).toBeNull();
    expect(prefillFromEvent({ ...EVENT, venueRequirements: { layout: null, facilities: null } }, OPTIONS).filters).toMatchObject({
      layout: null,
      facilities: [],
    });
    expect(prefillFromEvent({ ...EVENT, venueRequirements: {} }, OPTIONS).filters.layout).toBeNull();
  });

  it("ignores requirements that are not in B1's shape", () => {
    const { filters } = prefillFromEvent({ ...EVENT, venueRequirements: { layout: 42, facilities: "Projector" } }, OPTIONS);
    expect(filters).toMatchObject({ layout: null, facilities: [] });
    expect(prefillFromEvent({ ...EVENT, venueRequirements: "Theatre" }, OPTIONS).filters.layout).toBeNull();
  });

  it("splits accessibility needs on commas, semicolons and new lines, matching ignoring case, without repeats", () => {
    const result = prefillFromEvent(
      { ...EVENT, accessibilityNeeds: "hearing LOOP;Step-free access\naccessible toilet, hearing loop, ,Sign interpreter, sign interpreter" },
      OPTIONS,
    );
    expect(result.filters.accessibility).toEqual(["Hearing loop", "Step-free access", "Accessible toilet"]);
    expect(result.unmatchedAccessibility).toEqual(["Sign interpreter", "sign interpreter"]);
  });

  it("leaves every accessibility need unmatched when the catalogue has no features", () => {
    const result = prefillFromEvent(EVENT, { ...OPTIONS, accessibilityFeatures: [] });
    expect(result.filters.accessibility).toEqual([]);
    expect(result.unmatchedAccessibility).toEqual(["Step-free access", "Hearing loop", "Reserved seating"]);
  });

  it("treats blank accessibility needs as none", () => {
    expect(prefillFromEvent({ ...EVENT, accessibilityNeeds: " ,; " }, OPTIONS)).toMatchObject({
      filters: { accessibility: [] },
      unmatchedAccessibility: [],
    });
  });
});
