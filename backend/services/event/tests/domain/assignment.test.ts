import { describe, expect, it } from "vitest";
import {
  allocateCoordinator,
  ASSIGNMENT_RULE,
  canProposeReassignment,
  isSelfNomination,
} from "../../src/domain/assignment.js";

/**
 * E1 — automatic coordinator assignment. The allocation rule is applied
 * consistently to every event and is recorded with the assignment, so any
 * given outcome can be explained.
 */
const POOL = ["coordinator-a", "coordinator-b", "coordinator-c"];

describe("allocateCoordinator (E1)", () => {
  it("assigns the first coordinator when the cursor starts at zero", () => {
    expect(allocateCoordinator(POOL, 0)).toMatchObject({ coordinatorId: "coordinator-a" });
  });

  it("assigns each coordinator in turn as the cursor advances", () => {
    const first = allocateCoordinator(POOL, 0)!;
    const second = allocateCoordinator(POOL, first.nextCursor)!;
    const third = allocateCoordinator(POOL, second.nextCursor)!;

    expect([first.coordinatorId, second.coordinatorId, third.coordinatorId]).toEqual([
      "coordinator-a",
      "coordinator-b",
      "coordinator-c",
    ]);
  });

  it("wraps back to the first coordinator after the last", () => {
    const third = allocateCoordinator(POOL, 2)!;
    const fourth = allocateCoordinator(POOL, third.nextCursor)!;

    expect(fourth.coordinatorId).toBe("coordinator-a");
  });

  it("records the allocation rule that produced the assignment", () => {
    expect(allocateCoordinator(POOL, 0)!.assignmentRule).toBe(ASSIGNMENT_RULE);
  });

  it("assigns exactly one coordinator, never a list", () => {
    const allocation = allocateCoordinator(POOL, 0)!;
    expect(typeof allocation.coordinatorId).toBe("string");
  });

  it("returns nothing when no eligible coordinator exists, so the event can still be submitted", () => {
    expect(allocateCoordinator([], 0)).toBeNull();
  });

  it("stays inside the pool when the stored cursor is beyond its end", () => {
    expect(allocateCoordinator(POOL, 99)!.coordinatorId).toBe("coordinator-a");
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
