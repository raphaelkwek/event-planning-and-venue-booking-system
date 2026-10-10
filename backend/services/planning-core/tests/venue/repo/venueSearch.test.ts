import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testDb } from "../../support/testDb.js";
import { listCatalogueOptions, searchVenues } from "../../../src/modules/venue/repo/venueSearch.js";
import type { SearchFilters } from "../../../src/modules/venue/domain/venueSearch.js";
import { at, removeSearchFixture, seedSearchFixture } from "../support/searchFixture.js";

/**
 * J1, J2 — the search query against real Postgres: the filters, the overlap,
 * opening-hours and containment comparisons Postgres makes, and the edges the
 * functional cases name (tests/J1, tests/J2). The data is FX-SEARCH's.
 *
 * The shared database holds other venues, so every search is narrowed to the
 * fixture's buildings (location "J1T") unless the test is about the location.
 */

const sql = testDb();

beforeAll(async () => {
  await removeSearchFixture(sql);
  await seedSearchFixture(sql);
});
afterAll(async () => {
  await removeSearchFixture(sql);
  await sql.end();
});

const NONE: SearchFilters = {
  q: null,
  from: null,
  to: null,
  minCapacity: null,
  location: "J1T",
  layout: null,
  facilities: [],
  accessibility: [],
};

/** The names found, without the fixture's "J1T " prefix. */
async function find(filters: Partial<SearchFilters> = {}): Promise<string[]> {
  const found = await searchVenues(sql, { ...NONE, ...filters });
  return found.map((venue) => venue.name.replace("J1T ", ""));
}

const window = (day: number, from: string, to: string) => ({ from: at(day, from), to: at(day, to) });
const ALL_ACTIVE = ["Auditorium", "Late Studio", "Lecture Hall", "Seminar Room"];

describe("an empty search (J2 AC4, J1 AC5)", () => {
  it("returns every active venue and no inactive one, by name", async () => {
    expect(await find()).toEqual(ALL_ACTIVE);
    expect(await find({ location: null, q: "J1T" })).toEqual(ALL_ACTIVE);
  });

  it("returns the fields a result row shows (J2 AC3)", async () => {
    const [lectureHall] = await searchVenues(sql, { ...NONE, q: "lecture" });
    expect(lectureHall).toMatchObject({
      name: "J1T Lecture Hall",
      building: "J1T Arts Building",
      maxCapacity: 200,
      layoutCapacity: null,
      facilities: ["Projector", "Wireless microphones", "Stage lighting"],
      accessibilityFeatures: ["Step-free access", "Hearing loop", "Accessible toilet"],
    });
  });
});

describe("search by name or building (J2)", () => {
  it("matches part of the name, ignoring case (J2-T1)", async () => {
    expect(await find({ q: "audit" })).toEqual(["Auditorium"]);
    expect(await find({ q: "HALL" })).toEqual(["Lecture Hall"]);
    expect(await find({ q: "ecture" })).toEqual(["Lecture Hall"]);
  });

  it("matches part of the building, ignoring case (J2-T2)", async () => {
    expect(await find({ q: "SCIENCE block" })).toEqual(["Auditorium", "Seminar Room"]);
    expect(await find({ q: "arts" })).toEqual(["Lecture Hall"]);
  });

  it("never returns an inactive venue (J2-T3)", async () => {
    expect(await find({ q: "old gym" })).toEqual([]);
  });

  it("takes % and _ literally (J2-T7)", async () => {
    expect(await find({ q: "%" })).toEqual([]);
    expect(await find({ q: "_" })).toEqual([]);
    expect(await find({ q: "J1T_Auditorium" })).toEqual([]);
    expect(await find({ q: "J1T Auditorium" })).toEqual(["Auditorium"]);
  });

  it("combines with the filters, and the result satisfies both (J2-T4)", async () => {
    expect(await find({ q: "science", minCapacity: 100 })).toEqual(["Auditorium"]);
    expect(await find({ q: "science", minCapacity: 100, accessibility: ["Hearing loop"] })).toEqual(["Auditorium"]);
    expect(await find({ q: "science", minCapacity: 100, ...window(14, "10:30", "11:30") })).toEqual([]);
  });
});

describe("capacity (J1 AC6)", () => {
  it("compares with the maximum capacity when no layout is chosen (J1-T2)", async () => {
    expect(await find({ minCapacity: 100 })).toEqual(["Auditorium", "Late Studio", "Lecture Hall"]);
  });

  it("keeps a venue whose capacity equals the minimum, and drops it for one more (J1-T3)", async () => {
    expect(await find({ minCapacity: 200 })).toEqual(["Auditorium", "Lecture Hall"]);
    expect(await find({ minCapacity: 201 })).toEqual(["Auditorium"]);
    expect(await find({ minCapacity: 300 })).toEqual(["Auditorium"]);
    expect(await find({ minCapacity: 301 })).toEqual([]);
  });

  it("compares with the chosen layout's capacity instead of the maximum (J1-T4)", async () => {
    expect(await find({ layout: "Classroom", minCapacity: 100 })).toEqual(["Auditorium"]);
  });

  it("keeps a venue whose layout capacity equals the minimum, and drops it for one more (J1-T5)", async () => {
    expect(await find({ layout: "Classroom", minCapacity: 80 })).toEqual(["Auditorium", "Lecture Hall"]);
    expect(await find({ layout: "classroom", minCapacity: 81 })).toEqual(["Auditorium"]);
  });

  it("reports the layout's capacity on each row when a layout is chosen", async () => {
    const found = await searchVenues(sql, { ...NONE, layout: "Classroom" });
    expect(found.map((v) => [v.name, v.layoutCapacity])).toEqual([
      ["J1T Auditorium", 120],
      ["J1T Lecture Hall", 80],
      ["J1T Seminar Room", 40],
    ]);
  });
});

describe("building, layout, facilities and accessibility (J1 AC1, AC2)", () => {
  it("matches the building by part of its name, ignoring case (J1-T6)", async () => {
    expect(await find({ location: "J1T SCIENCE" })).toEqual(["Auditorium", "Seminar Room"]);
    expect(await find({ location: "j1t arts building" })).toEqual(["Lecture Hall"]);
    expect(await find({ location: "Nowhere Hall" })).toEqual([]);
  });

  it("keeps only venues that offer the required layout (J1-T7)", async () => {
    expect(await find({ layout: "Boardroom" })).toEqual(["Seminar Room"]);
    expect(await find({ layout: "Theatre" })).toEqual(["Auditorium", "Late Studio", "Lecture Hall"]);
    expect(await find({ layout: "Banquet" })).toEqual([]);
  });

  it("requires every facility, ignoring case; a venue missing one is excluded (J1-T8)", async () => {
    expect(await find({ facilities: ["Stage lighting"] })).toEqual(["Lecture Hall"]);
    expect(await find({ facilities: ["projector", "WIRELESS microphones"] })).toEqual(["Auditorium", "Lecture Hall"]);
    expect(await find({ facilities: ["Projector", "Wireless microphones", "Stage lighting"] })).toEqual(["Lecture Hall"]);
    expect(await find({ facilities: ["Projector", "Smoke machine"] })).toEqual([]);
  });

  it("requires every accessibility feature (J1-T9)", async () => {
    expect(await find({ accessibility: ["Hearing loop"] })).toEqual(["Auditorium", "Lecture Hall"]);
    expect(await find({ accessibility: ["Accessible toilet"] })).toEqual(["Lecture Hall"]);
    expect(await find({ accessibility: ["Step-free access", "Hearing loop"] })).toEqual(["Auditorium", "Lecture Hall"]);
    expect(await find({ accessibility: ["Hearing loop", "Accessible toilet", "Braille signs"] })).toEqual([]);
  });

  it("returns only venues meeting every filter at once (J1-T10)", async () => {
    expect(
      await find({
        location: "J1T Science",
        minCapacity: 100,
        layout: "Classroom",
        facilities: ["Projector"],
        accessibility: ["Hearing loop"],
        ...window(16, "10:00", "11:00"),
      }),
    ).toEqual(["Auditorium"]);
  });
});

describe("what is already on at the venue (J1 AC3)", () => {
  it("excludes a venue with a confirmed booking inside the window (J1-T11)", async () => {
    expect(await find({ location: "J1T Science", ...window(14, "10:30", "11:30") })).toEqual(["Seminar Room"]);
  });

  it("excludes a venue with a tentative hold inside the window (J1-T12)", async () => {
    expect(await find({ location: "J1T Science", ...window(14, "14:30", "15:30") })).toEqual(["Auditorium"]);
  });

  it("excludes a venue with an active block; a released slot and a removed block exclude nothing (J1-T13)", async () => {
    expect(await find({ location: "J1T Arts", ...window(14, "10:00", "11:00") })).toEqual([]);
    expect(await find({ location: "J1T Arts", ...window(14, "15:30", "16:30") })).toEqual(["Lecture Hall"]);
    expect(await find({ location: "J1T Arts", ...window(16, "10:00", "11:00") })).toEqual(["Lecture Hall"]);
  });

  it("does not treat periods that merely touch as overlapping, on either side (J1-T14)", async () => {
    // The booking ends at 12:00, the hold starts at 14:00, the block runs to 13:00.
    expect(await find(window(14, "12:00", "14:00"))).toEqual(["Auditorium", "Late Studio", "Seminar Room"]);
  });

  it("excludes a window that overlaps by a single minute at either end", async () => {
    expect(await find({ location: "J1T Science", ...window(14, "11:59", "13:00") })).toEqual(["Seminar Room"]);
    expect(await find({ location: "J1T Science", ...window(14, "13:00", "14:01") })).toEqual(["Auditorium"]);
  });
});

describe("opening hours (J1 AC3)", () => {
  it("excludes a venue that is closed, opens later, or is closed overnight during the window (J1-T15)", async () => {
    expect(await find(window(13, "10:00", "12:00"))).toEqual([]);
    expect(await find(window(14, "07:00", "09:00"))).toEqual([]);
    expect(await find({ from: at(14, "21:00"), to: at(15, "09:00") })).toEqual([]);
  });

  it("keeps a window that starts exactly at opening and ends exactly at closing, and drops one a minute outside (J1-T16)", async () => {
    expect(await find(window(14, "08:00", "08:30"))).toEqual(["Auditorium", "Lecture Hall", "Seminar Room"]);
    expect(await find(window(14, "07:59", "08:30"))).toEqual([]);
    expect(await find(window(14, "20:00", "22:00"))).toEqual(["Auditorium", "Lecture Hall", "Seminar Room"]);
    expect(await find(window(14, "21:30", "22:01"))).toEqual([]);
  });

  it("uses each venue's own hours: the late studio opens at noon and closes at eight", async () => {
    expect(await find(window(15, "12:00", "13:00"))).toContain("Late Studio");
    expect(await find(window(15, "11:59", "13:00"))).not.toContain("Late Studio");
    expect(await find(window(15, "19:00", "20:00"))).toContain("Late Studio");
    expect(await find(window(15, "19:00", "20:01"))).not.toContain("Late Studio");
  });

  it("uses Saturday's hours", async () => {
    expect(await find(window(12, "09:00", "18:00"))).toEqual(["Auditorium", "Lecture Hall", "Seminar Room"]);
    expect(await find(window(12, "08:59", "10:00"))).toEqual([]);
    expect(await find(window(12, "17:00", "18:01"))).toEqual([]);
  });

});

describe("CR-01: occupied periods (J1 AC4)", () => {
  const science = (from: string, to: string) => find({ location: "J1T Science", ...window(15, from, to) });

  it("compares a booking's occupied period, with its own setup and turnaround time (J1-T17)", async () => {
    // Booked 14:00-16:00 with 30 minutes either side: occupied 13:30-16:30.
    expect(await science("13:00", "13:45")).toEqual(["Seminar Room"]);
    expect(await science("16:00", "18:00")).toEqual(["Seminar Room"]);
  });

  it("does not overlap an occupied period it merely touches (J1-T17)", async () => {
    expect(await science("13:00", "13:30")).toEqual(["Auditorium", "Seminar Room"]);
    expect(await science("16:30", "18:30")).toEqual(["Auditorium", "Seminar Room"]);
  });
});

describe("inactive venues (J1 AC5)", () => {
  it("never returns an inactive venue, whatever else it matches (J1-T19)", async () => {
    expect(await find({ minCapacity: 400 })).toEqual([]);
    expect(await find({ facilities: ["Stage lighting"], layout: "Theatre", minCapacity: 250 })).toEqual([]);
  });
});

describe("listCatalogueOptions", () => {
  it("lists each layout, facility and accessibility feature the active venues offer, once", async () => {
    const options = await listCatalogueOptions(sql);
    for (const layout of ["Theatre", "Classroom", "Boardroom"]) expect(options.layouts).toContain(layout);
    for (const name of ["Projector", "Wireless microphones", "Stage lighting"]) expect(options.facilities).toContain(name);
    for (const name of ["Step-free access", "Hearing loop", "Accessible toilet"]) expect(options.accessibilityFeatures).toContain(name);
    const lower = options.facilities.map((name) => name.toLowerCase());
    expect(new Set(lower).size).toBe(lower.length);
  });
});
