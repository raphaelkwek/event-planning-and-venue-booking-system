import { describe, expect, it } from "vitest";
import { EVENT_STATUSES, EVENT_STATUS_LABELS } from "@connectsphere/contracts";

/** F1 AC1 — the permitted statuses, compared with the story's own words. */
describe("the permitted statuses (F1)", () => {
  it("are exactly the eleven the story names", () => {
    expect(EVENT_STATUSES.map((status) => EVENT_STATUS_LABELS[status])).toEqual([
      "Draft",
      "Submitted",
      "Under Review",
      "Awaiting Clarification",
      "Approved",
      "Planning",
      "Safety Review",
      "Confirmed",
      "Completed",
      "Cancelled",
      "Rejected",
    ]);
  });
});
