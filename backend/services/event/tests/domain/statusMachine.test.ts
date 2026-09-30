import { describe, expect, it } from "vitest";
import { EVENT_STATUSES, type EventStatus } from "@connectsphere/contracts";
import {
  COMPLETION_NOT_DUE_MESSAGE,
  evaluateTransition,
  QUEUE_STATUSES,
  refusalMessage,
  transitionRule,
  type EventAction,
} from "../../src/domain/statusMachine.js";

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
const PERMITTED_FROM: Record<EventAction, EventStatus[]> = {
  SUBMIT: ["DRAFT"],
  OPEN_FOR_REVIEW: ["SUBMITTED"],
  REQUEST_CLARIFICATION: ["UNDER_REVIEW"],
  RESPOND_TO_CLARIFICATION: ["AWAITING_CLARIFICATION"],
  APPROVE: ["UNDER_REVIEW", "AWAITING_CLARIFICATION"],
  REJECT: ["UNDER_REVIEW", "AWAITING_CLARIFICATION"],
  CONFIRM: ["APPROVED", "PLANNING"],
  COMPLETE: ["CONFIRMED"],
};

describe("every status against every action (F1)", () => {
  for (const [action, from] of Object.entries(PERMITTED_FROM) as [EventAction, EventStatus[]][]) {
    for (const status of EVENT_STATUSES) {
      const permitted = from.includes(status);
      it(`${permitted ? "permits" : "refuses"} ${action} from ${status}`, () => {
        expect(evaluateTransition(status, action).permitted).toBe(permitted);
      });
    }
  }
});

describe("CONFIRM and COMPLETE (F1)", () => {
  it("reaches Confirmed from Approved or Planning (F1, performed by F5)", () => {
    expect(transitionRule("CONFIRM")).toEqual({ from: ["APPROVED", "PLANNING"], to: "CONFIRMED" });
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

  it("name both statuses when completion is refused as not yet due", () => {
    expect(COMPLETION_NOT_DUE_MESSAGE).toBe(
      "This event is Confirmed and cannot move to Completed until its end date and time have passed."
    );
  });
});
