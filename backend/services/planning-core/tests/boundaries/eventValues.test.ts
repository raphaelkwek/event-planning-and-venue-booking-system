import { describe, expect, it } from "vitest";
import { EVENT_STATUSES } from "@connectsphere/contracts";
import { checkedValues, readMigration } from "../support/checkConstraints.js";

/** The event status check lists exactly what contracts lists (implementation.md §4.1). */

const migration = readMigration("migrations/event/0007_add_safety_review_status.sql");

describe("event migration 0007 and contracts", () => {
  it("allows exactly the event statuses contracts lists", () => {
    expect(checkedValues(migration, "status", "add constraint events_status_check")).toEqual([
      ...EVENT_STATUSES,
    ]);
  });
});
