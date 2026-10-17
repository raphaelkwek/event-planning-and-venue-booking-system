import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { testDb } from "../../support/testDb.js";
import { deleteSeededEvents, seedEvent } from "../../support/seedEvent.js";
import { EVENT_END } from "../../support/eventDates.js";
import { insertChangeRequest } from "../../../src/modules/change/repo/changeRequests.js";
import { decideChangeRequest } from "../../../src/modules/change/repo/decisions.js";

/** S2 repo checks, against real Postgres with change/0001 to 0003 applied (CI's throwaway database). */

const sql = testDb();
const OWNER = "a5555555-0000-4000-8000-0000000000a1";
const C1 = "a5555555-0000-4000-8000-0000000000a2";
const C2 = "a5555555-0000-4000-8000-0000000000a3";
const coordinator = { userId: C1, role: "EVENT_COORDINATOR" as const };

async function clean() {
  const events = sql`select id from event.events where owner_id = ${OWNER}`;
  const requests = sql`select id from change.change_requests where event_id in (${events})`;
  await sql`delete from change.outbox where message_key in (select id::text from (${events}) e)`;
  await sql`delete from change.change_request_fields where request_id in (${requests})`;
  await sql`delete from change.change_requests where event_id in (${events})`;
  await deleteSeededEvents(sql, [OWNER]);
}
beforeEach(clean);
afterAll(async () => {
  await clean();
  await sql.end();
});

/** An Approved event assigned to C1, with a pending request moving the start an hour later and attendance to 180. */
async function fixture(status: "APPROVED" | "CANCELLED" = "APPROVED") {
  const eventId = await seedEvent(sql, { ownerId: OWNER, status, endsAt: new Date(EVENT_END), name: "S2 repo event" });
  await sql`insert into event.assignments (event_id, coordinator_id, assignment_rule) values (${eventId}, ${C1}, 'TEST_FIXTURE')`;
  const [row] = await sql<{ reference: string; start: Date }[]>`
    select reference, proposed_start_at as start from event.events where id = ${eventId}`;
  const start = row!.start.toISOString();
  const later = new Date(row!.start.getTime() + 3_600_000).toISOString();
  const request = await sql.begin((tx) =>
    insertChangeRequest(tx, {
      event: { id: eventId, reference: row!.reference },
      reason: "Keynote late",
      changes: { proposedStartAt: later, expectedAttendance: 180 },
      current: { proposedStartAt: start, expectedAttendance: 150 },
      actorId: OWNER,
    })
  );
  return { eventId, request, start, later };
}

const decide = (requestId: string, decision: Parameters<typeof decideChangeRequest>[2], actor: Parameters<typeof decideChangeRequest>[3] = coordinator) =>
  sql.begin((tx) => decideChangeRequest(tx, requestId, decision, actor));
const eventRow = async (id: string) =>
  (await sql<{ version: number; attendance: number; start: Date }[]>`
    select version, expected_attendance as attendance, proposed_start_at as start from event.events where id = ${id}`)[0]!;
const historyCount = async (id: string) =>
  Number((await sql`select count(*) from event.event_history where event_id = ${id} and entry_type = 'FIELD_CHANGE'`)[0]!.count);
const outboxTypes = async (id: string) =>
  (await sql<{ type: string }[]>`select envelope->>'type' as type from change.outbox where message_key = ${id}`).map((r) => r.type);

describe("decideChangeRequest", () => {
  it("approves: applies the values, records the history and the decision, and tells the owner", async () => {
    const { eventId, request, later } = await fixture();
    const before = await eventRow(eventId);

    const outcome = await decide(request.id, { decision: "APPROVE" });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.request).toMatchObject({ status: "APPROVED", decidedBy: C1, rejectionReason: null });
    expect(outcome.request.decidedAt).toEqual(expect.any(String));
    expect(outcome.event).toMatchObject({ id: eventId, proposedStartAt: later, expectedAttendance: 180 });
    const after = await eventRow(eventId);
    expect(after.attendance).toBe(180);
    expect(after.start.toISOString()).toBe(later);
    expect(after.version).toBe(before.version + 1);
    expect(await historyCount(eventId)).toBe(2);
    expect(await outboxTypes(eventId)).toEqual(["change-request.approved"]);
  });

  it("rejects: records the decision and reason, leaves the event alone, and tells the owner", async () => {
    const { eventId, request } = await fixture();
    const before = await eventRow(eventId);

    const outcome = await decide(request.id, { decision: "REJECT", reason: "No larger hall" });

    expect(outcome.ok && outcome.request).toMatchObject({ status: "REJECTED", decidedBy: C1, rejectionReason: "No larger hall" });
    expect(outcome.ok && outcome.event).toBeUndefined();
    expect(await eventRow(eventId)).toEqual(before);
    expect(await historyCount(eventId)).toBe(0);
    expect(await outboxTypes(eventId)).toEqual(["change-request.rejected"]);
  });

  it("refuses a request that was already decided, naming the decision, and changes nothing", async () => {
    const { eventId, request } = await fixture();
    const first = await decide(request.id, { decision: "REJECT", reason: "No" });
    const decidedAt = first.ok ? first.request.decidedAt : null;

    const again = await decide(request.id, { decision: "APPROVE" });

    expect(again).toEqual({ ok: false, code: "ALREADY_DECIDED", status: "REJECTED", decidedAt });
    expect(await historyCount(eventId)).toBe(0);
    expect(await outboxTypes(eventId)).toEqual(["change-request.rejected"]);
  });

  it("records the history rows of an approval with the coordinator and the decision's own time", async () => {
    const { eventId, request, start, later } = await fixture();

    const outcome = await decide(request.id, { decision: "APPROVE" });
    const decidedAt = outcome.ok ? outcome.request.decidedAt : null;

    const rows = await sql<{ field_name: string; previous_value: string; new_value: string; actor_user_id: string; actor_role: string; at: Date }[]>`
      select field_name, previous_value, new_value, actor_user_id, actor_role, occurred_at as at
      from event.event_history where event_id = ${eventId} and entry_type = 'FIELD_CHANGE' order by field_name`;
    expect(rows.map((r) => ({ ...r, at: r.at.toISOString() }))).toEqual([
      { field_name: "expectedAttendance", previous_value: "150", new_value: "180", actor_user_id: C1, actor_role: "EVENT_COORDINATOR", at: decidedAt },
      { field_name: "proposedStartAt", previous_value: start, new_value: later, actor_user_id: C1, actor_role: "EVENT_COORDINATOR", at: decidedAt },
    ]);
  });

  it("refuses a second decision after an approval, naming it, and writes nothing more", async () => {
    const { eventId, request } = await fixture();
    const first = await decide(request.id, { decision: "APPROVE" });
    const version = (await eventRow(eventId)).version;

    const again = await decide(request.id, { decision: "REJECT", reason: "Too late" });

    expect(again).toEqual({ ok: false, code: "ALREADY_DECIDED", status: "APPROVED", decidedAt: first.ok ? first.request.decidedAt : null });
    expect((await eventRow(eventId)).version).toBe(version);
    expect(await historyCount(eventId)).toBe(2);
    expect(await outboxTypes(eventId)).toEqual(["change-request.approved"]);
  });

  it("tells the requester, and a rejection carries its reason", async () => {
    const { eventId, request } = await fixture();
    await sql`update event.events set owner_id = ${C2} where id = ${eventId}`;

    const outcome = await decide(request.id, { decision: "REJECT", reason: "No larger hall" });

    const [row] = await sql<{ data: Record<string, unknown> }[]>`select envelope->'data' as data from change.outbox where message_key = ${eventId}`;
    expect(row!.data).toEqual({
      eventId,
      eventReference: request.eventReference,
      eventName: "S2 repo event",
      ownerId: OWNER,
      changeRequestId: request.id,
      fields: ["proposedStartAt", "expectedAttendance"],
      decidedBy: C1,
      decidedAt: outcome.ok ? outcome.request.decidedAt : null,
      reason: "No larger hall",
    });
    await sql`update event.events set owner_id = ${OWNER} where id = ${eventId}`;
  });

  it("refuses a coordinator who is not assigned, to approve or to reject, and an unknown request", async () => {
    const { request: other } = await fixture();
    expect(await decide(other.id, { decision: "REJECT", reason: "x" }, { userId: C2, role: "EVENT_COORDINATOR" })).toEqual({ ok: false, code: "NOT_ASSIGNED" });
  });

  it("refuses a coordinator who is not assigned, and an unknown request", async () => {
    const { eventId, request } = await fixture();

    expect(await decide(request.id, { decision: "APPROVE" }, { userId: C2, role: "EVENT_COORDINATOR" })).toEqual({ ok: false, code: "NOT_ASSIGNED" });
    expect(await decide(randomUUID(), { decision: "APPROVE" })).toEqual({ ok: false, code: "NOT_FOUND" });
    expect(await historyCount(eventId)).toBe(0);
    expect(await outboxTypes(eventId)).toEqual([]);
  });

  it("treats an event outside the actor's scope as not found", async () => {
    const { request } = await fixture();

    const stranger = { userId: randomUUID(), role: "EVENT_ORGANISER" as const };
    expect(await decide(request.id, { decision: "APPROVE" }, stranger)).toEqual({ ok: false, code: "NOT_FOUND" });
  });

  it("refuses an approval whose proposed start has passed, naming changes.proposedStartAt, but still allows a rejection", async () => {
    const { eventId, request } = await fixture();
    const past = new Date(Date.now() - 86_400_000).toISOString();
    await sql`update change.change_request_fields set proposed_value = ${JSON.stringify(past)}::text::jsonb
      where request_id = ${request.id} and field_name = 'proposedStartAt'`;
    const before = await eventRow(eventId);

    const refused = await decide(request.id, { decision: "APPROVE" });

    expect(refused).toMatchObject({ ok: false, code: "NO_LONGER_VALID" });
    expect(refused.ok === false && refused.code === "NO_LONGER_VALID" && refused.fields.map((f) => f.field)).toContain("changes.proposedStartAt");
    expect(await eventRow(eventId)).toEqual(before);
    expect(await historyCount(eventId)).toBe(0);
    expect(await outboxTypes(eventId)).toEqual([]);
    expect((await sql`select status from change.change_requests where id = ${request.id}`)[0]!.status).toBe("PENDING");

    expect(await decide(request.id, { decision: "REJECT", reason: "The new time has passed" })).toMatchObject({ ok: true });
  });

  it("refuses an approval when the event changed after the request was made, but still allows a rejection", async () => {
    const { eventId, request, start } = await fixture();
    const amended = new Date(Date.parse(start) + 30 * 60_000).toISOString();
    await sql`update event.events set proposed_start_at = ${amended} where id = ${eventId}`;
    const before = await eventRow(eventId);

    const refused = await decide(request.id, { decision: "APPROVE" });

    expect(refused).toMatchObject({ ok: false, code: "NO_LONGER_VALID" });
    expect(refused.ok === false && refused.code === "NO_LONGER_VALID" && refused.fields.map((f) => f.field)).toEqual(["changes.proposedStartAt"]);
    expect(await eventRow(eventId)).toEqual(before);
    expect(await historyCount(eventId)).toBe(0);
    expect(await outboxTypes(eventId)).toEqual([]);

    expect(await decide(request.id, { decision: "REJECT", reason: "The event changed" })).toMatchObject({ ok: true });
  });

  it("refuses an approval once the event is no longer changeable", async () => {
    const { eventId, request } = await fixture("CANCELLED");

    expect(await decide(request.id, { decision: "APPROVE" })).toMatchObject({ ok: false, code: "NO_LONGER_VALID", status: "CANCELLED" });
    expect(await historyCount(eventId)).toBe(0);
  });
});
