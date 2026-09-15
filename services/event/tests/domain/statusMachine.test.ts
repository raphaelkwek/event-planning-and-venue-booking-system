import { describe, expect, it } from "vitest";
import { evaluateTransition, QUEUE_STATUSES } from "../../src/domain/statusMachine.js";

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
