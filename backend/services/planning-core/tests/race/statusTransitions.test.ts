import { afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { testDb } from "../support/testDb.js";
import { isThrowawayDatabase, losers, race, winners } from "../support/race.js";
import { deleteSeededEvents, seedEvent } from "../support/seedEvent.js";
import { SYSTEM_ACTOR, transitionEvent } from "../../src/modules/event/api/transitionEvent.js";
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

  it("exactly one of 50 approvals through transitionEvent succeeds, writing one history entry", async () => {
    for (let round = 0; round < ROUNDS; round += 1) {
      const eventId = await seedEvent(sql, { ownerId: OWNER, status: "UNDER_REVIEW", endsAt: FAR_FUTURE });
      const actors = Array.from({ length: ATTEMPTS }, () => randomUUID());

      const results = await race(ATTEMPTS, (tx, i) =>
        transitionEvent(tx, eventId, "APPROVE", { userId: actors[i]!, role: "EVENT_COORDINATOR" })
      );

      expect(losers(results)).toEqual([]);
      const outcomes = winners(results);
      expect(outcomes.filter((outcome) => outcome.ok)).toHaveLength(1);
      const refused = outcomes.filter((outcome) => !outcome.ok);
      expect(refused).toHaveLength(ATTEMPTS - 1);
      for (const outcome of refused) {
        expect(outcome).toMatchObject({ message: "This event is Approved and cannot move to Approved." });
      }

      const winnerIndex = results.findIndex((r) => r.status === "fulfilled" && r.value.ok);
      const history = await sql<{ actor_user_id: string }[]>`
        select actor_user_id from event.event_history
        where event_id = ${eventId} and entry_type = 'STATUS_CHANGE' and triggering_action = 'APPROVE'
      `;
      expect(history).toHaveLength(1);
      expect(history[0]!.actor_user_id).toBe(actors[winnerIndex]);
      const [row] = await sql<{ status: string }[]>`select status from event.events where id = ${eventId}`;
      expect(row!.status).toBe("APPROVED");
    }
  });

  it("exactly one of 50 system completions succeeds, writing one SYSTEM history entry", async () => {
    // Ends in 2001, so no real sweep or teammate's test treats it as anything but long over.
    const ended = new Date("2001-06-01T12:00:00.000Z");
    const after = new Date(ended.getTime() + 60_000);
    for (let round = 0; round < ROUNDS; round += 1) {
      const eventId = await seedEvent(sql, { ownerId: OWNER, status: "CONFIRMED", endsAt: ended });

      const results = await race(ATTEMPTS, (tx) =>
        transitionEvent(tx, eventId, "COMPLETE", SYSTEM_ACTOR, { now: after })
      );

      expect(losers(results)).toEqual([]);
      const outcomes = winners(results);
      expect(outcomes.filter((outcome) => outcome.ok)).toHaveLength(1);
      expect(outcomes.filter((outcome) => !outcome.ok)).toHaveLength(ATTEMPTS - 1);

      const history = await sql<{ actor_role: string }[]>`
        select actor_role from event.event_history
        where event_id = ${eventId} and triggering_action = 'COMPLETE'
      `;
      expect(history).toHaveLength(1);
      expect(history[0]!.actor_role).toBe("SYSTEM");
      const [row] = await sql<{ status: string }[]>`select status from event.events where id = ${eventId}`;
      expect(row!.status).toBe("COMPLETED");
    }
  });
});
