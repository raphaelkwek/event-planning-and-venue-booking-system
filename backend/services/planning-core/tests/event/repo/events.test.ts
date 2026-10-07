import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { testDb } from "../../support/testDb.js";
import { deleteSeededEvents, seedEvent } from "../../support/seedEvent.js";
import { EVENT_END } from "../../support/eventDates.js";
import {
  decisionColumns,
  findEventInScope,
  listReviewQueue,
  reviewColumns,
} from "../../../src/modules/event/repo/events.js";
import { transitionEvent } from "../../../src/modules/event/api/transitionEvent.js";
import { QUEUE_STATUSES } from "../../../src/modules/event/domain/statusMachine.js";

const sql = testDb();

const OWNER = randomUUID();
const OTHER_ORGANISER = randomUUID();
const COORDINATOR = randomUUID();
const OTHER_COORDINATOR = randomUUID();

const OWNERS = [OWNER, OTHER_ORGANISER];

async function cleanUp() {
  await deleteSeededEvents(sql, OWNERS);
}

/** Inserts a submitted event outside any wider workflow, for tests that need one. */
async function givenSubmittedEvent(ownerId = OWNER, name = "Annual Research Symposium") {
  return {
    id: await seedEvent(sql, {
      ownerId,
      status: "SUBMITTED",
      endsAt: new Date(EVENT_END),
      name,
    }),
  };
}

function openForReview(eventId: string, coordinatorId: string) {
  return sql.begin((tx) =>
    transitionEvent(
      tx,
      eventId,
      "OPEN_FOR_REVIEW",
      { userId: coordinatorId, role: "EVENT_COORDINATOR" },
      { set: reviewColumns(tx, coordinatorId) }
    )
  );
}

function decide(
  eventId: string,
  action: "APPROVE" | "REJECT",
  coordinatorId: string,
  reason: string | null
) {
  return sql.begin((tx) =>
    transitionEvent(
      tx,
      eventId,
      action,
      { userId: coordinatorId, role: "EVENT_COORDINATOR" },
      { set: decisionColumns(tx, coordinatorId, reason) }
    )
  );
}

beforeEach(cleanUp);

afterAll(async () => {
  await cleanUp();
  await sql.end();
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
    const first = await givenSubmittedEvent(OWNER, "First in");
    const second = await givenSubmittedEvent(OWNER, "Second in");

    const queue = await listReviewQueue(sql, QUEUE_STATUSES);
    const mine = queue.filter((row) => [first.id, second.id].includes(row.id));

    expect(mine.map((row) => row.id)).toEqual([first.id, second.id]);
  });

  it("drops an event from the queue once it carries a decision", async () => {
    const event = await givenSubmittedEvent();
    await openForReview(event.id, COORDINATOR);
    await decide(event.id, "APPROVE", COORDINATOR, null);

    const queue = await listReviewQueue(sql, QUEUE_STATUSES);

    expect(queue.map((row) => row.id)).not.toContain(event.id);
  });

  it("moves a submitted event to under review, recording the reviewer and the time", async () => {
    const event = await givenSubmittedEvent();

    const opened = await openForReview(event.id, COORDINATOR);

    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    expect(opened.event).toMatchObject({ status: "UNDER_REVIEW", reviewingCoordinatorId: COORDINATOR });
    expect(Date.parse(opened.event.reviewStartedAt!)).not.toBeNaN();
  });

  it("does not overwrite the reviewer when a second coordinator opens the same request", async () => {
    const event = await givenSubmittedEvent();
    await openForReview(event.id, COORDINATOR);

    const second = await openForReview(event.id, OTHER_COORDINATOR);

    expect(second.ok).toBe(false);
    const current = await findEventInScope(sql, event.id, { scopeType: "ALL" }, OTHER_COORDINATOR);
    expect(current!.reviewingCoordinatorId).toBe(COORDINATOR);
  });
});

describe("events repo — decisions (D4, D5)", () => {
  it("records an approval with the approving coordinator and the timestamp", async () => {
    const event = await givenSubmittedEvent();
    await openForReview(event.id, COORDINATOR);

    const decided = await decide(event.id, "APPROVE", COORDINATOR, null);

    expect(decided.ok).toBe(true);
    if (!decided.ok) return;
    expect(decided.event).toMatchObject({ status: "APPROVED", decidedBy: COORDINATOR });
    expect(Date.parse(decided.event.decidedAt!)).not.toBeNaN();
  });

  it("records a rejection with its reason", async () => {
    const event = await givenSubmittedEvent();
    await openForReview(event.id, COORDINATOR);

    const decided = await decide(event.id, "REJECT", COORDINATOR, "No venue can host this date.");

    expect(decided.ok).toBe(true);
    if (!decided.ok) return;
    expect(decided.event).toMatchObject({
      status: "REJECTED",
      rejectionReason: "No venue can host this date.",
    });
  });

  it("writes no second decision timestamp for an event already decided", async () => {
    const event = await givenSubmittedEvent();
    await openForReview(event.id, COORDINATOR);
    await decide(event.id, "APPROVE", COORDINATOR, null);
    const afterFirst = await findEventInScope(sql, event.id, { scopeType: "ALL" }, COORDINATOR);

    const second = await decide(event.id, "REJECT", OTHER_COORDINATOR, "Changed my mind");

    expect(second.ok).toBe(false);
    const unchanged = await findEventInScope(sql, event.id, { scopeType: "ALL" }, COORDINATOR);
    expect(unchanged).toMatchObject({
      status: "APPROVED",
      decidedBy: COORDINATOR,
      decidedAt: afterFirst!.decidedAt,
    });
  });
});
