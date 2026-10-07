import { describe, expect, it } from "vitest";
import { EVENT_STATUSES, type EventStatus } from "@connectsphere/contracts";
import {
  COMPLETION_NOT_DUE_MESSAGE,
  evaluateTransition,
  QUEUE_STATUSES,
  refusalMessage,
  transitionRule,
  type EventAction,
} from "../../../src/modules/event/domain/statusMachine.js";

/**
 * F1 — status changes only through a defined action, and a transition that is
 * not permitted from the current status is refused naming both statuses.
 */
describe("evaluateTransition (F1)", () => {
  it("permits a submitted event to be opened for review (D1)", () => {
    const result = evaluateTransition("SUBMITTED", "OPEN_FOR_REVIEW");
    expect(result).toMatchObject({ permitted: true, from: "SUBMITTED", to: "UNDER_REVIEW" });
  });

  it("permits clarification to be requested while under review (D2)", () => {
    expect(evaluateTransition("UNDER_REVIEW", "REQUEST_CLARIFICATION")).toMatchObject({
      permitted: true,
      to: "AWAITING_CLARIFICATION",
    });
  });

  it("returns an event awaiting clarification to under review on response (D3)", () => {
    expect(evaluateTransition("AWAITING_CLARIFICATION", "RESPOND_TO_CLARIFICATION")).toMatchObject({
      permitted: true,
      to: "UNDER_REVIEW",
    });
  });

  it("permits approval from under review (D4)", () => {
    expect(evaluateTransition("UNDER_REVIEW", "APPROVE")).toMatchObject({
      permitted: true,
      to: "APPROVED",
    });
  });

  it("permits approval from awaiting clarification (D4)", () => {
    expect(evaluateTransition("AWAITING_CLARIFICATION", "APPROVE")).toMatchObject({
      permitted: true,
      to: "APPROVED",
    });
  });

  it("permits rejection from under review (D5)", () => {
    expect(evaluateTransition("UNDER_REVIEW", "REJECT")).toMatchObject({
      permitted: true,
      to: "REJECTED",
    });
  });

  it("permits rejection from awaiting clarification (D5)", () => {
    expect(evaluateTransition("AWAITING_CLARIFICATION", "REJECT")).toMatchObject({
      permitted: true,
      to: "REJECTED",
    });
  });

  it("refuses approving a submitted event that nobody has opened for review (D4)", () => {
    const result = evaluateTransition("SUBMITTED", "APPROVE");
    expect(result.permitted).toBe(false);
  });

  it("names the current status and the attempted target when it refuses", () => {
    const result = evaluateTransition("REJECTED", "APPROVE");

    expect(result.permitted).toBe(false);
    if (result.permitted) throw new Error("expected a refusal");
    expect(result.message).toContain("Rejected");
    expect(result.message).toContain("Approved");
  });

  it("refuses approving an event that was already approved (D4)", () => {
    expect(evaluateTransition("APPROVED", "APPROVE").permitted).toBe(false);
  });

  it("refuses rejecting an event that was already rejected (D5)", () => {
    expect(evaluateTransition("REJECTED", "REJECT").permitted).toBe(false);
  });

  it("refuses requesting clarification on an event awaiting clarification already", () => {
    expect(evaluateTransition("AWAITING_CLARIFICATION", "REQUEST_CLARIFICATION").permitted).toBe(false);
  });

  it("refuses responding to a clarification on an event that is under review", () => {
    expect(evaluateTransition("UNDER_REVIEW", "RESPOND_TO_CLARIFICATION").permitted).toBe(false);
  });

  it("refuses opening a cancelled event for review", () => {
    expect(evaluateTransition("CANCELLED", "OPEN_FOR_REVIEW").permitted).toBe(false);
  });
});

describe("QUEUE_STATUSES (D1)", () => {
  it("is exactly the statuses that await a decision", () => {
    expect([...QUEUE_STATUSES]).toEqual(["SUBMITTED", "UNDER_REVIEW", "AWAITING_CLARIFICATION"]);
  });

  it("does not include Draft, which never appears in the queue", () => {
    expect(QUEUE_STATUSES).not.toContain("DRAFT");
  });
});

/**
 * Written out independently of the table under test, so these tests compare
 * the table with the stories rather than reading the table back to itself.
 */
const EXPECTED: Record<EventAction, { from: EventStatus[]; to: EventStatus }> = {
  SUBMIT: { from: ["DRAFT"], to: "SUBMITTED" },
  OPEN_FOR_REVIEW: { from: ["SUBMITTED"], to: "UNDER_REVIEW" },
  REQUEST_CLARIFICATION: { from: ["UNDER_REVIEW"], to: "AWAITING_CLARIFICATION" },
  RESPOND_TO_CLARIFICATION: { from: ["AWAITING_CLARIFICATION"], to: "UNDER_REVIEW" },
  APPROVE: { from: ["UNDER_REVIEW", "AWAITING_CLARIFICATION"], to: "APPROVED" },
  REJECT: { from: ["UNDER_REVIEW", "AWAITING_CLARIFICATION"], to: "REJECTED" },
  CONFIRM_ARRANGEMENTS: { from: ["APPROVED", "PLANNING"], to: "SAFETY_REVIEW" },
  APPROVE_SAFETY: { from: ["SAFETY_REVIEW"], to: "CONFIRMED" },
  REQUEST_SAFETY_CHANGES: { from: ["SAFETY_REVIEW"], to: "PLANNING" },
  COMPLETE: { from: ["CONFIRMED"], to: "COMPLETED" },
};

describe("every status against every action (F1)", () => {
  for (const [action, { from, to }] of Object.entries(EXPECTED) as [
    EventAction,
    { from: EventStatus[]; to: EventStatus },
  ][]) {
    for (const status of EVENT_STATUSES) {
      const permitted = from.includes(status);
      it(`${permitted ? "permits" : "refuses"} ${action} from ${status}`, () => {
        if (permitted) {
          expect(evaluateTransition(status, action)).toMatchObject({ permitted: true, to });
        } else {
          expect(evaluateTransition(status, action).permitted).toBe(false);
        }
      });
    }
  }
});

describe("Safety Review, Confirmed and Completed (F1, CR-06)", () => {
  const actions = Object.keys(EXPECTED) as EventAction[];

  it("reaches Safety Review only when F5 confirms the arrangements", () => {
    expect(actions.filter((action) => transitionRule(action).to === "SAFETY_REVIEW")).toEqual([
      "CONFIRM_ARRANGEMENTS",
    ]);
  });

  it("leaves Safety Review only through the Safety Officer's decisions", () => {
    expect(actions.filter((action) => transitionRule(action).from.includes("SAFETY_REVIEW"))).toEqual([
      "APPROVE_SAFETY",
      "REQUEST_SAFETY_CHANGES",
    ]);
  });

  it("reaches Confirmed only through the Safety Officer's approval", () => {
    expect(actions.filter((action) => transitionRule(action).to === "CONFIRMED")).toEqual([
      "APPROVE_SAFETY",
    ]);
  });

  it("has no transition for rejecting the safety arrangement until CQ-08 is answered", () => {
    expect(
      actions.filter(
        (action) =>
          transitionRule(action).from.includes("SAFETY_REVIEW") && transitionRule(action).to === "REJECTED"
      )
    ).toEqual([]);
  });

  it("completes only a Confirmed event", () => {
    expect(transitionRule("COMPLETE")).toEqual({ from: ["CONFIRMED"], to: "COMPLETED" });
  });

  it("refuses completing an Approved event, which was never confirmed", () => {
    const result = evaluateTransition("APPROVED", "COMPLETE");

    expect(result.permitted).toBe(false);
    if (result.permitted) throw new Error("expected a refusal");
    expect(result.message).toBe("This event is Approved and cannot move to Completed.");
  });
});

describe("refusal messages (F1)", () => {
  it("name the current status and the target as the user reads them", () => {
    expect(refusalMessage("REJECTED", "APPROVED")).toBe(
      "This event is Rejected and cannot move to Approved."
    );
  });

  it("use the story's wording for a completion that is not yet due", () => {
    expect(COMPLETION_NOT_DUE_MESSAGE).toBe(
      "This event is Confirmed and cannot move to Completed until its end date and time have passed."
    );
  });
});
