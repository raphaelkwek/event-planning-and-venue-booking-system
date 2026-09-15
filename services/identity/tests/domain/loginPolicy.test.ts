import { describe, expect, it } from "vitest";
import { decideLoginOutcome } from "../../src/domain/loginPolicy.js";

describe("decideLoginOutcome", () => {
  it("returns SUCCESS for an active user", () => {
    const outcome = decideLoginOutcome({ id: "user-1", isActive: true });
    expect(outcome).toEqual({ decision: "SUCCESS", userId: "user-1" });
  });

  it("returns DEACTIVATED_ACCOUNT for an inactive user, distinguishable from bad credentials", () => {
    const outcome = decideLoginOutcome({ id: "user-2", isActive: false });
    expect(outcome).toEqual({ decision: "DEACTIVATED_ACCOUNT", userId: "user-2" });
  });

  it("returns INVALID_CREDENTIALS when there is no matching identity record", () => {
    const outcome = decideLoginOutcome(null);
    expect(outcome).toEqual({ decision: "INVALID_CREDENTIALS" });
  });

  it("never conflates the two failure decisions", () => {
    const deactivated = decideLoginOutcome({ id: "user-3", isActive: false });
    const missing = decideLoginOutcome(null);
    expect(deactivated.decision).not.toBe(missing.decision);
  });
});
