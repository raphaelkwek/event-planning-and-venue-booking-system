import { describe, expect, it } from "vitest";
import {
  UNAVAILABILITY_BLOCK_STATUSES,
  UNAVAILABILITY_REASON_TYPES,
  VENUE_SLOT_STATUSES,
} from "@connectsphere/contracts";
import { checkedValues, readMigration } from "../support/checkConstraints.js";
import { SLOT_OVERLAP_CONSTRAINT } from "../../src/modules/venue/domain/slotConflict.js";

/** The venue migration's check constraints list exactly what contracts lists (implementation.md §4.1). */

const migration = readMigration("migrations/venue/0003_venue_slots_and_unavailability.sql");

describe("venue migration 0003 and contracts", () => {
  it("allows exactly the venue slot statuses contracts lists", () => {
    expect(checkedValues(migration, "status", "create table venue.venue_slots")).toEqual([...VENUE_SLOT_STATUSES]);
  });

  it("allows exactly the unavailability reason types contracts lists", () => {
    expect(checkedValues(migration, "reason_type", "create table venue.unavailability_blocks")).toEqual([
      ...UNAVAILABILITY_REASON_TYPES,
    ]);
  });

  it("allows exactly the unavailability block statuses contracts lists", () => {
    expect(checkedValues(migration, "status", "create table venue.unavailability_blocks")).toEqual([
      ...UNAVAILABILITY_BLOCK_STATUSES,
    ]);
  });

  it("creates the exclusion constraint the domain code recognises by name", () => {
    expect(migration).toContain(`constraint ${SLOT_OVERLAP_CONSTRAINT}`);
  });
});
