import { describe, expect, it } from "vitest";
import { toFormFields, toRequestBody } from "../src/api/events.js";
import type { EventRecord, RequestFields } from "../src/api/types.js";

/** B1 — the request form captures venue and equipment requirements. */

const form: RequestFields = {
  name: "Annual Research Symposium",
  purpose: "Share faculty research",
  description: "A one-day symposium.",
  proposedStartAt: "2026-12-02T14:00",
  proposedEndAt: "2026-12-02T18:00",
  expectedAttendance: "150",
  accessibilityNeeds: "",
  equipmentRequired: true,
  registrationRequired: false,
  registrationOpensAt: "",
  registrationClosesAt: "",
  venueLayout: "Theatre",
  venueFacilities: "Projector, Microphone ,",
  venueNotes: "Stage needed",
  equipmentLines: [{ equipmentType: "Wireless microphone", quantity: "4", notes: "" }],
};

describe("toRequestBody", () => {
  it("sends venue requirements as a layout, a list of facilities and notes", () => {
    expect(toRequestBody(form, { partial: false }).venueRequirements).toEqual({
      layout: "Theatre",
      facilities: ["Projector", "Microphone"],
      notes: "Stage needed",
    });
  });

  it("sends no venue requirements when none are entered", () => {
    const body = toRequestBody({ ...form, venueLayout: " ", venueFacilities: "", venueNotes: "" }, { partial: false });
    expect(body.venueRequirements).toBeNull();
  });

  it("sends equipment lines, with quantities as numbers", () => {
    expect(toRequestBody(form, { partial: false }).equipmentRequirements).toEqual([
      { equipmentType: "Wireless microphone", quantity: 4, notes: null },
    ]);
  });

  it("sends no equipment lines when equipment is not required", () => {
    const body = toRequestBody({ ...form, equipmentRequired: false }, { partial: false });
    expect(body.equipmentRequirements).toBeNull();
  });

  it("leaves out equipment lines that are entirely blank", () => {
    const body = toRequestBody(
      { ...form, equipmentLines: [...form.equipmentLines, { equipmentType: "", quantity: "", notes: "" }] },
      { partial: false }
    );
    expect(body.equipmentRequirements).toHaveLength(1);
  });
});

describe("toFormFields", () => {
  it("restores saved requirements into the form", () => {
    const record = {
      venueRequirements: { layout: "Theatre", facilities: ["Projector", "Microphone"], notes: "Stage needed" },
      equipmentRequirements: [{ equipmentType: "Wireless microphone", quantity: 4, notes: null }],
    } as unknown as EventRecord;

    const restored = toFormFields({
      ...record,
      name: "x",
      purpose: null,
      description: null,
      proposedStartAt: null,
      proposedEndAt: null,
      expectedAttendance: null,
      accessibilityNeeds: null,
      equipmentRequired: true,
      registrationRequired: false,
      registrationOpensAt: null,
      registrationClosesAt: null,
    } as EventRecord);

    expect(restored).toMatchObject({
      venueLayout: "Theatre",
      venueFacilities: "Projector, Microphone",
      venueNotes: "Stage needed",
      equipmentLines: [{ equipmentType: "Wireless microphone", quantity: "4", notes: "" }],
    });
  });
});
