import { describe, expect, it } from "vitest";
import { DAYS, emptyVenueForm, fromVenue, toVenueBody, type VenueForm } from "../src/api/venues.js";

/** H1: the venue form's strings to the API body, and a stored venue back to the form. */

function standardForm(): VenueForm {
  const form = emptyVenueForm();
  form.name = "Lee Kong Chian Auditorium";
  form.building = "School of Computing, Level 1";
  form.maxCapacity = "300";
  form.layouts = [
    { name: "Theatre", capacity: "300" },
    { name: "Classroom", capacity: "120" },
  ];
  form.facilities = "Projector\nWireless microphones\n";
  form.accessibilityFeatures = "Step-free access\r\nHearing loop";
  form.hours.saturday = { closed: false, opensAt: "09:00", closesAt: "18:00" };
  form.hours.sunday = { closed: true, opensAt: "", closesAt: "" };
  return form;
}

describe("emptyVenueForm", () => {
  it("starts with one blank layout, every day open 08:00 to 22:00, and the venue active", () => {
    const form = emptyVenueForm();
    expect(form.layouts).toEqual([{ name: "", capacity: "" }]);
    expect(DAYS.map((day) => form.hours[day])).toEqual(
      DAYS.map(() => ({ closed: false, opensAt: "08:00", closesAt: "22:00" })),
    );
    expect(form.isActive).toBe(true);
  });
});

describe("toVenueBody", () => {
  it("sends numbers as numbers, one facility per line, and a closed day as null", () => {
    expect(toVenueBody(standardForm())).toEqual({
      name: "Lee Kong Chian Auditorium",
      building: "School of Computing, Level 1",
      maxCapacity: 300,
      layouts: [
        { name: "Theatre", capacity: 300 },
        { name: "Classroom", capacity: 120 },
      ],
      facilities: ["Projector", "Wireless microphones"],
      accessibilityFeatures: ["Step-free access", "Hearing loop"],
      operatingHours: {
        monday: { opensAt: "08:00", closesAt: "22:00" },
        tuesday: { opensAt: "08:00", closesAt: "22:00" },
        wednesday: { opensAt: "08:00", closesAt: "22:00" },
        thursday: { opensAt: "08:00", closesAt: "22:00" },
        friday: { opensAt: "08:00", closesAt: "22:00" },
        saturday: { opensAt: "09:00", closesAt: "18:00" },
        sunday: null,
      },
      isActive: true,
    });
  });

  it("sends a fraction as typed, so the server can refuse it, and an empty or non-numeric capacity as null", () => {
    const form = standardForm();
    form.maxCapacity = "150.5";
    form.layouts = [{ name: "Theatre", capacity: "" }, { name: "Boardroom", capacity: "ten" }];
    const body = toVenueBody(form);
    expect(body.maxCapacity).toBe(150.5);
    expect(body.layouts.map((l) => l.capacity)).toEqual([null, null]);
  });
});

describe("fromVenue", () => {
  it("puts a stored venue back into the form, one entry per line", () => {
    const body = toVenueBody(standardForm());
    const form = fromVenue({ ...body, maxCapacity: 300, isActive: false });
    expect(form).toMatchObject({
      name: "Lee Kong Chian Auditorium",
      maxCapacity: "300",
      layouts: [
        { name: "Theatre", capacity: "300" },
        { name: "Classroom", capacity: "120" },
      ],
      facilities: "Projector\nWireless microphones",
      accessibilityFeatures: "Step-free access\nHearing loop",
      isActive: false,
    });
    expect(form.hours.sunday).toEqual({ closed: true, opensAt: "", closesAt: "" });
    expect(form.hours.saturday).toEqual({ closed: false, opensAt: "09:00", closesAt: "18:00" });
  });
});
