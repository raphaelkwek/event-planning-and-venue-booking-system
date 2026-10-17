import { describe, expect, it } from "vitest";
import { EVENT_STATUSES } from "@connectsphere/contracts";
import {
  CHANGEABLE_STATUSES,
  MAX_REASON_LENGTH,
  isChangeable,
  normaliseInstants,
  notChangeableMessage,
  validateChangeBody,
  validateDecisionBody,
  alreadyDecidedMessage,
  DECISION_LABELS,
} from "../../../src/modules/change/domain/changeRequests.js";

describe("isChangeable (AC1)", () => {
  it("accepts Submitted and every later status that is still going ahead", () => {
    for (const status of ["SUBMITTED", "UNDER_REVIEW", "AWAITING_CLARIFICATION", "APPROVED", "PLANNING", "SAFETY_REVIEW", "CONFIRMED"] as const) {
      expect(isChangeable(status)).toBe(true);
    }
  });

  it("refuses Draft, Completed, Cancelled and Rejected", () => {
    for (const status of ["DRAFT", "COMPLETED", "CANCELLED", "REJECTED"] as const) {
      expect(isChangeable(status)).toBe(false);
    }
  });

  it("decides every status one way or the other", () => {
    expect(CHANGEABLE_STATUSES.every((status) => EVENT_STATUSES.includes(status))).toBe(true);
    expect(EVENT_STATUSES.filter((status) => !isChangeable(status)).sort()).toEqual(["CANCELLED", "COMPLETED", "DRAFT", "REJECTED"]);
  });
});

describe("notChangeableMessage", () => {
  it("names the status by its label", () => {
    expect(notChangeableMessage("COMPLETED")).toBe(
      "A change can be requested only once the event is submitted and while it is still going ahead. It is Completed."
    );
  });
});

describe("validateChangeBody", () => {
  it("accepts a reason and proposed changes, trimming the reason", () => {
    expect(validateChangeBody({ reason: "  More people  ", changes: { expectedAttendance: 180 } })).toEqual({
      ok: true,
      reason: "More people",
      changes: { expectedAttendance: 180 },
    });
  });

  it("accepts a reason of exactly the longest length, and refuses one a character longer", () => {
    expect(validateChangeBody({ reason: "x".repeat(MAX_REASON_LENGTH), changes: { expectedAttendance: 1 } }).ok).toBe(true);
    expect(validateChangeBody({ reason: "x".repeat(MAX_REASON_LENGTH + 1), changes: { expectedAttendance: 1 } })).toEqual({
      ok: false,
      fields: [{ field: "reason", message: `The reason can be at most ${MAX_REASON_LENGTH} characters.` }],
      proposed: { expectedAttendance: 1 },
    });
  });

  it.each([[undefined], [""], ["   "], [42], [null]])("refuses the reason %j", (reason) => {
    expect(validateChangeBody({ reason, changes: { expectedAttendance: 1 } })).toEqual({
      ok: false,
      fields: [{ field: "reason", message: "Give a reason for the change." }],
      proposed: { expectedAttendance: 1 },
    });
  });

  it.each([[undefined], [{}], [[]], [null], ["x"], [[1]]])("refuses changes %j", (changes) => {
    expect(validateChangeBody({ reason: "x", changes })).toEqual({
      ok: false,
      fields: [{ field: "changes", message: "Propose at least one change." }],
      proposed: {},
    });
  });

  it("sends the four G1 detail fields to Edit details", () => {
    const result = validateChangeBody({
      reason: "x",
      changes: { purpose: "a", description: "b", accessibilityNeeds: "c", contactDetails: "d" },
    });
    expect(result).toEqual({
      ok: false,
      fields: ["purpose", "description", "accessibilityNeeds", "contactDetails"].map((field) => ({
        field: `changes.${field}`,
        message: "Change this through Edit details.",
      })),
      proposed: {},
    });
  });

  it("refuses any other unknown field", () => {
    expect(validateChangeBody({ reason: "x", changes: { name: "New", expectedAttendance: 5 } })).toEqual({
      ok: false,
      fields: [{ field: "changes.name", message: "This field can't be changed." }],
      proposed: { expectedAttendance: 5 },
    });
  });

  it("reports every problem at once", () => {
    expect(validateChangeBody({ changes: { purpose: "a", colour: "red" } })).toEqual({
      ok: false,
      fields: [
        { field: "reason", message: "Give a reason for the change." },
        { field: "changes.purpose", message: "Change this through Edit details." },
        { field: "changes.colour", message: "This field can't be changed." },
      ],
      proposed: {},
    });
  });

  it("treats a body that is not an object as having neither reason nor changes", () => {
    for (const raw of [undefined, null, "x", [], 3]) {
      expect(validateChangeBody(raw)).toEqual({
        ok: false,
        fields: [
          { field: "reason", message: "Give a reason for the change." },
          { field: "changes", message: "Propose at least one change." },
        ],
        proposed: {},
      });
    }
  });
});

describe("normaliseInstants", () => {
  it("stores a start and end written with an offset as UTC", () => {
    expect(normaliseInstants({ proposedStartAt: "2026-12-02T15:00:00+08:00", proposedEndAt: "2026-12-02T18:00:00.000Z" })).toEqual({
      proposedStartAt: "2026-12-02T07:00:00.000Z",
      proposedEndAt: "2026-12-02T18:00:00.000Z",
    });
  });

  it("leaves other fields, nulls and unparseable values as they are", () => {
    const changes = { expectedAttendance: 5, proposedStartAt: "soon", proposedEndAt: null };
    expect(normaliseInstants(changes)).toEqual(changes);
  });
});

describe("validateDecisionBody (S2)", () => {
  it("accepts Approve, ignoring any reason sent with it", () => {
    expect(validateDecisionBody({ decision: "APPROVE" })).toEqual({ ok: true, decision: "APPROVE" });
    expect(validateDecisionBody({ decision: "APPROVE", reason: "x" })).toEqual({ ok: true, decision: "APPROVE" });
  });

  it("accepts Reject with a reason, trimmed, up to the longest length", () => {
    expect(validateDecisionBody({ decision: "REJECT", reason: "  No larger hall  " })).toEqual({
      ok: true,
      decision: "REJECT",
      reason: "No larger hall",
    });
    expect(validateDecisionBody({ decision: "REJECT", reason: "x".repeat(MAX_REASON_LENGTH) }).ok).toBe(true);
  });

  it("refuses a Reject without a usable reason, naming the reason", () => {
    for (const reason of [undefined, "", "   ", 42, null]) {
      expect(validateDecisionBody({ decision: "REJECT", reason })).toEqual({
        ok: false,
        fields: [{ field: "reason", message: "Give a reason for rejecting the change." }],
      });
    }
  });

  it("refuses a reason longer than the longest length", () => {
    expect(validateDecisionBody({ decision: "REJECT", reason: "x".repeat(MAX_REASON_LENGTH + 1) })).toEqual({
      ok: false,
      fields: [{ field: "reason", message: `The reason can be at most ${MAX_REASON_LENGTH} characters.` }],
    });
  });

  it("refuses any other decision, and a body that is not an object, naming the decision", () => {
    for (const raw of [{ decision: "approve" }, { decision: "MAYBE" }, { reason: "x" }, undefined, null, "x", [], 3]) {
      expect(validateDecisionBody(raw)).toEqual({ ok: false, fields: [{ field: "decision", message: "Choose Approve or Reject." }] });
    }
  });
});

describe("alreadyDecidedMessage (S2)", () => {
  it("names the decision and when it was made", () => {
    expect(alreadyDecidedMessage("APPROVED", "2026-12-01T10:00:00.000Z")).toBe(
      "This change request was already Approved on 2026-12-01T10:00:00.000Z."
    );
    expect(alreadyDecidedMessage("REJECTED", "2026-12-01T10:00:00.000Z")).toContain(DECISION_LABELS.REJECTED);
  });
});
