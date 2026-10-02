import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { testDb } from "../support/testDb.js";
import { insertDraft, type DraftFields } from "../../src/modules/event/repo/drafts.js";
import { findEventForPlanning } from "../../src/modules/event/index.js";

/**
 * The event module's public read (ADR-0004): how K1, J1's prefill and O1 read
 * an event's timing, attendance and requirements without touching the event
 * schema. It keeps the A3 scope rule.
 */

const sql = testDb();

const OWNER = "a9999999-0000-0000-0000-000000000001";
const OTHER_ORGANISER = "a9999999-0000-0000-0000-000000000002";

const fields: DraftFields = {
  name: "Planning view fixture",
  purpose: "Read through the public interface",
  description: "Internal description another module must not see.",
  proposedStartAt: "2026-11-02T14:00:00.000Z",
  proposedEndAt: "2026-11-02T18:00:00.000Z",
  expectedAttendance: 120,
  venueRequirements: { layout: "THEATRE", facilities: ["PROJECTOR"] },
  accessibilityNeeds: "Step-free access",
  equipmentRequired: true,
  equipmentRequirements: [{ equipmentType: "MICROPHONE", quantity: 2 }],
  registrationRequired: false,
  registrationOpensAt: null,
  registrationClosesAt: null,
};

beforeEach(async () => {
  await sql`delete from event.events where owner_id in (${OWNER}, ${OTHER_ORGANISER})`;
});

afterAll(async () => {
  await sql`delete from event.events where owner_id in (${OWNER}, ${OTHER_ORGANISER})`;
  await sql.end();
});

describe("findEventForPlanning", () => {
  it("returns the event's timing, attendance and requirements, and nothing else", async () => {
    const draft = await insertDraft(sql, OWNER, fields);

    const view = await findEventForPlanning(sql, draft.id, { scopeType: "OWNED_BY_USER", userId: OWNER }, OWNER);

    expect(view).toEqual({
      id: draft.id,
      reference: null,
      status: "DRAFT",
      ownerId: OWNER,
      assignedCoordinatorId: null,
      proposedStartAt: "2026-11-02T14:00:00.000Z",
      proposedEndAt: "2026-11-02T18:00:00.000Z",
      expectedAttendance: 120,
      venueRequirements: { layout: "THEATRE", facilities: ["PROJECTOR"] },
      accessibilityNeeds: "Step-free access",
      equipmentRequired: true,
      equipmentRequirements: [{ equipmentType: "MICROPHONE", quantity: 2 }],
    });
  });

  it("returns null for an event outside the caller's scope (A3), revealing nothing", async () => {
    const draft = await insertDraft(sql, OWNER, fields);

    const view = await findEventForPlanning(
      sql,
      draft.id,
      { scopeType: "OWNED_BY_USER", userId: OTHER_ORGANISER },
      OTHER_ORGANISER
    );

    expect(view).toBeNull();
  });

  it("returns null for an event that does not exist", async () => {
    const view = await findEventForPlanning(sql, "a9999999-0000-0000-0000-0000000000ff", { scopeType: "ALL" }, OWNER);

    expect(view).toBeNull();
  });
});
