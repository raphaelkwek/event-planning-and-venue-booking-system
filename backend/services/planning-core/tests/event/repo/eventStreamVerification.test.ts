import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { testDb } from "../../support/testDb.js";
import { deleteSeededEvents, seedEvent } from "../../support/seedEvent.js";
import { inRolledBackTransaction, streamOf, withoutTriggers } from "../../support/eventStream.js";
import { recordStatusChange } from "../../../src/modules/event/repo/eventHistory.js";
import { verifyEventStore } from "../../../src/modules/event/repo/eventStreamVerification.js";
import { verificationReport } from "../../../src/modules/event/domain/eventStream.js";

/**
 * EN-03 criterion 5 — the tamper check behind `npm run event-store:verify`.
 * Every edit below is made with the append-only trigger switched off, inside a
 * transaction that is rolled back, so the stream other tests use is untouched.
 */

const sql = testDb();
const OWNER = randomUUID();
const COORDINATOR = randomUUID();

/** An event with three status changes in its stream: Submitted, Under Review, Approved. */
async function eventWithThreeEntries(): Promise<string> {
  const id = await seedEvent(sql, { ownerId: OWNER, status: "APPROVED", endsAt: new Date("2030-06-01T12:00:00Z") });
  for (const [previous, next, action, role] of [
    ["DRAFT", "SUBMITTED", "SUBMIT", "EVENT_ORGANISER"],
    ["SUBMITTED", "UNDER_REVIEW", "OPEN_FOR_REVIEW", "EVENT_COORDINATOR"],
    ["UNDER_REVIEW", "APPROVED", "APPROVE", "EVENT_COORDINATOR"],
  ] as const) {
    await sql.begin((tx) =>
      recordStatusChange(tx, id, {
        previousStatus: previous,
        newStatus: next,
        actorUserId: role === "EVENT_ORGANISER" ? OWNER : COORDINATOR,
        actorRole: role,
        triggeringAction: action,
      })
    );
  }
  return id;
}

beforeEach(() => deleteSeededEvents(sql, [OWNER]));

afterAll(async () => {
  await deleteSeededEvents(sql, [OWNER]);
  await sql.end();
});

describe("the tamper check (EN-03 criterion 5)", () => {
  it("EN-03-T14 the tamper check passes on an intact store", async () => {
    await eventWithThreeEntries();

    // Everything the integration suite has written so far, not only this test's event.
    const result = await verifyEventStore(sql);

    expect(result.brokenLink).toBeNull();
    expect(result.projectionMismatch).toBeNull();
    expect(result.entries).toBeGreaterThanOrEqual(3);
    expect(result.events).toBeGreaterThanOrEqual(1);
    const report = verificationReport(result);
    expect(report.ok).toBe(true);
    expect(report.lines).toEqual([
      `Checked ${result.entries} stream entries across ${result.events} event${result.events === 1 ? "" : "s"}.`,
      "Every chain is intact.",
      "Every history row matches its stream entry.",
    ]);
  });

  it("EN-03-T15 an entry whose data was edited is detected", async () => {
    const id = await eventWithThreeEntries();

    const result = await inRolledBackTransaction(sql, async (tx) => {
      await withoutTriggers(tx);
      await tx`
        update event.event_stream set data = jsonb_set(data, '{newStatus}', '"CONFIRMED"')
        where aggregate_id = ${id} and version = 2
      `;
      return verifyEventStore(tx, { aggregateId: id });
    });

    expect(result.brokenLink).toStrictEqual({
      aggregateId: id,
      version: 2,
      fault: "HASH_MISMATCH",
      reason: "its stored hash does not match its contents, so the entry was changed",
    });
    expect(verificationReport(result).ok).toBe(false);
    expect(verificationReport(result).lines[1]).toBe(
      `First broken link: event ${id} version 2 (HASH_MISMATCH): its stored hash does not match its contents, so the entry was changed.`
    );
    // The rollback left the real entry as it was.
    expect((await streamOf(sql, id))[1]!.newStatus).toBe("UNDER_REVIEW");
    expect((await verifyEventStore(sql, { aggregateId: id })).brokenLink).toBeNull();
  });

  it("EN-03-T16 an edit that also rewrites the entry's hash is detected at the next entry", async () => {
    const id = await eventWithThreeEntries();

    const result = await inRolledBackTransaction(sql, async (tx) => {
      await withoutTriggers(tx);
      await tx`
        update event.event_stream
        set data = jsonb_set(data, '{newStatus}', '"CONFIRMED"'),
            hash = event.stream_entry_hash(prev_hash, event.stream_entry_canonical(
              id, aggregate_id, version, type, jsonb_set(data, '{newStatus}', '"CONFIRMED"'),
              actor_user_id, actor_role, occurred_at))
        where aggregate_id = ${id} and version = 2
      `;
      return verifyEventStore(tx, { aggregateId: id });
    });

    expect(result.brokenLink).toStrictEqual({
      aggregateId: id,
      version: 3,
      fault: "PREVIOUS_HASH_MISMATCH",
      reason: "its prev_hash is not the hash of version 2, so an earlier entry was changed",
    });
  });

  it("EN-03-T17 a removed entry is detected", async () => {
    const id = await eventWithThreeEntries();

    const result = await inRolledBackTransaction(sql, async (tx) => {
      await withoutTriggers(tx);
      await tx`delete from event.event_stream where aggregate_id = ${id} and version = 2`;
      return verifyEventStore(tx, { aggregateId: id });
    });

    expect(result.brokenLink).toStrictEqual({
      aggregateId: id,
      version: 3,
      fault: "VERSION_OUT_OF_SEQUENCE",
      reason: "expected version 2 here, found 3, so an entry is missing",
    });
    // Its history row now has no stream entry, which the check reports too.
    expect(result.projectionMismatch).toMatchObject({ eventId: id, hasEntry: false });
    expect(await streamOf(sql, id)).toHaveLength(3);
  });

  it("EN-03-T19 a history projection row that disagrees with the stream is reported", async () => {
    const id = await seedEvent(sql, { ownerId: OWNER, status: "UNDER_REVIEW", endsAt: new Date("2030-06-01T12:00:00Z") });
    await sql.begin((tx) =>
      recordStatusChange(tx, id, {
        previousStatus: "SUBMITTED",
        newStatus: "UNDER_REVIEW",
        actorUserId: COORDINATOR,
        actorRole: "EVENT_COORDINATOR",
        triggeringAction: "OPEN_FOR_REVIEW",
      })
    );
    const [entry] = await streamOf(sql, id);

    const result = await inRolledBackTransaction(sql, async (tx) => {
      await tx`update event.event_history set new_status = 'CONFIRMED' where id = ${entry!.id}`;
      return verifyEventStore(tx, { aggregateId: id });
    });

    expect(result.brokenLink).toBeNull();
    expect(result.projectionMismatch).toStrictEqual({ historyId: entry!.id, eventId: id, hasEntry: true });
    expect(verificationReport(result)).toStrictEqual({
      ok: false,
      lines: [
        "Checked 1 stream entry across 1 event.",
        "Every chain is intact.",
        `History row ${entry!.id} of event ${id} does not match its stream entry.`,
      ],
    });
  });
});
