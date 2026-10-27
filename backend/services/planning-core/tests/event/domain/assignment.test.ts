import { describe, expect, it } from "vitest";
import { EVENT_STATUSES } from "@connectsphere/contracts";
import {
  ASSIGNMENT_NOT_ACTIVE_COORDINATOR,
  canAssign,
  LEAD_ASSIGNMENT_RULE,
  canProposeReassignment,
  isSelfNomination,
} from "../../../src/modules/event/domain/assignment.js";

/**
 * E3 — the Lead assigns a submitted request. A draft has not been submitted, and
 * a Rejected, Cancelled or Completed event has left the workflow; every other
 * status may be assigned.
 */
describe("canAssign (E3)", () => {
  const closed = ["DRAFT", "REJECTED", "CANCELLED", "COMPLETED"];
  for (const status of EVENT_STATUSES) {
    const expected = !closed.includes(status);
    it(`${expected ? "permits" : "refuses"} assigning an event that is ${status}`, () => {
      expect(canAssign(status)).toBe(expected);
    });
  }
});

describe("what a Lead's assignment records (E3)", () => {
  it("names its rule, so it is told apart from E1's automatic ones", () => {
    expect(LEAD_ASSIGNMENT_RULE).toBe("LEAD");
  });

  it("refuses anyone else in the story's words", () => {
    expect(ASSIGNMENT_NOT_ACTIVE_COORDINATOR).toBe("Only an active Event Coordinator can be assigned.");
  });
});

/**
 * E2 — reassignment proposals. Permitted statuses, and refusing a proposal
 * to the coordinator already assigned.
 */
describe("canProposeReassignment (E2)", () => {
  it("permits reassignment while the event is still under review or later", () => {
    expect(canProposeReassignment("SUBMITTED")).toBe(true);
    expect(canProposeReassignment("UNDER_REVIEW")).toBe(true);
    expect(canProposeReassignment("AWAITING_CLARIFICATION")).toBe(true);
    expect(canProposeReassignment("APPROVED")).toBe(true);
    expect(canProposeReassignment("PLANNING")).toBe(true);
    expect(canProposeReassignment("CONFIRMED")).toBe(true);
  });

  it("refuses reassignment once the event has left the review workflow", () => {
    expect(canProposeReassignment("COMPLETED")).toBe(false);
    expect(canProposeReassignment("CANCELLED")).toBe(false);
    expect(canProposeReassignment("REJECTED")).toBe(false);
  });
});

describe("isSelfNomination (E2)", () => {
  it("is true when the nominee is already the assigned coordinator", () => {
    expect(isSelfNomination("coordinator-a", "coordinator-a")).toBe(true);
  });

  it("is false when the nominee is someone else", () => {
    expect(isSelfNomination("coordinator-a", "coordinator-b")).toBe(false);
  });
});
