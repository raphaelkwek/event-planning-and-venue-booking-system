import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  UNAVAILABILITY_BLOCK_STATUSES,
  UNAVAILABILITY_REASON_TYPES,
  VENUE_SLOT_STATUSES,
} from "@connectsphere/contracts";

/**
 * implementation.md §4.1: permitted values are `text` plus a check constraint,
 * and the list itself lives in contracts. This keeps the venue migration's
 * check constraints and the contracts lists from drifting apart.
 */

const migration = readFileSync(
  new URL("../../migrations/venue/0003_venue_slots_and_unavailability.sql", import.meta.url),
  "utf8",
);

/** The quoted values in the first `check (<column> in (...))` for that column. */
function checkedValues(column: string, after: string): string[] {
  const start = migration.indexOf(after);
  const match = new RegExp(`check \\(${column} in \\(([^)]*)\\)\\)`).exec(migration.slice(start));
  if (start < 0 || !match) throw new Error(`no check constraint on ${column} after "${after}"`);
  return [...match[1]!.matchAll(/'([^']+)'/g)].map((m) => m[1]!);
}

describe("venue migration 0003 and contracts", () => {
  it("allows exactly the venue slot statuses contracts lists", () => {
    expect(checkedValues("status", "create table venue.venue_slots")).toEqual([...VENUE_SLOT_STATUSES]);
  });

  it("allows exactly the unavailability reason types contracts lists", () => {
    expect(checkedValues("reason_type", "create table venue.unavailability_blocks")).toEqual([
      ...UNAVAILABILITY_REASON_TYPES,
    ]);
  });

  it("allows exactly the unavailability block statuses contracts lists", () => {
    expect(checkedValues("status", "create table venue.unavailability_blocks")).toEqual([
      ...UNAVAILABILITY_BLOCK_STATUSES,
    ]);
  });
});
