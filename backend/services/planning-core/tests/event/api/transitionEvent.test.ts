import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { testDb } from "../../support/testDb.js";
import { deleteSeededEvents, seedEvent } from "../../support/seedEvent.js";
import { SYSTEM_ACTOR, transitionEvent } from "../../../src/modules/event/api/transitionEvent.js";
import { decisionColumns } from "../../../src/modules/event/repo/events.js";

/** F1 — the one way an event's status changes. */

const sql = testDb();

const OWNER = randomUUID();
const COORDINATOR = randomUUID();
const coordinator = { userId: COORDINATOR, role: "EVENT_COORDINATOR" };
const FAR_FUTURE = new Date("2030-01-01T12:00:00.000Z");

async function cleanUp() {
  await deleteSeededEvents(sql, [OWNER]);
}

async function statusOf(id: string) {
  const rows = await sql<{ status: string }[]>`select status from event.events where id = ${id}`;
  return rows[0]!.status;
}

async function historyOf(id: string) {
  return sql`
    select previous_status, new_status, actor_user_id, actor_role, triggering_action, occurred_at
    from event.event_history where event_id = ${id} and entry_type = 'STATUS_CHANGE'
    order by occurred_at
  `;
}

beforeEach(cleanUp);

afterAll(async () => {
  await cleanUp();
  await sql.end();
});

describe("transitionEvent (F1)", () => {
  it("applies a permitted transition and returns the event and its previous status", async () => {
    const id = await seedEvent(sql, { ownerId: OWNER, status: "UNDER_REVIEW", endsAt: FAR_FUTURE });

    const result = await sql.begin((tx) => transitionEvent(tx, id, "APPROVE", coordinator));

    expect(result).toMatchObject({ ok: true, previousStatus: "UNDER_REVIEW", event: { status: "APPROVED" } });
    expect(await statusOf(id)).toBe("APPROVED");
  });

  it("writes a history entry with both statuses, the actor, their role, the action and the time", async () => {
    const id = await seedEvent(sql, { ownerId: OWNER, status: "UNDER_REVIEW", endsAt: FAR_FUTURE });
    const before = Date.now();

    await sql.begin((tx) => transitionEvent(tx, id, "APPROVE", coordinator));

    const history = await historyOf(id);
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      previous_status: "UNDER_REVIEW",
      new_status: "APPROVED",
      actor_user_id: COORDINATOR,
      actor_role: "EVENT_COORDINATOR",
      triggering_action: "APPROVE",
    });
    expect(Math.abs(new Date(history[0]!.occurred_at).getTime() - before)).toBeLessThan(60_000);
  });

  it("refuses a transition not permitted from the current status, naming both, and stores nothing", async () => {
    const id = await seedEvent(sql, { ownerId: OWNER, status: "REJECTED", endsAt: FAR_FUTURE });

    const result = await sql.begin((tx) => transitionEvent(tx, id, "APPROVE", coordinator));

    expect(result).toEqual({
      ok: false,
      currentStatus: "REJECTED",
      message: "This event is Rejected and cannot move to Approved.",
    });
    expect(await statusOf(id)).toBe("REJECTED");
    expect(await historyOf(id)).toHaveLength(0);
  });

  it("records a system-initiated change with no user and the SYSTEM role", async () => {
    const id = await seedEvent(sql, {
      ownerId: OWNER,
      status: "CONFIRMED",
      endsAt: new Date("2029-06-01T12:00:00.000Z"),
    });

    await sql.begin((tx) =>
      transitionEvent(tx, id, "COMPLETE", SYSTEM_ACTOR, { now: new Date("2029-06-01T12:00:00.001Z") })
    );

    const history = await historyOf(id);
    expect(history[0]).toMatchObject({ actor_user_id: null, actor_role: "SYSTEM", triggering_action: "COMPLETE" });
  });

  it("writes the action's own columns in the same statement as the status", async () => {
    const id = await seedEvent(sql, { ownerId: OWNER, status: "UNDER_REVIEW", endsAt: FAR_FUTURE });

    const result = await sql.begin((tx) =>
      transitionEvent(tx, id, "REJECT", coordinator, {
        set: decisionColumns(tx, COORDINATOR, "No venue can host this date."),
      })
    );

    expect(result.ok && result.event).toMatchObject({
      status: "REJECTED",
      decidedBy: COORDINATOR,
      rejectionReason: "No venue can host this date.",
    });
  });

  it("throws for an event that does not exist", async () => {
    await expect(
      sql.begin((tx) =>
        transitionEvent(tx, randomUUID(), "APPROVE", coordinator)
      )
    ).rejects.toThrow("No event");
  });
});

describe("completing an event (F1)", () => {
  const END = new Date("2029-06-01T12:00:00.000Z");
  const at = (offsetMs: number) => new Date(END.getTime() + offsetMs);

  it("refuses one millisecond before the end, saying why", async () => {
    const id = await seedEvent(sql, { ownerId: OWNER, status: "CONFIRMED", endsAt: END });

    const result = await sql.begin((tx) => transitionEvent(tx, id, "COMPLETE", SYSTEM_ACTOR, { now: at(-1) }));

    expect(result).toMatchObject({
      ok: false,
      message: "This event is Confirmed and cannot move to Completed until its end date and time have passed.",
    });
    expect(await statusOf(id)).toBe("CONFIRMED");
    expect(await historyOf(id)).toHaveLength(0);
  });

  it("completes at exactly the end instant", async () => {
    const id = await seedEvent(sql, { ownerId: OWNER, status: "CONFIRMED", endsAt: END });

    const result = await sql.begin((tx) => transitionEvent(tx, id, "COMPLETE", SYSTEM_ACTOR, { now: at(0) }));

    expect(result.ok).toBe(true);
    expect(await statusOf(id)).toBe("COMPLETED");
  });

  it("completes one millisecond after the end", async () => {
    const id = await seedEvent(sql, { ownerId: OWNER, status: "CONFIRMED", endsAt: END });

    const result = await sql.begin((tx) => transitionEvent(tx, id, "COMPLETE", SYSTEM_ACTOR, { now: at(1) }));

    expect(result.ok).toBe(true);
  });

  it("refuses completing an Approved event whose end has passed", async () => {
    const id = await seedEvent(sql, { ownerId: OWNER, status: "APPROVED", endsAt: END });

    const result = await sql.begin((tx) => transitionEvent(tx, id, "COMPLETE", SYSTEM_ACTOR, { now: at(60_000) }));

    expect(result).toMatchObject({ ok: false, message: "This event is Approved and cannot move to Completed." });
    expect(await statusOf(id)).toBe("APPROVED");
  });
});
