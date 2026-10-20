import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { testDb } from "../../support/testDb.js";
import { deleteSeededEvents, seedEvent } from "../../support/seedEvent.js";
import { completeEventIfDue } from "../../../src/modules/event/index.js";

/**
 * EN-11 — the step the completion workflow's activity runs (ADR-0009): complete
 * one event if its end has passed, and otherwise say why not, so the workflow
 * knows whether to wait again or stop. Unlike the sweep it touches one event,
 * so it never reaches anyone else's data in a shared database.
 */

const sql = testDb();
const OWNER = randomUUID();
const END = new Date("2029-06-01T12:00:00.000Z");
const at = (offsetMs: number) => new Date(END.getTime() + offsetMs);

const cleanUp = () => deleteSeededEvents(sql, [OWNER]);

async function statusOf(id: string) {
  const rows = await sql<{ status: string }[]>`select status from event.events where id = ${id}`;
  return rows[0]!.status;
}

beforeEach(cleanUp);
afterAll(async () => {
  await cleanUp();
  await sql.end();
});

describe("completeEventIfDue (EN-11)", () => {
  it("completes a Confirmed event at its end, as the system", async () => {
    const id = await seedEvent(sql, { ownerId: OWNER, status: "CONFIRMED", endsAt: END });

    expect(await completeEventIfDue(sql, id, at(0))).toEqual({ outcome: "completed" });

    expect(await statusOf(id)).toBe("COMPLETED");
    const [entry] = await sql`select actor_role from event.event_history where event_id = ${id} and triggering_action = 'COMPLETE'`;
    expect(entry!.actor_role).toBe("SYSTEM");
  });

  it("says the event isn't due yet, giving the end it now has, one millisecond before it", async () => {
    const id = await seedEvent(sql, { ownerId: OWNER, status: "CONFIRMED", endsAt: END });

    expect(await completeEventIfDue(sql, id, at(-1))).toEqual({ outcome: "not-due", endsAt: END.toISOString() });
    expect(await statusOf(id)).toBe("CONFIRMED");
  });

  it("reads the end the event has now, so a later end is waited for", async () => {
    const id = await seedEvent(sql, { ownerId: OWNER, status: "CONFIRMED", endsAt: END });
    const later = at(2 * 60 * 60 * 1000);
    await sql`update event.events set proposed_end_at = ${later} where id = ${id}`;

    expect(await completeEventIfDue(sql, id, at(60_000))).toEqual({ outcome: "not-due", endsAt: later.toISOString() });
  });

  it.each(["SAFETY_REVIEW", "COMPLETED", "CANCELLED"] as const)(
    "leaves a %s event alone and names its status, so the workflow stops",
    async (status) => {
      const id = await seedEvent(sql, { ownerId: OWNER, status, endsAt: END });

      expect(await completeEventIfDue(sql, id, at(60_000))).toEqual({ outcome: "not-confirmed", status });
      expect(await statusOf(id)).toBe(status);
    }
  );

  it("says so when no such event exists", async () => {
    expect(await completeEventIfDue(sql, randomUUID(), at(0))).toEqual({ outcome: "not-found" });
  });

  it("uses the database clock when no time is given", async () => {
    const id = await seedEvent(sql, { ownerId: OWNER, status: "CONFIRMED", endsAt: new Date("2020-01-01T00:00:00.000Z") });

    expect(await completeEventIfDue(sql, id)).toEqual({ outcome: "completed" });
  });
});
