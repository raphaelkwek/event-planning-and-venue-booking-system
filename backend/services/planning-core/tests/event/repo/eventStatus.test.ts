import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { testDb } from "../../support/testDb.js";
import { seedEvent } from "../../support/seedEvent.js";
import {
  endHasPassed,
  listDueForCompletion,
  readStatus,
  updateStatusIf,
} from "../../../src/modules/event/repo/eventStatus.js";

/** F1 — the one statement that changes an event's status. */

const sql = testDb();

const OWNER = "af222222-0000-0000-0000-000000000001";
const COORDINATOR = "af222222-0000-0000-0000-000000000002";
const OTHER_COORDINATOR = "af222222-0000-0000-0000-000000000003";
const FAR_FUTURE = new Date("2030-01-01T12:00:00.000Z");

async function cleanUp() {
  await sql`delete from event.event_history where event_id in (
    select id from event.events where owner_id = ${OWNER}
  )`;
  await sql`delete from event.events where owner_id = ${OWNER}`;
}

async function statusOf(id: string) {
  const rows = await sql<{ status: string }[]>`select status from event.events where id = ${id}`;
  return rows[0]!.status;
}

beforeEach(cleanUp);

afterAll(async () => {
  await cleanUp();
  await sql.end();
});

describe("updateStatusIf (F1)", () => {
  it("moves an event whose status is in the from-list, returning the previous status", async () => {
    const id = await seedEvent(sql, { ownerId: OWNER, status: "UNDER_REVIEW", endsAt: FAR_FUTURE });

    const changed = await sql.begin((tx) =>
      updateStatusIf(tx, {
        eventId: id,
        from: ["UNDER_REVIEW", "AWAITING_CLARIFICATION"],
        to: "APPROVED",
        actorId: COORDINATOR,
      })
    );

    expect(changed).toMatchObject({ previousStatus: "UNDER_REVIEW", event: { id, status: "APPROVED" } });
    expect(await statusOf(id)).toBe("APPROVED");
  });

  it("changes nothing and returns null when the status is not in the from-list", async () => {
    const id = await seedEvent(sql, { ownerId: OWNER, status: "REJECTED", endsAt: FAR_FUTURE });

    const changed = await sql.begin((tx) =>
      updateStatusIf(tx, { eventId: id, from: ["UNDER_REVIEW"], to: "APPROVED", actorId: COORDINATOR })
    );

    expect(changed).toBeNull();
    expect(await statusOf(id)).toBe("REJECTED");
  });

  it("writes the extra columns in the same statement as the status", async () => {
    const id = await seedEvent(sql, { ownerId: OWNER, status: "UNDER_REVIEW", endsAt: FAR_FUTURE });

    const changed = await sql.begin((tx) =>
      updateStatusIf(tx, {
        eventId: id,
        from: ["UNDER_REVIEW"],
        to: "APPROVED",
        actorId: COORDINATOR,
        set: tx`decided_by = ${COORDINATOR}, decided_at = now(),`,
      })
    );

    expect(changed!.event).toMatchObject({ status: "APPROVED", decidedBy: COORDINATOR });
    expect(changed!.event.decidedAt).toBeTruthy();
  });

  it("applies the extra condition, changing nothing when it does not hold", async () => {
    const id = await seedEvent(sql, { ownerId: OWNER, status: "CONFIRMED", endsAt: FAR_FUTURE });

    const changed = await sql.begin((tx) =>
      updateStatusIf(tx, {
        eventId: id,
        from: ["CONFIRMED"],
        to: "COMPLETED",
        actorId: null,
        onlyIf: endHasPassed(tx, new Date("2029-12-31T00:00:00.000Z")),
      })
    );

    expect(changed).toBeNull();
    expect(await statusOf(id)).toBe("CONFIRMED");
  });

  it("lets exactly one of two concurrent changes from the same status succeed", async () => {
    const id = await seedEvent(sql, { ownerId: OWNER, status: "UNDER_REVIEW", endsAt: FAR_FUTURE });

    const results = await Promise.all(
      [COORDINATOR, OTHER_COORDINATOR].map((actorId) =>
        sql.begin((tx) =>
          updateStatusIf(tx, { eventId: id, from: ["UNDER_REVIEW"], to: "APPROVED", actorId })
        )
      )
    );

    expect(results.filter((result) => result !== null)).toHaveLength(1);
  });
});

describe("readStatus", () => {
  it("returns the event's status", async () => {
    const id = await seedEvent(sql, { ownerId: OWNER, status: "PLANNING", endsAt: FAR_FUTURE });
    expect(await sql.begin((tx) => readStatus(tx, id))).toBe("PLANNING");
  });

  it("returns null for an event that does not exist", async () => {
    expect(
      await sql.begin((tx) => readStatus(tx, "af222222-ffff-ffff-ffff-ffffffffffff"))
    ).toBeNull();
  });
});

describe("listDueForCompletion (F1)", () => {
  it("lists Confirmed events whose end is at or before the time given, and nothing else", async () => {
    const now = new Date("2029-06-01T12:00:00.000Z");
    const endedEarlier = await seedEvent(sql, {
      ownerId: OWNER,
      status: "CONFIRMED",
      endsAt: new Date(now.getTime() - 1),
    });
    const endsExactlyNow = await seedEvent(sql, { ownerId: OWNER, status: "CONFIRMED", endsAt: now });
    const endsLater = await seedEvent(sql, {
      ownerId: OWNER,
      status: "CONFIRMED",
      endsAt: new Date(now.getTime() + 1),
    });
    const approvedAndEnded = await seedEvent(sql, {
      ownerId: OWNER,
      status: "APPROVED",
      endsAt: new Date(now.getTime() - 1),
    });

    const due = await listDueForCompletion(sql, now);

    expect(due).toEqual(expect.arrayContaining([endedEarlier, endsExactlyNow]));
    expect(due).not.toContain(endsLater);
    expect(due).not.toContain(approvedAndEnded);
  });
});

describe("the permitted statuses in the database (F1)", () => {
  it("refuses a status outside the ten", async () => {
    const id = await seedEvent(sql, { ownerId: OWNER, status: "SUBMITTED", endsAt: FAR_FUTURE });

    await expect(
      sql`update event.events set status = 'ARCHIVED' where id = ${id}`
    ).rejects.toMatchObject({ code: "23514" });
    expect(await statusOf(id)).toBe("SUBMITTED");
  });
});
