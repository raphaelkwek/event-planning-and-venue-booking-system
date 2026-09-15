import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { testDb } from "../support/testDb.js";
import {
  findDraftForOwner,
  insertDraft,
  listDraftsForOwner,
  updateDraft,
  type DraftFields,
} from "../../src/repo/drafts.js";

/** C1, C2, C3 — drafts are owner-private and never deleted. */

const sql = testDb();

const OWNER = "a1111111-0000-0000-0000-000000000001";
const OTHER_ORGANISER = "a1111111-0000-0000-0000-000000000002";

const emptyFields: DraftFields = {
  name: "Untitled idea",
  purpose: null,
  description: null,
  proposedStartAt: null,
  proposedEndAt: null,
  expectedAttendance: null,
  venueRequirements: null,
  accessibilityNeeds: null,
  equipmentRequired: null,
  equipmentRequirements: null,
  registrationRequired: null,
  registrationOpensAt: null,
  registrationClosesAt: null,
};

const fullFields: DraftFields = {
  name: "Annual Research Symposium",
  purpose: "Share faculty research",
  description: "A one-day symposium.",
  proposedStartAt: "2026-10-02T14:00:00.000Z",
  proposedEndAt: "2026-10-02T18:00:00.000Z",
  expectedAttendance: 150,
  venueRequirements: { layout: "THEATRE", facilities: ["PROJECTOR"] },
  accessibilityNeeds: "Step-free access to the stage",
  equipmentRequired: true,
  equipmentRequirements: [{ equipmentType: "MICROPHONE", quantity: 4 }],
  registrationRequired: true,
  registrationOpensAt: "2026-09-20T09:00:00.000Z",
  registrationClosesAt: "2026-10-01T17:00:00.000Z",
};

beforeEach(async () => {
  await sql`delete from event.events where owner_id in (${OWNER}, ${OTHER_ORGANISER})`;
});

afterAll(async () => {
  await sql`delete from event.events where owner_id in (${OWNER}, ${OTHER_ORGANISER})`;
  await sql.end();
});

describe("drafts repo (C1)", () => {
  it("saves a draft with only a name, every other field empty", async () => {
    const draft = await insertDraft(sql, OWNER, emptyFields);

    expect(draft.name).toBe("Untitled idea");
    expect(draft.purpose).toBeNull();
    expect(draft.expectedAttendance).toBeNull();
  });

  it("records the owning organiser and a last-saved timestamp", async () => {
    const draft = await insertDraft(sql, OWNER, emptyFields);

    expect(draft.ownerId).toBe(OWNER);
    expect(Date.parse(draft.lastSavedAt)).not.toBeNaN();
  });

  it("stores the draft at status Draft, with no reference and no submission time", async () => {
    const draft = await insertDraft(sql, OWNER, emptyFields);

    expect(draft.status).toBe("DRAFT");
    expect(draft.reference).toBeNull();
    expect(draft.submittedAt).toBeNull();
  });

  it("does not find a submitted request through the draft queries", async () => {
    const draft = await insertDraft(sql, OWNER, emptyFields);
    await sql`update event.events set status = 'SUBMITTED', reference = 'EVT-999999',
              submitted_at = now() where id = ${draft.id}`;

    expect(await findDraftForOwner(sql, draft.id, OWNER)).toBeNull();
    expect(await listDraftsForOwner(sql, OWNER)).toEqual([]);
  });
});

describe("drafts repo (C2)", () => {
  it("restores every saved field with the exact value that was saved", async () => {
    const saved = await insertDraft(sql, OWNER, fullFields);
    const reopened = await findDraftForOwner(sql, saved.id, OWNER);

    expect(reopened).toMatchObject({
      name: fullFields.name,
      purpose: fullFields.purpose,
      description: fullFields.description,
      proposedStartAt: fullFields.proposedStartAt,
      proposedEndAt: fullFields.proposedEndAt,
      expectedAttendance: fullFields.expectedAttendance,
      accessibilityNeeds: fullFields.accessibilityNeeds,
      registrationRequired: true,
      registrationOpensAt: fullFields.registrationOpensAt,
      registrationClosesAt: fullFields.registrationClosesAt,
    });
    expect(reopened!.venueRequirements).toEqual(fullFields.venueRequirements);
    expect(reopened!.equipmentRequirements).toEqual(fullFields.equipmentRequirements);
  });

  it("updates the last-saved timestamp when an edited draft is saved", async () => {
    const saved = await insertDraft(sql, OWNER, emptyFields);
    const updated = await updateDraft(sql, saved.id, OWNER, { ...emptyFields, purpose: "Now decided" });

    expect(updated!.purpose).toBe("Now decided");
    expect(Date.parse(updated!.lastSavedAt)).toBeGreaterThanOrEqual(Date.parse(saved.lastSavedAt));
  });

  it("gives a user who is not the owner no draft content at all", async () => {
    const saved = await insertDraft(sql, OWNER, fullFields);

    expect(await findDraftForOwner(sql, saved.id, OTHER_ORGANISER)).toBeNull();
  });

  it("refuses an edit by a user who is not the owner", async () => {
    const saved = await insertDraft(sql, OWNER, emptyFields);

    const result = await updateDraft(sql, saved.id, OTHER_ORGANISER, {
      ...emptyFields,
      name: "Hijacked",
    });

    expect(result).toBeNull();
    const untouched = await findDraftForOwner(sql, saved.id, OWNER);
    expect(untouched!.name).toBe("Untitled idea");
  });
});

describe("drafts repo (C3)", () => {
  it("lists only the signed-in organiser's own drafts", async () => {
    await insertDraft(sql, OWNER, { ...emptyFields, name: "Mine" });
    await insertDraft(sql, OTHER_ORGANISER, { ...emptyFields, name: "Theirs" });

    const mine = await listDraftsForOwner(sql, OWNER);

    expect(mine.map((draft) => draft.name)).toEqual(["Mine"]);
  });
});
