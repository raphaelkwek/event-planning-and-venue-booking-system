import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { testDb } from "../support/testDb.js";
import { insertSubmittedEvent, type EventFields } from "../../src/repo/events.js";
import { recordFieldChanges, recordStatusChange } from "../../src/repo/eventHistory.js";

/**
 * One history per event: status changes (F1) and field-level amendments (D3)
 * are both append-only records of what happened to it, so they share a table.
 */

const sql = testDb();

const OWNER = "a8888888-0000-0000-0000-000000000001";
const COORDINATOR = "a8888888-0000-0000-0000-000000000002";

const fields: EventFields = {
  name: "History test",
  purpose: "Purpose",
  description: "Description",
  proposedStartAt: "2026-10-02T14:00:00.000Z",
  proposedEndAt: "2026-10-02T18:00:00.000Z",
  expectedAttendance: 150,
  venueRequirements: null,
  accessibilityNeeds: null,
  equipmentRequired: false,
  equipmentRequirements: null,
  registrationRequired: false,
  registrationOpensAt: null,
  registrationClosesAt: null,
};

async function cleanUp() {
  await sql`delete from event.event_history where event_id in (
    select id from event.events where owner_id = ${OWNER}
  )`;
  await sql`delete from event.events where owner_id = ${OWNER}`;
}

async function givenAnEvent() {
  return sql.begin((tx) => insertSubmittedEvent(tx, OWNER, fields));
}

beforeEach(cleanUp);

afterAll(async () => {
  await cleanUp();
  await sql.end();
});

describe("event history", () => {
  it("records a status change with both statuses, the actor, their role and the action", async () => {
    const event = await givenAnEvent();

    await sql.begin((tx) =>
      recordStatusChange(tx, event.id, {
        previousStatus: "SUBMITTED",
        newStatus: "UNDER_REVIEW",
        actorUserId: COORDINATOR,
        actorRole: "EVENT_COORDINATOR",
        triggeringAction: "OPEN_FOR_REVIEW",
      })
    );

    const rows = await sql`select * from event.event_history where event_id = ${event.id}`;
    expect(rows[0]).toMatchObject({
      entry_type: "STATUS_CHANGE",
      previous_status: "SUBMITTED",
      new_status: "UNDER_REVIEW",
      actor_user_id: COORDINATOR,
      actor_role: "EVENT_COORDINATOR",
      triggering_action: "OPEN_FOR_REVIEW",
      field_name: null,
    });
  });

  it("records each amended field with its before and after value, the actor and their role", async () => {
    const event = await givenAnEvent();

    await sql.begin((tx) =>
      recordFieldChanges(
        tx,
        event.id,
        [
          { fieldName: "expectedAttendance", previousValue: "150", newValue: "200" },
          { fieldName: "purpose", previousValue: "Purpose", newValue: "Revised purpose" },
        ],
        { userId: OWNER, role: "EVENT_ORGANISER" },
        "RESPOND_TO_CLARIFICATION"
      )
    );

    const rows = await sql`
      select field_name, previous_value, new_value, actor_user_id, actor_role, entry_type
      from event.event_history where event_id = ${event.id} order by field_name
    `;
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      entry_type: "FIELD_CHANGE",
      field_name: "expectedAttendance",
      previous_value: "150",
      new_value: "200",
      actor_user_id: OWNER,
      actor_role: "EVENT_ORGANISER",
    });
  });

  it("writes nothing when there are no field changes to record", async () => {
    const event = await givenAnEvent();

    await sql.begin((tx) =>
      recordFieldChanges(tx, event.id, [], { userId: OWNER, role: "EVENT_ORGANISER" }, "RESPOND_TO_CLARIFICATION")
    );

    const rows = await sql`select count(*)::int as n from event.event_history where event_id = ${event.id}`;
    expect(rows[0]!.n).toBe(0);
  });

  it("keeps status changes and field changes in one chronological history", async () => {
    const event = await givenAnEvent();

    await sql.begin((tx) =>
      recordStatusChange(tx, event.id, {
        previousStatus: "UNDER_REVIEW",
        newStatus: "AWAITING_CLARIFICATION",
        actorUserId: COORDINATOR,
        actorRole: "EVENT_COORDINATOR",
        triggeringAction: "REQUEST_CLARIFICATION",
      })
    );
    await sql.begin((tx) =>
      recordFieldChanges(
        tx,
        event.id,
        [{ fieldName: "expectedAttendance", previousValue: "150", newValue: "200" }],
        { userId: OWNER, role: "EVENT_ORGANISER" },
        "RESPOND_TO_CLARIFICATION"
      )
    );

    const rows = await sql`
      select entry_type from event.event_history where event_id = ${event.id} order by occurred_at
    `;
    expect(rows.map((row) => row.entry_type)).toEqual(["STATUS_CHANGE", "FIELD_CHANGE"]);
  });

  it("refuses a status-change entry that names no new status", async () => {
    const event = await givenAnEvent();

    await expect(
      sql`
        insert into event.event_history (event_id, entry_type, actor_role, triggering_action)
        values (${event.id}, 'STATUS_CHANGE', 'EVENT_COORDINATOR', 'APPROVE')
      `
    ).rejects.toThrow();
  });

  it("refuses a field-change entry that names no field", async () => {
    const event = await givenAnEvent();

    await expect(
      sql`
        insert into event.event_history (event_id, entry_type, actor_role, triggering_action)
        values (${event.id}, 'FIELD_CHANGE', 'EVENT_ORGANISER', 'RESPOND_TO_CLARIFICATION')
      `
    ).rejects.toThrow();
  });
});
