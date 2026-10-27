import { describe, expect, it } from "vitest";
import { EVENT_STATUSES } from "@connectsphere/contracts";
import {
  ASSIGNMENT_NOT_ACTIVE_COORDINATOR,
  canAssign,
  LEAD_ASSIGNMENT_RULE,
  REASSIGNMENT_RETIRED,
} from "../../../src/modules/event/domain/assignment.js";

/**
 * E3, E4 — the Lead assigns and reassigns a submitted request. A draft has not been submitted, and
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

describe("E2's proposals, retired by E4 (W9-FX-5)", () => {
  it("are refused, pointing to the Lead", () => {
    expect(REASSIGNMENT_RETIRED).toBe("Coordinators no longer propose reassignments: the Event Coordinator Lead reassigns events.");
  });
});
