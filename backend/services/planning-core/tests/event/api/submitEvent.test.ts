import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { testDb } from "../../support/testDb.js";
import { deleteSeededEvents, seedEvent } from "../../support/seedEvent.js";
import { submitEvent } from "../../../src/modules/event/api/submitEvent.js";

/** B1/C2 — submitEvent's own defence, below the routes that already check. */

const sql = testDb();

const OWNER_A = randomUUID();
const OWNER_B = randomUUID();
const FAR_FUTURE = new Date("2030-01-01T12:00:00.000Z");

async function cleanUp() {
  await deleteSeededEvents(sql, [OWNER_A, OWNER_B]);
}

beforeEach(cleanUp);

afterAll(async () => {
  await cleanUp();
  await sql.end();
});

describe("submitEvent ownership (C2)", () => {
  it("refuses to submit a draft owned by someone else and changes nothing", async () => {
    const draftId = await seedEvent(sql, { ownerId: OWNER_A, status: "DRAFT", endsAt: FAR_FUTURE });
    await sql`update event.events set reference = null, submitted_at = null where id = ${draftId}`;

    const result = await submitEvent(sql, {
      ownerId: OWNER_B,
      actorRole: "EVENT_ORGANISER",
      draftId,
      correlationId: null,
    });

    expect(result).toEqual({ ok: false, message: "No draft with that reference is available to you." });
    const rows = await sql`select status, reference, submitted_at from event.events where id = ${draftId}`;
    expect(rows[0]).toMatchObject({ status: "DRAFT", reference: null, submitted_at: null });
    const history = await sql`select 1 from event.event_history where event_id = ${draftId}`;
    expect(history).toHaveLength(0);
  });
});
