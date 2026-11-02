import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { parseCloudEvent, KAFKA_TOPICS } from "@connectsphere/contracts";
import { testDb } from "../../support/testDb.js";
import { deleteSeededEvents, seedEvent } from "../../support/seedEvent.js";
import { transitionEvent } from "../../../src/modules/event/api/transitionEvent.js";
import { writeListingChanged } from "../../../src/modules/event/events/listing.js";
import { applyApprovedChange } from "../../../src/modules/event/repo/events.js";
import type { ChangeableEvent } from "../../../src/modules/event/domain/proposedChange.js";

/**
 * R1 to R4 — the event's `event.listing-changed` message, which the
 * registration service builds its attendee list from (ADR-0005). It is written
 * in the transaction of each change to a published field or a registration
 * setting, and validates against its contract. CI only.
 */

const sql = testDb();
const OWNER = randomUUID();
const COORDINATOR = randomUUID();
const coordinator = { userId: COORDINATOR, role: "EVENT_COORDINATOR" };
const ENDS = new Date("2030-02-01T12:00:00.000Z");

beforeEach(() => deleteSeededEvents(sql, [OWNER]));
afterAll(async () => {
  await deleteSeededEvents(sql, [OWNER]);
  await sql.end();
});

async function listings(id: string) {
  const rows = await sql<{ topic: string; message_key: string; envelope: unknown }[]>`
    select topic, message_key, envelope from event.outbox
    where message_key = ${id} and envelope->>'type' = 'event.listing-changed' order by seq
  `;
  return rows.map((row) => ({ topic: row.topic, key: row.message_key, message: parseCloudEvent(row.envelope) }));
}

describe("event.listing-changed", () => {
  it("is written with every status change, carrying the new status and only the published fields (R1-T4)", async () => {
    const id = await seedEvent(sql, { ownerId: OWNER, status: "SAFETY_REVIEW", endsAt: ENDS, name: "R1 listing" });
    await sql`
      update event.events set registration_required = true, registration_opens_at = '2030-01-01T01:00:00Z',
        registration_closes_at = '2030-01-31T10:00:00Z' where id = ${id}`;

    await sql.begin((tx) => transitionEvent(tx, id, "APPROVE_SAFETY", coordinator, { correlationId: "corr-r1" }));

    const [only, ...rest] = await listings(id);
    expect(rest).toEqual([]);
    expect(only!.topic).toBe(KAFKA_TOPICS.event);
    expect(only!.key).toBe(id);
    expect(only!.message.correlationid).toBe("corr-r1");
    expect(only!.message.data).toEqual({
      eventId: id,
      eventReference: expect.stringMatching(/^TST-/),
      eventName: "R1 listing",
      ownerId: OWNER,
      description: "Seeded for a test",
      status: "CONFIRMED",
      proposedStartAt: "2030-02-01T08:00:00.000Z",
      proposedEndAt: "2030-02-01T12:00:00.000Z",
      registrationRequired: true,
      registrationOpensAt: "2030-01-01T01:00:00.000Z",
      registrationClosesAt: "2030-01-31T10:00:00.000Z",
      withdrawalDeadlineAt: null,
      highDemand: false,
      changedAt: expect.any(String),
    });
  });

  it("EN-19-T1 carries the event's high-demand flag", async () => {
    const id = await seedEvent(sql, { ownerId: OWNER, status: "CONFIRMED", endsAt: ENDS });
    await sql`update event.events set high_demand = true where id = ${id}`;

    await sql.begin((tx) => writeListingChanged(tx, id, coordinator, null));

    const [only] = await listings(id);
    expect(only!.message.data).toMatchObject({ highDemand: true });
  });

  it("is written when an approved change moves the event's times (S2), with the new times (R1-T1)", async () => {
    const id = await seedEvent(sql, { ownerId: OWNER, status: "CONFIRMED", endsAt: ENDS });
    const current = { proposedEndAt: ENDS.toISOString() } as unknown as ChangeableEvent;

    await sql.begin((tx) => applyApprovedChange(tx, { id, current }, { proposedEndAt: "2030-02-01T13:00:00.000Z" }, coordinator));

    const [only] = await listings(id);
    expect(only!.message.data).toMatchObject({ status: "CONFIRMED", proposedEndAt: "2030-02-01T13:00:00.000Z" });
  });

  it("is not written for an event without a reference, such as a draft, which is never listed", async () => {
    const id = await seedEvent(sql, { ownerId: OWNER, status: "DRAFT", endsAt: ENDS });
    await sql`update event.events set reference = null where id = ${id}`;

    expect(await sql.begin((tx) => writeListingChanged(tx, id, coordinator, null))).toBeNull();
    expect(await sql.begin((tx) => writeListingChanged(tx, randomUUID(), coordinator, null))).toBeNull();
    expect(await listings(id)).toEqual([]);
  });
});
