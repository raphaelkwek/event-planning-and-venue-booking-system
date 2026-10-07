import { afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { testDb } from "../support/testDb.js";
import { isThrowawayDatabase, losers, race, winners } from "../support/race.js";
import { deleteSeededEvents, seedEvent } from "../support/seedEvent.js";
import { updateStatusIf } from "../../src/modules/event/repo/eventStatus.js";

/**
 * F1 — "An attempted transition that is not permitted from the current status
 * is refused": when many attempt the same transition at once, exactly one wins.
 * Fifty attempts, each on its own connection (EN-02.3, ADR-0006); they run only
 * against a throwaway database, and are skipped against any other.
 */

const ATTEMPTS = 50;
/** Each "exactly one" race is run this many times: a race that passes once can still lose rarely. */
const ROUNDS = 10;
const OWNER = randomUUID();
const FAR_FUTURE = new Date("2030-01-01T12:00:00.000Z");
const sql = testDb();

afterAll(async () => {
  if (isThrowawayDatabase()) await deleteSeededEvents(sql, [OWNER]);
  await sql.end();
});

describe.runIf(isThrowawayDatabase())(`${ATTEMPTS} status changes at the same moment (F1)`, { timeout: 60_000 }, () => {
  it("exactly one of 50 identical transitions succeeds; the other 49 change nothing", async () => {
    for (let round = 0; round < ROUNDS; round += 1) {
      const eventId = await seedEvent(sql, { ownerId: OWNER, status: "UNDER_REVIEW", endsAt: FAR_FUTURE });
      const actors = Array.from({ length: ATTEMPTS }, () => randomUUID());

      const results = await race(ATTEMPTS, (tx, i) =>
        updateStatusIf(tx, {
          eventId,
          from: ["UNDER_REVIEW", "AWAITING_CLARIFICATION"],
          to: "APPROVED",
          actorId: actors[i]!,
        })
      );

      expect(losers(results)).toEqual([]);
      const outcomes = winners(results);
      const changed = outcomes.filter((outcome) => outcome !== null);
      expect(changed).toHaveLength(1);
      expect(changed[0]!.previousStatus).toBe("UNDER_REVIEW");
      expect(outcomes.filter((outcome) => outcome === null)).toHaveLength(ATTEMPTS - 1);

      const [row] = await sql<{ status: string; updated_by: string }[]>`
        select status, updated_by from event.events where id = ${eventId}
      `;
      expect(row!.status).toBe("APPROVED");
      expect(actors).toContain(row!.updated_by);
      const winnerIndex = results.findIndex((r) => r.status === "fulfilled" && r.value !== null);
      expect(row!.updated_by).toBe(actors[winnerIndex]);
    }
  });
});
