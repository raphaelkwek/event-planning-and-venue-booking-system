import { describe, expect, it } from "vitest";
import { equipmentRequirementsSchema, venueRequirementsSchema } from "../src/eventRequirements.js";

describe("venueRequirementsSchema", () => {
  it("accepts a layout, facilities and notes", () => {
    const value = { layout: "Theatre", facilities: ["Projector", "Microphone"], notes: "Stage needed" };
    expect(venueRequirementsSchema.parse(value)).toEqual(value);
  });

  it("accepts requirements with only some parts given", () => {
    expect(() => venueRequirementsSchema.parse({ facilities: ["Projector"] })).not.toThrow();
  });

  it("refuses a facility that is an empty string", () => {
    expect(() => venueRequirementsSchema.parse({ facilities: [""] })).toThrow();
  });
});

describe("equipmentRequirementsSchema", () => {
  it("accepts equipment lines with a type, a quantity and notes", () => {
    const value = [{ equipmentType: "Wireless microphone", quantity: 4, notes: "Lapel style" }];
    expect(equipmentRequirementsSchema.parse(value)).toEqual(value);
  });

  it("refuses a quantity of zero", () => {
    expect(() => equipmentRequirementsSchema.parse([{ equipmentType: "Projector", quantity: 0 }])).toThrow();
  });

  it("refuses a fractional quantity", () => {
    expect(() => equipmentRequirementsSchema.parse([{ equipmentType: "Projector", quantity: 1.5 }])).toThrow();
  });

  it("refuses a line with no equipment type", () => {
    expect(() => equipmentRequirementsSchema.parse([{ equipmentType: "  ", quantity: 1 }])).toThrow();
  });
});
