import { describe, expect, it } from "vitest";
import {
  emptySearchForm,
  formFromPrefill,
  toInstant,
  toLocalInput,
  toSearchQuery,
  type VenueSearchForm,
  type VenueSearchPrefill,
} from "../src/api/venues.js";

/** J1, J2: the search form's strings to the query the API reads, and an event's pre-fill back to the form. */

describe("toSearchQuery", () => {
  it("sends nothing for an empty form, so the server lists every active venue (J2 AC4)", () => {
    expect(toSearchQuery(emptySearchForm()).toString()).toBe("");
  });

  it("sends only what was filled in, trimmed, with a repeated parameter for each facility and feature", () => {
    const form: VenueSearchForm = {
      q: "  hall ",
      from: "2026-12-14T12:00",
      to: "2026-12-14T14:00",
      minCapacity: " 150 ",
      location: "Science",
      layout: "Theatre",
      facilities: ["Projector", "Wireless microphones"],
      accessibility: ["Hearing loop"],
    };

    const query = toSearchQuery(form);

    expect(query.get("q")).toBe("hall");
    expect(query.get("from")).toBe("2026-12-14T12:00:00+08:00");
    expect(query.get("to")).toBe("2026-12-14T14:00:00+08:00");
    expect(query.get("minCapacity")).toBe("150");
    expect(query.get("location")).toBe("Science");
    expect(query.get("layout")).toBe("Theatre");
    expect(query.getAll("facilities")).toEqual(["Projector", "Wireless microphones"]);
    expect(query.getAll("accessibility")).toEqual(["Hearing loop"]);
  });

  it("leaves out text that is only spaces", () => {
    expect(toSearchQuery({ ...emptySearchForm(), q: "   ", location: " ", minCapacity: "  " }).toString()).toBe("");
  });

  it("sends a half-filled window as it is, for the server to refuse and name the missing end", () => {
    expect(toSearchQuery({ ...emptySearchForm(), from: "2026-12-14T12:00" }).toString()).toBe("from=2026-12-14T12%3A00%3A00%2B08%3A00");
  });
});

describe("Singapore time", () => {
  it("reads what the person typed as Singapore time", () => {
    expect(new Date(toInstant("2026-12-14T12:00")).toISOString()).toBe("2026-12-14T04:00:00.000Z");
  });

  it("shows an instant from the server as Singapore time, across midnight", () => {
    expect(toLocalInput("2026-12-14T04:00:00.000Z")).toBe("2026-12-14T12:00");
    expect(toLocalInput("2026-12-14T16:30:00.000Z")).toBe("2026-12-15T00:30");
    expect(toLocalInput(null)).toBe("");
  });
});

describe("formFromPrefill", () => {
  const prefill: VenueSearchPrefill = {
    eventId: "e1",
    reference: "EVT-000101",
    filters: {
      from: "2026-12-14T04:00:00.000Z",
      to: "2026-12-14T06:00:00.000Z",
      minCapacity: 150,
      layout: "Theatre",
      facilities: ["Projector"],
      accessibility: ["Hearing loop"],
    },
    unmatchedAccessibility: ["Reserved seating"],
  };

  it("puts the event's requirements in the fields (J1 AC8)", () => {
    expect(formFromPrefill(prefill)).toEqual({
      q: "",
      from: "2026-12-14T12:00",
      to: "2026-12-14T14:00",
      minCapacity: "150",
      location: "",
      layout: "Theatre",
      facilities: ["Projector"],
      accessibility: ["Hearing loop"],
    });
  });

  it("leaves a field blank where the event records nothing", () => {
    const blank = formFromPrefill({ ...prefill, filters: { ...prefill.filters, from: null, to: null, minCapacity: null, layout: null } });
    expect(blank).toMatchObject({ from: "", to: "", minCapacity: "", layout: "" });
  });
});
