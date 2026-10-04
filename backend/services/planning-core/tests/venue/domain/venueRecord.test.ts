import { describe, expect, it } from "vitest";
import { changedFields, DAYS, validateVenue, type VenueInput } from "../../../src/modules/venue/domain/venueRecord.js";

/** H1's rules for a venue record, as pure functions. */

const open = (opensAt: string, closesAt: string) => ({ opensAt, closesAt });

function standard(): VenueInput {
  return {
    name: "Lee Kong Chian Auditorium",
    building: "School of Computing, Level 1",
    maxCapacity: 300,
    layouts: [
      { name: "Theatre", capacity: 300 },
      { name: "Classroom", capacity: 120 },
      { name: "Banquet", capacity: 180 },
    ],
    facilities: ["Projector", "Wireless microphones", "Stage lighting"],
    accessibilityFeatures: ["Step-free access", "Hearing loop", "Accessible toilet"],
    operatingHours: {
      monday: open("08:00", "22:00"),
      tuesday: open("08:00", "22:00"),
      wednesday: open("08:00", "22:00"),
      thursday: open("08:00", "22:00"),
      friday: open("08:00", "22:00"),
      saturday: open("09:00", "18:00"),
      sunday: null,
    },
    isActive: true,
  };
}

function fieldsOf(input: VenueInput) {
  const result = validateVenue(input);
  return result.ok ? [] : result.fields;
}

describe("validateVenue", () => {
  it("accepts the standard venue", () => {
    expect(validateVenue(standard())).toEqual({ ok: true, venue: standard() });
  });

  it("covers every day of the week, Monday first", () => {
    expect(DAYS).toEqual(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]);
  });

  it("trims text, and drops blank or repeated facilities and accessibility features", () => {
    const result = validateVenue({
      ...standard(),
      name: "  Lee Kong Chian Auditorium ",
      building: " School of Computing, Level 1",
      layouts: [{ name: " Theatre ", capacity: 300 }],
      facilities: ["Projector", " ", "Projector", " Stage lighting "],
      accessibilityFeatures: ["", "Hearing loop"],
    });
    expect(result).toMatchObject({
      ok: true,
      venue: {
        name: "Lee Kong Chian Auditorium",
        building: "School of Computing, Level 1",
        layouts: [{ name: "Theatre", capacity: 300 }],
        facilities: ["Projector", "Stage lighting"],
        accessibilityFeatures: ["Hearing loop"],
      },
    });
  });

  it("requires a name and a building", () => {
    expect(fieldsOf({ ...standard(), name: " ", building: "" })).toEqual([
      { field: "name", message: "Enter the venue's name." },
      { field: "building", message: "Enter the building or location." },
    ]);
  });

  describe("maximum capacity: a whole number greater than zero", () => {
    const message = "Maximum capacity must be a whole number greater than zero.";
    it.each([0, -5, 150.5])("refuses %s", (maxCapacity) => {
      expect(fieldsOf({ ...standard(), maxCapacity })).toEqual([{ field: "maxCapacity", message }]);
    });
    it("accepts 1", () => {
      expect(fieldsOf({ ...standard(), maxCapacity: 1, layouts: [{ name: "Boardroom", capacity: 1 }] })).toEqual([]);
    });
  });

  describe("layouts", () => {
    it("requires at least one", () => {
      expect(fieldsOf({ ...standard(), layouts: [] })).toEqual([{ field: "layouts", message: "Record at least one layout." }]);
    });

    it("refuses a layout capacity of 0 or a fraction, naming the layout's row", () => {
      const layouts = [
        { name: "Theatre", capacity: 300 },
        { name: "Classroom", capacity: 0 },
        { name: "Banquet", capacity: 12.5 },
      ];
      const message = "Layout capacity must be a whole number greater than zero.";
      expect(fieldsOf({ ...standard(), layouts })).toEqual([
        { field: "layouts[1].capacity", message },
        { field: "layouts[2].capacity", message },
      ]);
    });

    it("requires each layout to be named", () => {
      expect(fieldsOf({ ...standard(), layouts: [{ name: " ", capacity: 10 }] })).toEqual([
        { field: "layouts[0].name", message: "Enter the layout's name." },
      ]);
    });

    it("records each layout once, whatever its case", () => {
      const layouts = [
        { name: "Theatre", capacity: 300 },
        { name: "theatre", capacity: 250 },
      ];
      expect(fieldsOf({ ...standard(), layouts })).toEqual([
        { field: "layouts[1].name", message: "Each layout can be recorded once." },
      ]);
    });
  });

  describe("operating hours", () => {
    it("accepts a closed day", () => {
      expect(fieldsOf({ ...standard(), operatingHours: { ...standard().operatingHours, monday: null } })).toEqual([]);
    });

    it("refuses a day that closes before or as it opens", () => {
      const hours = { ...standard().operatingHours, monday: open("18:00", "08:00"), tuesday: open("09:00", "09:00") };
      expect(fieldsOf({ ...standard(), operatingHours: hours })).toEqual([
        { field: "operatingHours.monday", message: "Closing time must be later than opening time." },
        { field: "operatingHours.tuesday", message: "Closing time must be later than opening time." },
      ]);
    });

    it("refuses a time that is not HH:MM on a 24-hour clock", () => {
      const hours = { ...standard().operatingHours, friday: open("8am", "24:00") };
      expect(fieldsOf({ ...standard(), operatingHours: hours })).toEqual([
        { field: "operatingHours.friday", message: "Enter times as HH:MM, for example 08:00." },
      ]);
    });

    it("requires every day to be given, open or closed", () => {
      const { sunday: _omitted, ...sixDays } = standard().operatingHours;
      void _omitted;
      expect(fieldsOf({ ...standard(), operatingHours: sixDays as VenueInput["operatingHours"] })).toEqual([
        { field: "operatingHours.sunday", message: "Give Sunday's hours, or mark it closed." },
      ]);
    });
  });

  it("names every problem at once", () => {
    expect(fieldsOf({ ...standard(), name: "", maxCapacity: 0, layouts: [] }).map((f) => f.field)).toEqual([
      "name",
      "maxCapacity",
      "layouts",
    ]);
  });
});

describe("changedFields", () => {
  it("lists only the fields that changed, each with its previous and new value", () => {
    const before = standard();
    const after = { ...standard(), maxCapacity: 320, facilities: [...before.facilities, "Livestream camera"] };
    expect(changedFields(before, after)).toEqual({
      maxCapacity: { previous: 300, new: 320 },
      facilities: { previous: before.facilities, new: after.facilities },
    });
  });

  it("is empty when nothing changed", () => {
    expect(changedFields(standard(), standard())).toEqual({});
  });

  it("treats the same hours with their keys in another order as unchanged, as jsonb returns them", () => {
    const stored = standard();
    stored.operatingHours = Object.fromEntries(
      Object.entries(stored.operatingHours)
        .reverse()
        .map(([day, hours]) => [day, hours && { closesAt: hours.closesAt, opensAt: hours.opensAt }]),
    ) as VenueInput["operatingHours"];
    expect(changedFields(stored, standard())).toEqual({});
  });

  it("notices a change inside a layout or a day's hours", () => {
    const after = {
      ...standard(),
      layouts: [{ name: "Theatre", capacity: 280 }, ...standard().layouts.slice(1)],
      operatingHours: { ...standard().operatingHours, sunday: open("10:00", "16:00") },
      isActive: false,
    };
    expect(Object.keys(changedFields(standard(), after))).toEqual(["layouts", "operatingHours", "isActive"]);
  });
});
