import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { testDb } from "../../support/testDb.js";
import { deleteSeededEvents, seedEvent } from "../../support/seedEvent.js";
import { logger } from "../../../src/shared/logger.js";
import { completeDueEvents, runCompletionSweep } from "../../../src/modules/event/jobs/completeEvents.js";

/**
 * F1 AC6 — the completion sweep. The database is shared and the sweep completes
 * EVERY due Confirmed event, so the clock here is set far in the past (2001):
 * nothing real ends that early, so this test's sweep stays away from real data.
 * It does not protect the test from a teammate running the real sweep (or these
 * tests) against the shared database at the same moment: that would complete
 * these 2001 rows and could flake the "stays Confirmed" assertions. Assertions
 * look only at this file's events.
 */

const sql = testDb();

const OWNER = randomUUID();
const NOW = new Date("2001-06-01T12:00:00.000Z");
const at = (offsetMs: number) => new Date(NOW.getTime() + offsetMs);

const cleanUp = () => deleteSeededEvents(sql, [OWNER]);

async function statusOf(id: string) {
  const rows = await sql<{ status: string }[]>`select status from event.events where id = ${id}`;
  return rows[0]!.status;
}

async function completionsOf(id: string) {
  const rows = await sql<{ n: number }[]>`
    select count(*)::int as n from event.event_history
    where event_id = ${id} and triggering_action = 'COMPLETE'
  `;
  return rows[0]!.n;
}

beforeEach(cleanUp);

afterAll(async () => {
  await cleanUp();
  await sql.end();
});

describe("completeDueEvents (F1)", () => {
  it("completes a Confirmed event whose end has passed, as a system change", async () => {
    const id = await seedEvent(sql, { ownerId: OWNER, status: "CONFIRMED", endsAt: at(-60_000) });

    const run = await completeDueEvents(sql, NOW);

    expect([...run.completed, ...run.skipped.map((s) => s.id)]).toContain(id);
    expect(await statusOf(id)).toBe("COMPLETED");
    const history = await sql`
      select previous_status, new_status, actor_user_id, actor_role, triggering_action
      from event.event_history where event_id = ${id}
    `;
    expect(history).toEqual([
      {
        previous_status: "CONFIRMED",
        new_status: "COMPLETED",
        actor_user_id: null,
        actor_role: "SYSTEM",
        triggering_action: "COMPLETE",
      },
    ]);
  });

  it("completes an event at exactly its end instant", async () => {
    const id = await seedEvent(sql, { ownerId: OWNER, status: "CONFIRMED", endsAt: at(0) });

    expect((await completeDueEvents(sql, NOW)).completed).toContain(id);
  });

  it("completes an event that ended one millisecond earlier", async () => {
    const id = await seedEvent(sql, { ownerId: OWNER, status: "CONFIRMED", endsAt: at(-1) });

    expect((await completeDueEvents(sql, NOW)).completed).toContain(id);
  });

  it("leaves an event that ends one millisecond later Confirmed", async () => {
    const id = await seedEvent(sql, { ownerId: OWNER, status: "CONFIRMED", endsAt: at(1) });

    const run = await completeDueEvents(sql, NOW);

    expect(run.completed).not.toContain(id);
    expect(await statusOf(id)).toBe("CONFIRMED");
    expect(await completionsOf(id)).toBe(0);
  });

  it("leaves an Approved event whose end has passed Approved", async () => {
    const id = await seedEvent(sql, { ownerId: OWNER, status: "APPROVED", endsAt: at(-60_000) });

    const run = await completeDueEvents(sql, NOW);

    expect(run.completed).not.toContain(id);
    expect(await statusOf(id)).toBe("APPROVED");
  });

  it("completes an event once when run twice", async () => {
    const id = await seedEvent(sql, { ownerId: OWNER, status: "CONFIRMED", endsAt: at(-60_000) });

    await completeDueEvents(sql, NOW);
    const second = await completeDueEvents(sql, NOW);

    expect(second.completed).not.toContain(id);
    expect(await completionsOf(id)).toBe(1);
  });
});

describe("runCompletionSweep (F1)", () => {
  it("completes a due event, logs it by id, and exits 0", async () => {
    const id = await seedEvent(sql, { ownerId: OWNER, status: "CONFIRMED", endsAt: at(-60_000) });
    const info = vi.spyOn(logger, "info").mockImplementation(() => undefined);

    try {
      expect(await runCompletionSweep(sql, NOW)).toBe(0);
      expect(info).toHaveBeenCalledWith("event completed", expect.objectContaining({ eventId: id }));
      expect(await statusOf(id)).toBe("COMPLETED");
    } finally {
      info.mockRestore();
    }
  });
});
