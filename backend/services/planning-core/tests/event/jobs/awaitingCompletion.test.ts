import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { testDb } from "../../support/testDb.js";
import { deleteSeededEvents, seedEvent } from "../../support/seedEvent.js";
import { listAwaitingCompletion } from "../../../src/modules/event/index.js";

/**
 * EN-11-T4 — the events the Temporal worker re-creates a CompleteEvent timer for when it starts:
 * every Confirmed event with an end, with that end, whether or not it has passed (an overdue one
 * completes at once). Dated 2001 so that no real event is among them; the database is shared
 * with the other files, so assertions look only at this file's events.
 */

const sql = testDb();
const OWNER = randomUUID();
const END = new Date("2001-06-01T12:00:00.000Z");
const cleanUp = () => deleteSeededEvents(sql, [OWNER]);

beforeEach(cleanUp);

afterAll(async () => {
  await cleanUp();
  await sql.end();
});

describe("listAwaitingCompletion (EN-11-T4)", () => {
  it("EN-11-T4 lists every Confirmed event with its end, and no event in another status", async () => {
    const overdue = await seedEvent(sql, { ownerId: OWNER, status: "CONFIRMED", endsAt: END });
    const future = await seedEvent(sql, { ownerId: OWNER, status: "CONFIRMED", endsAt: new Date("2001-07-01T09:30:00.000Z") });
    const approved = await seedEvent(sql, { ownerId: OWNER, status: "APPROVED", endsAt: END });
    const planning = await seedEvent(sql, { ownerId: OWNER, status: "PLANNING", endsAt: END });
    const cancelled = await seedEvent(sql, { ownerId: OWNER, status: "CANCELLED", endsAt: END });

    const listed = await listAwaitingCompletion(sql);
    const ours = listed.filter((entry) => [overdue, future, approved, planning, cancelled].includes(entry.eventId));

    expect(ours).toEqual([
      { eventId: overdue, endsAt: "2001-06-01T12:00:00.000Z" },
      { eventId: future, endsAt: "2001-07-01T09:30:00.000Z" },
    ]);
  });
});
