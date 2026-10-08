import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { testDb } from "../../support/testDb.js";
import { deleteSeededEvents, seedEvent } from "../../support/seedEvent.js";

/**
 * F1 — one event's failure does not stop the sweep completing the others.
 * The clock is far in the past (2001) so this test's sweep stays away from real
 * data. It does not protect the test from a teammate running the real sweep (or
 * these tests) against the shared database at the same moment, which would
 * complete these 2001 rows and could flake the assertions.
 */

const failing = vi.hoisted(() => ({ id: "" }));

vi.mock("../../../src/modules/event/api/transitionEvent.js", async () => {
  const actual = await vi.importActual<typeof import("../../../src/modules/event/api/transitionEvent.js")>(
    "../../../src/modules/event/api/transitionEvent.js"
  );
  const transitionEvent: typeof actual.transitionEvent = async (tx, eventId, ...rest) => {
    // Run the real transition first, then fail: its writes must roll back with the event's own transaction.
    const outcome = await actual.transitionEvent(tx, eventId, ...rest);
    if (eventId === failing.id) throw new Error("simulated failure");
    return outcome;
  };
  return { ...actual, transitionEvent };
});

const { completeDueEvents } = await import("../../../src/modules/event/jobs/completeEvents.js");

const sql = testDb();

const OWNER = randomUUID();
const NOW = new Date("2001-06-01T12:00:00.000Z");

const cleanUp = () => deleteSeededEvents(sql, [OWNER]);

beforeEach(cleanUp);

afterAll(async () => {
  await cleanUp();
  await sql.end();
});

describe("completeDueEvents isolation (F1)", () => {
  it("records a failed event and still completes the rest, each in its own transaction", async () => {
    const endsAt = new Date(NOW.getTime() - 60_000);
    const broken = await seedEvent(sql, { ownerId: OWNER, status: "CONFIRMED", endsAt });
    const fine = await seedEvent(sql, { ownerId: OWNER, status: "CONFIRMED", endsAt });
    failing.id = broken;

    const run = await completeDueEvents(sql, NOW);

    expect(run.failed).toContainEqual({ id: broken, error: "simulated failure" });
    expect(run.completed).toContain(fine);
    const rows = await sql<{ id: string; status: string }[]>`
      select id, status from event.events where id in ${sql([broken, fine])}
    `;
    expect(Object.fromEntries(rows.map((row) => [row.id, row.status]))).toEqual({
      [broken]: "CONFIRMED",
      [fine]: "COMPLETED",
    });
    const [completions] = await sql<{ n: number }[]>`
      select count(*)::int as n from event.event_history
      where event_id = ${broken} and triggering_action = 'COMPLETE'
    `;
    expect(completions!.n).toBe(0);
  });
});
