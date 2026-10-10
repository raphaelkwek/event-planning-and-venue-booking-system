import { describe, expect, it } from "vitest";
import {
  containsPattern,
  describeFilters,
  emptyResultMessage,
  MAX_MINIMUM_CAPACITY,
  MAX_TEXT_LENGTH,
  MAX_WINDOW_DAYS,
  readSearchFilters,
  type SearchFilters,
} from "../../../src/modules/venue/domain/venueSearch.js";

/**
 * J1, J2 — the search's pure rules: reading and checking the query, and wording
 * the message for an empty result. Postgres decides what overlaps and what
 * contains what (repo/venueSearch.ts); nothing here compares two periods.
 */

const NONE: SearchFilters = {
  q: null,
  from: null,
  to: null,
  minCapacity: null,
  location: null,
  layout: null,
  facilities: [],
  accessibility: [],
};

const ok = (query: Record<string, unknown>) => {
  const result = readSearchFilters(query);
  if (!result.ok) throw new Error(`expected a valid query, got ${JSON.stringify(result.fields)}`);
  return result.filters;
};
const refused = (query: Record<string, unknown>) => {
  const result = readSearchFilters(query);
  if (result.ok) throw new Error("expected a refusal");
  return result.fields;
};

describe("readSearchFilters", () => {
  it("reads an empty query as no filters at all (J2 AC4)", () => {
    expect(ok({})).toEqual(NONE);
  });

  it("reads every filter and normalises the window to UTC instants", () => {
    expect(
      ok({
        q: "  hall ",
        from: "2026-12-14T12:00:00+08:00",
        to: "2026-12-14T14:00:00+08:00",
        minCapacity: "150",
        location: " Science ",
        layout: "Theatre",
        facilities: ["Projector", "Wireless microphones"],
        accessibility: "Hearing loop",
      }),
    ).toEqual({
      q: "hall",
      from: "2026-12-14T04:00:00.000Z",
      to: "2026-12-14T06:00:00.000Z",
      minCapacity: 150,
      location: "Science",
      layout: "Theatre",
      facilities: ["Projector", "Wireless microphones"],
      accessibility: ["Hearing loop"],
    });
  });

  it("treats blank text as no filter (J2-T7)", () => {
    expect(ok({ q: "   ", location: "", layout: " ", minCapacity: "", facilities: ["", "  "], accessibility: [] })).toEqual(NONE);
  });

  it("trims list entries, drops blanks and removes repeats in any case", () => {
    expect(ok({ facilities: [" Projector", "projector", "", "Stage lighting "] }).facilities).toEqual(["Projector", "Stage lighting"]);
  });

  it("accepts a window with seconds, fractions, Z and a negative offset", () => {
    const filters = ok({ from: "2026-12-14T10:00Z", to: "2026-12-14T11:30:15.250-05:30" });
    expect(filters.from).toBe("2026-12-14T10:00:00.000Z");
    expect(filters.to).toBe("2026-12-14T17:00:15.250Z");
  });

  describe("minimum capacity", () => {
    it("accepts 1 and the largest allowed value", () => {
      expect(ok({ minCapacity: "1" }).minCapacity).toBe(1);
      expect(ok({ minCapacity: String(MAX_MINIMUM_CAPACITY) }).minCapacity).toBe(MAX_MINIMUM_CAPACITY);
    });

    it.each(["0", String(MAX_MINIMUM_CAPACITY + 1), "-5", "1.5", "ten", "1e3", "0x10"])("refuses %s, naming the field", (value) => {
      expect(refused({ minCapacity: value })).toEqual([
        { field: "minCapacity", message: `Minimum capacity must be a whole number from 1 to ${MAX_MINIMUM_CAPACITY}.` },
      ]);
    });
  });

  describe("text filters", () => {
    it(`accepts ${MAX_TEXT_LENGTH} characters and refuses one more`, () => {
      expect(ok({ q: "a".repeat(MAX_TEXT_LENGTH) }).q).toHaveLength(MAX_TEXT_LENGTH);
      expect(refused({ q: "a".repeat(MAX_TEXT_LENGTH + 1) })).toEqual([
        { field: "q", message: `The search can be at most ${MAX_TEXT_LENGTH} characters.` },
      ]);
    });

    it("refuses a value that is not text, for each field", () => {
      expect(refused({ q: { a: "b" }, location: ["x"], layout: 5, minCapacity: ["1"] })).toEqual([
        { field: "q", message: "The search must be text." },
        { field: "minCapacity", message: "Minimum capacity must be text." },
        { field: "location", message: "The building or location must be text." },
        { field: "layout", message: "The layout must be text." },
      ]);
    });

    it("refuses a list entry that is not text or is too long, naming the list", () => {
      expect(refused({ facilities: [{ a: 1 }], accessibility: ["a".repeat(MAX_TEXT_LENGTH + 1)] })).toEqual([
        { field: "facilities", message: "A facility must be text." },
        { field: "accessibility", message: `An accessibility feature can be at most ${MAX_TEXT_LENGTH} characters.` },
      ]);
    });
  });

  describe("the date and time window", () => {
    const START = "2026-12-14T12:00:00+08:00";

    it("refuses a start without an end, and an end without a start, naming the missing one (J1-T23)", () => {
      expect(refused({ from: START })).toEqual([{ field: "to", message: "Enter when the window ends, as well as when it starts." }]);
      expect(refused({ to: START })).toEqual([{ field: "from", message: "Enter when the window starts, as well as when it ends." }]);
    });

    it("refuses an end that is not after the start, including the very same instant (J1-T23)", () => {
      expect(refused({ from: START, to: "2026-12-14T11:00:00+08:00" })).toEqual([
        { field: "to", message: "The window must end after it starts." },
      ]);
      expect(refused({ from: START, to: START })).toEqual([{ field: "to", message: "The window must end after it starts." }]);
    });

    it("accepts a window one millisecond long", () => {
      expect(ok({ from: "2026-12-14T12:00:00.000Z", to: "2026-12-14T12:00:00.001Z" }).to).toBe("2026-12-14T12:00:00.001Z");
    });

    it(`accepts exactly ${MAX_WINDOW_DAYS} days and refuses a millisecond more`, () => {
      expect(ok({ from: "2026-12-01T00:00:00.000Z", to: "2027-01-01T00:00:00.000Z" }).to).toBe("2027-01-01T00:00:00.000Z");
      expect(refused({ from: "2026-12-01T00:00:00.000Z", to: "2027-01-01T00:00:00.001Z" })).toEqual([
        { field: "to", message: `The window can be at most ${MAX_WINDOW_DAYS} days long.` },
      ]);
    });

    it("names every end that is not a date and time with an offset", () => {
      const message = (end: "start" | "end") =>
        `Enter the ${end} of the window as a date and time with its offset, for example 2026-12-07T10:00:00+08:00.`;
      expect(refused({ from: "14/12/2026", to: "tomorrow" })).toEqual([
        { field: "from", message: message("start") },
        { field: "to", message: message("end") },
      ]);
    });

    it.each([
      ["no offset", "2026-12-14T12:00:00"],
      ["a date alone", "2026-12-14"],
      ["a day that does not exist", "2026-02-30T12:00:00Z"],
      ["a month that does not exist", "2026-13-01T12:00:00Z"],
      ["hour 24", "2026-12-14T24:00:00Z"],
      ["minute 60", "2026-12-14T12:60:00Z"],
      ["second 60", "2026-12-14T12:00:60Z"],
      ["an offset hour above 23", "2026-12-14T12:00:00+24:00"],
      ["an offset minute above 59", "2026-12-14T12:00:00+08:60"],
      ["trailing text", "2026-12-14T12:00:00Z!"],
    ])("refuses %s", (_name, value) => {
      expect(refused({ from: value, to: "2026-12-15T12:00:00Z" }).map((f) => f.field)).toEqual(["from"]);
    });

    it("accepts the last valid values of each part", () => {
      expect(ok({ from: "2026-12-14T23:59:59+23:59", to: "2026-12-16T23:59:59Z" }).from).toBe("2026-12-14T00:00:59.000Z");
    });

    it("accepts 29 February in a leap year and refuses it otherwise", () => {
      expect(ok({ from: "2028-02-29T10:00:00Z", to: "2028-02-29T11:00:00Z" }).from).toBe("2028-02-29T10:00:00.000Z");
      expect(refused({ from: "2027-02-29T10:00:00Z", to: "2027-03-01T11:00:00Z" }).map((f) => f.field)).toEqual(["from"]);
    });

    it("does not also complain about the window when an end is already malformed", () => {
      expect(refused({ from: "nonsense" }).map((f) => f.field)).toEqual(["from"]);
    });
  });

  it("reports every problem at once, in the order the form shows the fields", () => {
    expect(refused({ minCapacity: "0", from: "x", q: 1 }).map((f) => f.field)).toEqual(["q", "from", "minCapacity"]);
  });

  it("returns no filters when anything is refused", () => {
    expect(readSearchFilters({ minCapacity: "0", layout: "Theatre" })).toMatchObject({ ok: false });
  });
});

describe("containsPattern", () => {
  it("matches the text anywhere", () => {
    expect(containsPattern("hall")).toBe("%hall%");
  });

  it("takes % _ and \\ literally so a search for them is not a wildcard (J2-T7)", () => {
    expect(containsPattern("100%")).toBe("%100\\%%");
    expect(containsPattern("a_b")).toBe("%a\\_b%");
    expect(containsPattern("a\\b")).toBe("%a\\\\b%");
    expect(containsPattern("%_\\%_")).toBe("%\\%\\_\\\\\\%\\_%");
  });
});

describe("describeFilters", () => {
  it("is empty when nothing is set", () => {
    expect(describeFilters(NONE)).toEqual([]);
  });

  it("restates each filter, in the order the form shows them, with the window in Singapore time", () => {
    expect(
      describeFilters({
        q: "hall",
        from: "2026-12-14T04:00:00.000Z",
        to: "2026-12-14T06:00:00.000Z",
        minCapacity: 500,
        location: "science",
        layout: "Theatre",
        facilities: ["Projector", "Stage lighting"],
        accessibility: ["Hearing loop"],
      }),
    ).toEqual([
      'name or building containing "hall"',
      "available from 2026-12-14 12:00 to 2026-12-14 14:00 (Singapore time)",
      "minimum capacity 500 (Theatre layout)",
      'building or location containing "science"',
      "layout Theatre",
      "facilities Projector, Stage lighting",
      "accessibility features Hearing loop",
    ]);
  });

  it("names a capacity without a layout plainly, and carries the date across midnight", () => {
    expect(describeFilters({ ...NONE, minCapacity: 1 })).toEqual(["minimum capacity 1"]);
    expect(describeFilters({ ...NONE, from: "2026-12-14T16:00:00.000Z", to: "2026-12-14T17:00:00.000Z" })).toEqual([
      "available from 2026-12-15 00:00 to 2026-12-15 01:00 (Singapore time)",
    ]);
  });

  it("skips a window that has only one end", () => {
    expect(describeFilters({ ...NONE, from: "2026-12-14T04:00:00.000Z" })).toEqual([]);
    expect(describeFilters({ ...NONE, to: "2026-12-14T04:00:00.000Z" })).toEqual([]);
  });
});

describe("emptyResultMessage", () => {
  it("says no venue matches and restates the filters applied (J1 AC7)", () => {
    expect(emptyResultMessage({ ...NONE, minCapacity: 500, facilities: ["Projector"] })).toBe(
      "No active venue matches all of these filters: minimum capacity 500; facilities Projector.",
    );
  });

  it("says so plainly when there were no filters and so no venues", () => {
    expect(emptyResultMessage(NONE)).toBe("No active venues are recorded.");
  });
});
