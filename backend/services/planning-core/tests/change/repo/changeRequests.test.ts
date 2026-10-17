import { afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { testDb } from "../../support/testDb.js";
import {
  ChangeRequestAlreadyPendingError,
  findPendingForEvent,
  insertChangeRequest,
  listForEvent,
} from "../../../src/modules/change/repo/changeRequests.js";

/**
 * S1 repo checks, against real Postgres with change/0001 applied (CI's throwaway
 * database). Each test makes its own event id; there is no foreign key to the event
 * schema, so nothing here touches it.
 */

const sql = testDb();
const ACTOR = "a5555555-0000-0000-0000-000000000001";

afterAll(async () => {
  try {
    const ours = sql`select id from change.change_requests where created_by = ${ACTOR}`;
    await sql`delete from change.change_request_fields where request_id in (${ours})`;
    await sql`delete from change.change_requests where created_by = ${ACTOR}`;
  } finally {
    await sql.end();
  }
});

const current = {
  proposedStartAt: "2026-12-16T14:00:00.000Z",
  proposedEndAt: "2026-12-16T18:00:00.000Z",
  expectedAttendance: 150,
  venueRequirements: null,
  equipmentRequired: false,
  equipmentRequirements: null,
};

function insert(eventId: string, changes: Record<string, unknown>, reason = "Because") {
  return sql.begin((tx) =>
    insertChangeRequest(tx, { event: { id: eventId, reference: "EVT-TEST-1" }, reason, changes, current, actorId: ACTOR })
  );
}

describe("insertChangeRequest", () => {
  it("stores the request Pending with a snapshot and the proposed value of each field", async () => {
    const eventId = randomUUID();
    const before = Date.now();
    const record = await insert(eventId, { proposedStartAt: "2026-12-16T15:00:00.000Z", expectedAttendance: 180 }, "Keynote late");

    expect(record).toMatchObject({ eventId, eventReference: "EVT-TEST-1", status: "PENDING", reason: "Keynote late", requestedBy: ACTOR });
    expect(Date.parse(record.requestedAt)).toBeGreaterThanOrEqual(before - 1000);
    expect(record.fields).toEqual([
      { fieldName: "proposedStartAt", currentValue: current.proposedStartAt, proposedValue: "2026-12-16T15:00:00.000Z" },
      { fieldName: "expectedAttendance", currentValue: 150, proposedValue: 180 },
    ]);
    expect(await findPendingForEvent(sql, eventId)).toEqual(record);
  });

  it("keeps a null snapshot and a null or false value as real values", async () => {
    const eventId = randomUUID();
    const record = await insert(eventId, { venueRequirements: { capacity: 10 }, equipmentRequired: true, equipmentRequirements: null });

    expect(record.fields).toEqual([
      { fieldName: "venueRequirements", currentValue: null, proposedValue: { capacity: 10 } },
      { fieldName: "equipmentRequired", currentValue: false, proposedValue: true },
      { fieldName: "equipmentRequirements", currentValue: null, proposedValue: null },
    ]);
  });

  it("refuses a second pending request for the event, naming the first, and stores nothing", async () => {
    const eventId = randomUUID();
    const first = await insert(eventId, { expectedAttendance: 160 });

    const error = await insert(eventId, { expectedAttendance: 200 }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ChangeRequestAlreadyPendingError);
    expect((error as ChangeRequestAlreadyPendingError).existing).toEqual(first);
    expect(await listForEvent(sql, eventId)).toEqual([first]);
  });

  it("leaves another event's pending request alone", async () => {
    await insert(randomUUID(), { expectedAttendance: 160 });
    await expect(insert(randomUUID(), { expectedAttendance: 160 })).resolves.toMatchObject({ status: "PENDING" });
  });

  it("accepts a new request once the earlier one is no longer pending", async () => {
    const eventId = randomUUID();
    const first = await insert(eventId, { expectedAttendance: 160 });
    await sql`
      update change.change_requests
      set status = 'REJECTED', decided_by = ${ACTOR}, decided_at = now(), rejection_reason = 'Fixture'
      where id = ${first.id}
    `;

    const second = await insert(eventId, { expectedAttendance: 170 });

    expect(await findPendingForEvent(sql, eventId)).toEqual(second);
  });
});

describe("findPendingForEvent and listForEvent", () => {
  it("find nothing for an event with no request", async () => {
    const eventId = randomUUID();
    expect(await findPendingForEvent(sql, eventId)).toBeNull();
    expect(await listForEvent(sql, eventId)).toEqual([]);
  });

  it("list newest first", async () => {
    const eventId = randomUUID();
    const first = await insert(eventId, { expectedAttendance: 160 });
    await sql`
      update change.change_requests
      set status = 'REJECTED', decided_by = ${ACTOR}, decided_at = now(), rejection_reason = 'Fixture'
      where id = ${first.id}
    `;
    const second = await insert(eventId, { expectedAttendance: 170 });

    expect((await listForEvent(sql, eventId)).map((request) => request.id)).toEqual([second.id, first.id]);
  });
});
