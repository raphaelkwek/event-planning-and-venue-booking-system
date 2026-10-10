import { describe, expect, it } from "vitest";
import {
  EQUIPMENT_KINDS,
  EQUIPMENT_LINE_HISTORY_ACTIONS,
  EQUIPMENT_REQUEST_LINE_STATUSES,
  EQUIPMENT_RESERVATION_STATUSES,
  EQUIPMENT_UNAVAILABILITY_STATUSES,
} from "@connectsphere/contracts";
import { checkedValues, readMigration } from "../support/checkConstraints.js";
import { UNIT_OVERLAP_CONSTRAINT } from "../../src/modules/equipment/domain/availability.js";

/** The equipment migration's check constraints list exactly what contracts lists (implementation.md §4.1). */

const migration = readMigration("migrations/equipment/0001_equipment_inventory.sql");

describe("equipment migration 0001 and contracts", () => {
  it("allows exactly the equipment kinds contracts lists", () => {
    expect(checkedValues(migration, "kind", "create table equipment.equipment_types")).toEqual([...EQUIPMENT_KINDS]);
  });

  it("allows exactly the reservation statuses contracts lists, for units and bulk stock alike", () => {
    expect(checkedValues(migration, "status", "create table equipment.unit_reservations")).toEqual([
      ...EQUIPMENT_RESERVATION_STATUSES,
    ]);
    expect(checkedValues(migration, "status", "create table equipment.bulk_reservations")).toEqual([
      ...EQUIPMENT_RESERVATION_STATUSES,
    ]);
  });

  it("allows exactly the unavailability statuses contracts lists", () => {
    expect(checkedValues(migration, "status", "create table equipment.unavailability")).toEqual([
      ...EQUIPMENT_UNAVAILABILITY_STATUSES,
    ]);
  });

  it("creates the exclusion constraint the domain code recognises by name", () => {
    expect(migration).toContain(`constraint ${UNIT_OVERLAP_CONSTRAINT}`);
  });
});

/** O1/O2: the request line migration lists exactly the statuses and history actions contracts lists. */
const lineMigration = readMigration("migrations/equipment/0003_equipment_request_lines.sql");

describe("equipment migration 0003 and contracts", () => {
  it("allows exactly the request line statuses contracts lists", () => {
    expect(checkedValues(lineMigration, "status", "create table equipment.equipment_request_lines")).toEqual([
      ...EQUIPMENT_REQUEST_LINE_STATUSES,
    ]);
  });

  it("allows exactly the history actions contracts lists", () => {
    expect(checkedValues(lineMigration, "action", "create table equipment.request_line_history")).toEqual([
      ...EQUIPMENT_LINE_HISTORY_ACTIONS,
    ]);
  });

  it("never deletes (implementation.md section 4.3)", () => {
    expect(lineMigration.toLowerCase()).not.toMatch(/delete\s+from/);
  });
});
