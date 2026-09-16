import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { testDb } from "../support/testDb.js";
import {
  claimForReview,
  findEventInScope,
  insertSubmittedEvent,
  listReviewQueue,
  recordDecision,
  type EventFields,
} from "../../src/repo/events.js";
import { QUEUE_STATUSES } from "../../src/domain/statusMachine.js";

const sql = testDb();

const OWNER = "a2222222-0000-0000-0000-000000000001";
const OTHER_ORGANISER = "a2222222-0000-0000-0000-000000000002";
const COORDINATOR = "a2222222-0000-0000-0000-000000000003";
const OTHER_COORDINATOR = "a2222222-0000-0000-0000-000000000004";

const OWNERS = [OWNER, OTHER_ORGANISER];

const fields: EventFields = {
  name: "Annual Research Symposium",
  purpose: "Share faculty research",
  description: "A one-day symposium.",
  proposedStartAt: "2026-10-02T14:00:00.000Z",
  proposedEndAt: "2026-10-02T18:00:00.000Z",
  expectedAttendance: 150,
  venueRequirements: { layout: "THEATRE" },
  accessibilityNeeds: null,
  equipmentRequired: false,
  equipmentRequirements: null,
  registrationRequired: false,
  registrationOpensAt: null,
  registrationClosesAt: null,
};

async function cleanUp() {
  await sql`delete from event.status_history where event_id in (
    select id from event.events where owner_id in ${sql(OWNERS)}
  )`;
  await sql`delete from event.assignments where event_id in (
    select id from event.events where owner_id in ${sql(OWNERS)}
  )`;
  await sql`delete from event.outbox where envelope->'payload'->>'ownerId' in ${sql(OWNERS)}`;
  await sql`delete from event.events where owner_id in ${sql(OWNERS)}`;
}

/** Inserts a submitted event outside any wider workflow, for tests that need one. */
async function givenSubmittedEvent(ownerId = OWNER, overrides: Partial<EventFields> = {}) {
  return sql.begin((tx) => insertSubmittedEvent(tx, ownerId, { ...fields, ...overrides }));
}

beforeEach(cleanUp);

afterAll(async () => {
  await cleanUp();
  await sql.end();
});

describe("events repo (B1)", () => {
  it("stores a submitted request with the submitting organiser as owner", async () => {
    const event = await givenSubmittedEvent();

    expect(event.ownerId).toBe(OWNER);
    expect(event.status).toBe("SUBMITTED");
  });

  it("records a submission timestamp and a unique event reference", async () => {
    const first = await givenSubmittedEvent();
    const second = await givenSubmittedEvent();

    expect(Date.parse(first.submittedAt)).not.toBeNaN();
    expect(first.reference).toMatch(/^EVT-\d{6}$/);
    expect(second.reference).not.toBe(first.reference);
  });

  it("starts an event with no recorded decision", async () => {
    const event = await givenSubmittedEvent();

    expect(event.decidedAt).toBeNull();
    expect(event.decidedBy).toBeNull();
  });
});

describe("events repo — access scope (A3)", () => {
  it("gives an organiser their own event", async () => {
    const event = await givenSubmittedEvent(OWNER);

    const found = await findEventInScope(sql, event.id, { scopeType: "OWNED_BY_USER", userId: OWNER }, OWNER);

    expect(found!.id).toBe(event.id);
  });

  it("gives an organiser no data at all for another organiser's event", async () => {
    const event = await givenSubmittedEvent(OTHER_ORGANISER);

    const found = await findEventInScope(
      sql,
      event.id,
      { scopeType: "OWNED_BY_USER", userId: OWNER },
      OWNER
    );

    expect(found).toBeNull();
  });

  it("gives a coordinator every event, whoever owns it", async () => {
    const event = await givenSubmittedEvent(OTHER_ORGANISER);

    const found = await findEventInScope(sql, event.id, { scopeType: "ALL" }, COORDINATOR);

    expect(found!.id).toBe(event.id);
  });

  it("gives a role with no events scope nothing", async () => {
    const event = await givenSubmittedEvent(OWNER);

    const found = await findEventInScope(sql, event.id, { scopeType: "NONE" }, COORDINATOR);

    expect(found).toBeNull();
  });
});

describe("events repo — review queue (D1)", () => {
  it("orders the queue by submission timestamp, oldest first", async () => {
    const first = await givenSubmittedEvent(OWNER, { name: "First in" });
    const second = await givenSubmittedEvent(OWNER, { name: "Second in" });

    const queue = await listReviewQueue(sql, QUEUE_STATUSES);
    const mine = queue.filter((row) => [first.id, second.id].includes(row.id));

    expect(mine.map((row) => row.id)).toEqual([first.id, second.id]);
  });

  it("drops an event from the queue once it carries a decision", async () => {
    const event = await givenSubmittedEvent();
    await sql.begin(async (tx) => {
      await claimForReview(tx, event.id, COORDINATOR);
      await recordDecision(tx, event.id, "APPROVED", COORDINATOR, null);
    });

    const queue = await listReviewQueue(sql, QUEUE_STATUSES);

    expect(queue.map((row) => row.id)).not.toContain(event.id);
  });

  it("moves a submitted event to under review, recording the reviewer and the time", async () => {
    const event = await givenSubmittedEvent();

    const claimed = await sql.begin((tx) => claimForReview(tx, event.id, COORDINATOR));

    expect(claimed).toMatchObject({ status: "UNDER_REVIEW", reviewingCoordinatorId: COORDINATOR });
    expect(Date.parse(claimed!.reviewStartedAt!)).not.toBeNaN();
  });

  it("does not overwrite the reviewer when a second coordinator opens the same request", async () => {
    const event = await givenSubmittedEvent();
    await sql.begin((tx) => claimForReview(tx, event.id, COORDINATOR));

    const secondClaim = await sql.begin((tx) => claimForReview(tx, event.id, OTHER_COORDINATOR));

    expect(secondClaim).toBeNull();
    const current = await findEventInScope(sql, event.id, { scopeType: "ALL" }, OTHER_COORDINATOR);
    expect(current!.reviewingCoordinatorId).toBe(COORDINATOR);
  });
});

describe("events repo — decisions (D4, D5)", () => {
  it("records an approval with the approving coordinator and the timestamp", async () => {
    const event = await givenSubmittedEvent();
    await sql.begin((tx) => claimForReview(tx, event.id, COORDINATOR));

    const decided = await sql.begin((tx) => recordDecision(tx, event.id, "APPROVED", COORDINATOR, null));

    expect(decided).toMatchObject({ status: "APPROVED", decidedBy: COORDINATOR });
    expect(Date.parse(decided!.decidedAt!)).not.toBeNaN();
  });

  it("records a rejection with its reason", async () => {
    const event = await givenSubmittedEvent();
    await sql.begin((tx) => claimForReview(tx, event.id, COORDINATOR));

    const decided = await sql.begin((tx) =>
      recordDecision(tx, event.id, "REJECTED", COORDINATOR, "No venue can host this date.")
    );

    expect(decided).toMatchObject({
      status: "REJECTED",
      rejectionReason: "No venue can host this date.",
    });
  });

  it("writes no second decision timestamp for an event already decided", async () => {
    const event = await givenSubmittedEvent();
    await sql.begin(async (tx) => {
      await claimForReview(tx, event.id, COORDINATOR);
      await recordDecision(tx, event.id, "APPROVED", COORDINATOR, null);
    });
    const afterFirst = await findEventInScope(sql, event.id, { scopeType: "ALL" }, COORDINATOR);

    const secondDecision = await sql.begin((tx) =>
      recordDecision(tx, event.id, "REJECTED", OTHER_COORDINATOR, "Changed my mind")
    );

    expect(secondDecision).toBeNull();
    const unchanged = await findEventInScope(sql, event.id, { scopeType: "ALL" }, COORDINATOR);
    expect(unchanged).toMatchObject({
      status: "APPROVED",
      decidedBy: COORDINATOR,
      decidedAt: afterFirst!.decidedAt,
    });
  });
});
