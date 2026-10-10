import { describe, expect, it } from "vitest";
import {
  changedDetails,
  detailsEditableIn,
  etag,
  mayEditDetails,
  notEditableMessage,
  readDetailsEdit,
  readIfMatch,
} from "../../../src/modules/event/domain/eventDetails.js";

/**
 * G1 — editing an event's descriptive details: which fields, in which statuses,
 * by whom, what gets recorded, and the version an edit must carry.
 */

describe("readDetailsEdit", () => {
  it("accepts the four descriptive fields, trimmed, with blank optional ones as empty", () => {
    expect(
      readDetailsEdit({
        purpose: " Share faculty research ",
        description: "A symposium.",
        accessibilityNeeds: "  ",
        contactDetails: "Dr Tan, tan@smu.edu.sg",
      }),
    ).toEqual({
      ok: true,
      changes: {
        purpose: "Share faculty research",
        description: "A symposium.",
        accessibilityNeeds: null,
        contactDetails: "Dr Tan, tan@smu.edu.sg",
      },
    });
  });

  it("accepts any subset, and null for an optional field", () => {
    expect(readDetailsEdit({ contactDetails: null })).toEqual({ ok: true, changes: { contactDetails: null } });
    expect(readDetailsEdit({})).toEqual({ ok: true, changes: {} });
  });

  it("refuses any significant field, naming each, and directs to a change request (G1-T6)", () => {
    expect(readDetailsEdit({ purpose: "Sneaked in", expectedAttendance: 400, proposedStartAt: "2026-12-03T06:00:00Z" })).toEqual({
      ok: false,
      reason: "CHANGE_REQUEST_REQUIRED",
      fields: [
        { field: "expectedAttendance", message: "Change this through a change request." },
        { field: "proposedStartAt", message: "Change this through a change request." },
      ],
    });
  });

  it("refuses a significant field even alongside invalid ones, since nothing is stored either way", () => {
    expect(readDetailsEdit({ purpose: "", venueRequirements: null })).toMatchObject({
      ok: false,
      reason: "CHANGE_REQUEST_REQUIRED",
      fields: [{ field: "venueRequirements" }],
    });
  });

  it("refuses a blank purpose or description, and a one-character one is fine (G1-T10)", () => {
    expect(readDetailsEdit({ purpose: "   ", description: "" })).toEqual({
      ok: false,
      reason: "INVALID",
      fields: [
        { field: "purpose", message: "Purpose is required." },
        { field: "description", message: "Description is required." },
      ],
    });
    expect(readDetailsEdit({ purpose: null })).toMatchObject({ ok: false, fields: [{ field: "purpose", message: "Purpose is required." }] });
    expect(readDetailsEdit({ purpose: "X" })).toEqual({ ok: true, changes: { purpose: "X" } });
  });

  it("refuses fields this screen doesn't edit, values that aren't text, and a body that isn't an object", () => {
    expect(readDetailsEdit({ name: "New name", status: "CONFIRMED" })).toEqual({
      ok: false,
      reason: "INVALID",
      fields: [
        { field: "name", message: "This field can't be edited here." },
        { field: "status", message: "This field can't be edited here." },
      ],
    });
    expect(readDetailsEdit({ contactDetails: 42 })).toEqual({
      ok: false,
      reason: "INVALID",
      fields: [{ field: "contactDetails", message: "Must be text." }],
    });
    for (const body of [null, "purpose", [{ purpose: "x" }]]) {
      expect(readDetailsEdit(body)).toEqual({
        ok: false,
        reason: "INVALID",
        fields: [{ field: "body", message: "Send the changed fields as a JSON object." }],
      });
    }
  });
});

describe("changedDetails", () => {
  const current = {
    purpose: "Share faculty research",
    description: "A one-day symposium.",
    accessibilityNeeds: null,
    contactDetails: null,
  };

  it("lists only the fields whose value changes, with before and after (G1-T7)", () => {
    expect(
      changedDetails(current, {
        purpose: "Share faculty research with industry partners",
        description: "A one-day symposium.",
        contactDetails: "Dr Tan",
      }),
    ).toEqual([
      { fieldName: "purpose", previousValue: "Share faculty research", newValue: "Share faculty research with industry partners" },
      { fieldName: "contactDetails", previousValue: null, newValue: "Dr Tan" },
    ]);
  });

  it("finds nothing to record when nothing changes (G1-T12)", () => {
    expect(changedDetails(current, { purpose: "Share faculty research", accessibilityNeeds: null })).toEqual([]);
    expect(changedDetails(current, {})).toEqual([]);
  });
});

describe("detailsEditableIn and notEditableMessage", () => {
  it("allows Approved, Planning, Safety Review and Confirmed, and nothing else (G1-T3, G1-T4)", () => {
    expect(["APPROVED", "PLANNING", "SAFETY_REVIEW", "CONFIRMED"].map((s) => detailsEditableIn(s as never))).toEqual([true, true, true, true]);
    for (const status of ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "AWAITING_CLARIFICATION", "COMPLETED", "CANCELLED", "REJECTED"]) {
      expect(detailsEditableIn(status as never), status).toBe(false);
    }
  });

  it("names the editable statuses and the current one", () => {
    expect(notEditableMessage("UNDER_REVIEW")).toBe(
      "Details can be edited only while the event is Approved, Planning, Safety Review or Confirmed. It is Under Review.",
    );
  });
});

describe("mayEditDetails", () => {
  const event = { ownerId: "owner", assignedCoordinatorId: "assigned" };

  it("lets the owning organiser and the assigned coordinator edit (G1-T1, G1-T2)", () => {
    expect(mayEditDetails({ userId: "owner", role: "EVENT_ORGANISER" }, event)).toBe(true);
    expect(mayEditDetails({ userId: "assigned", role: "EVENT_COORDINATOR" }, event)).toBe(true);
  });

  it("refuses everyone else, including a coordinator who isn't assigned and an unassigned event (G1-T8)", () => {
    expect(mayEditDetails({ userId: "other", role: "EVENT_COORDINATOR" }, event)).toBe(false);
    expect(mayEditDetails({ userId: "other", role: "EVENT_ORGANISER" }, event)).toBe(false);
    expect(mayEditDetails({ userId: "owner", role: "EVENT_COORDINATOR" }, event)).toBe(false);
    expect(mayEditDetails({ userId: "assigned", role: "EVENT_ORGANISER" }, event)).toBe(false);
    expect(mayEditDetails({ userId: "assigned", role: "EVENT_COORDINATOR" }, { ownerId: "owner", assignedCoordinatorId: null })).toBe(false);
  });

  it("refuses every other role, even with the owner's or the coordinator's id", () => {
    for (const role of ["VENUE_STAFF", "TECH_SUPPORT_STAFF", "ATTENDEE"]) {
      expect(mayEditDetails({ userId: "owner", role }, event), role).toBe(false);
      expect(mayEditDetails({ userId: "assigned", role }, event), role).toBe(false);
    }
  });
});

describe("etag and readIfMatch", () => {
  it("quote the version, and read it back strong or weak", () => {
    expect(etag(3)).toBe('"3"');
    expect(readIfMatch('"3"')).toBe(3);
    expect(readIfMatch('W/"12"')).toBe(12);
    expect(readIfMatch(" \"7\" ")).toBe(7);
  });

  it("tell a missing header from one that can't match any version", () => {
    expect(readIfMatch(undefined)).toBe("MISSING");
    expect(readIfMatch("")).toBe("MISSING");
    for (const header of ["3", '"three"', '"3", "4"', "*", '"0"']) {
      expect(readIfMatch(header), header).toBe("UNREADABLE");
    }
  });
});
