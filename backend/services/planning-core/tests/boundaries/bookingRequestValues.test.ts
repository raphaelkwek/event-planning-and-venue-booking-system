import { describe, expect, it } from "vitest";
import { BOOKING_REQUEST_STATUSES } from "@connectsphere/contracts";
import { checkedValues, readMigration } from "../support/checkConstraints.js";
import { DUPLICATE_REQUEST_CONSTRAINT } from "../../src/modules/venue/domain/bookingRequest.js";

/** L1's migration lists exactly what contracts lists (implementation.md §4.1). */

const migration = readMigration("migrations/venue/0005_booking_requests.sql");

describe("venue migration 0005 and contracts", () => {
  it("allows exactly the booking request statuses contracts lists", () => {
    expect(checkedValues(migration, "status", "create table venue.booking_requests")).toEqual([...BOOKING_REQUEST_STATUSES]);
  });

  it("creates the exclusion constraint the domain code recognises by name", () => {
    expect(migration).toContain(`constraint ${DUPLICATE_REQUEST_CONSTRAINT}`);
  });
});
