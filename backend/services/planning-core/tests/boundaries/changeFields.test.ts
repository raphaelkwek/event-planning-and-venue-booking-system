import { describe, expect, it } from "vitest";
import { SIGNIFICANT_EVENT_FIELDS } from "@connectsphere/contracts";
import { checkedValues, readMigration } from "../support/checkConstraints.js";

/** The change request field check lists exactly what contracts lists (implementation.md §4.1). */

const migration = readMigration("migrations/change/0001_change_requests.sql");

describe("change migration 0001 and contracts", () => {
  it("allows exactly the significant event fields contracts lists", () => {
    expect(checkedValues(migration, "field_name", "create table change.change_request_fields")).toEqual([
      ...SIGNIFICANT_EVENT_FIELDS,
    ]);
  });
});
