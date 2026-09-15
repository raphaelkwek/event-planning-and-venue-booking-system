import { describe, expect, it } from "vitest";
import { allocateCoordinator, ASSIGNMENT_RULE } from "../../src/domain/assignment.js";

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
