import { describe, expect, it } from "vitest";
import { EVENT_STATUSES } from "@connectsphere/contracts";
import {
  DECISION_ACTIONS,
  DECISION_ALREADY_RECORDED_MESSAGE,
  SAFETY_CHECK_NOT_PASSED_MESSAGE,
  markConfirmedRefusal,
} from "../../../src/modules/event/domain/safetyDecision.js";
import { transitionRule } from "../../../src/modules/event/domain/statusMachine.js";

// U1 — what each decision does and when Mark Confirmed is allowed, without a database.

describe("DECISION_ACTIONS", () => {
  it("applies one F1 transition per decision", () => {
    expect(DECISION_ACTIONS).toEqual({
      APPROVE: "APPROVE_SAFETY",
      REQUEST_CHANGES: "REQUEST_SAFETY_CHANGES",
      REJECT: "REJECT_SAFETY_ARRANGEMENT",
    });
  });

  it("leaves an approved event in Safety Review and returns the other two to Planning (CQ-08)", () => {
    expect(transitionRule(DECISION_ACTIONS.APPROVE).to).toBe("SAFETY_REVIEW");
    expect(transitionRule(DECISION_ACTIONS.REQUEST_CHANGES).to).toBe("PLANNING");
    expect(transitionRule(DECISION_ACTIONS.REJECT).to).toBe("PLANNING");
  });
});

describe("markConfirmedRefusal (W9-31)", () => {
  it("allows an approved event in Safety Review", () => {
    expect(markConfirmedRefusal("SAFETY_REVIEW", true)).toBeNull();
  });

  it("refuses an event in Safety Review that has no approval", () => {
    expect(markConfirmedRefusal("SAFETY_REVIEW", false)).toBe("NOT_PASSED");
  });

  it("refuses every other status for its status, approved or not", () => {
    for (const status of EVENT_STATUSES.filter((s) => s !== "SAFETY_REVIEW")) {
      expect(markConfirmedRefusal(status, true)).toBe("STATUS");
      expect(markConfirmedRefusal(status, false)).toBe("STATUS");
    }
  });
});

describe("messages", () => {
  it("explains a second decision and an unpassed check", () => {
    expect(DECISION_ALREADY_RECORDED_MESSAGE).toMatch(/already been recorded/);
    expect(SAFETY_CHECK_NOT_PASSED_MESSAGE).toMatch(/has not approved/);
  });
});
