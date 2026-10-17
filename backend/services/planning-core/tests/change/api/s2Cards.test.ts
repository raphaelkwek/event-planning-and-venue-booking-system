import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { KAFKA_TOPICS, parseCloudEvent, type EventStatus } from "@connectsphere/contracts";
import { notificationsFor } from "../../../../notification/src/domain/recipients.js";
import { testDb } from "../../support/testDb.js";
import { actorsWithPrefix } from "../../support/lineFixtures.js";
import { deleteSeededEvents, seedEvent } from "../../support/seedEvent.js";
import { EVENT_END, EVENT_START } from "../../support/eventDates.js";

// The S2 cards (tests/S2): real Express app and migrated Postgres, with JWT verification and the
// identity lookups replaced. The event module's own read (GET /api/v1/events/:id) and edit
// (PATCH, G1) are used as the cards use them, so its identity lookup is replaced too. S2-T8 passes
// the stored message through the notification service's recipient rule.
vi.mock("../../../src/shared/auth/verifyJwt.js", () => ({
  verifyJwt: (req: { auth?: { supabaseUserId?: string } }, _res: unknown, next: () => void) => {
    req.auth = { supabaseUserId: "s2-card-subject" };
    next();
  },
}));
vi.mock("../../../src/modules/change/auth/identity.js", async () => {
  const actual = await vi.importActual<typeof import("../../../src/modules/change/auth/identity.js")>(
    "../../../src/modules/change/auth/identity.js",
  );
  return { ...actual, resolveCurrentUser: vi.fn() };
});
vi.mock("../../../src/modules/event/auth/identity.js", async () => {
  const actual = await vi.importActual<typeof import("../../../src/modules/event/auth/identity.js")>(
    "../../../src/modules/event/auth/identity.js",
  );
  return { ...actual, resolveCurrentUser: vi.fn() };
});

const { resolveCurrentUser: resolveChangeUser } = await import("../../../src/modules/change/auth/identity.js");
const { resolveCurrentUser: resolveEventUser } = await import("../../../src/modules/event/auth/identity.js");
const { app } = await import("../../../src/app.js");

const sql = testDb();
const A = actorsWithPrefix("0c200000");
const bearer = { Authorization: "Bearer s2-card-token" };
const SLACK_MS = 2_000;

type Role = "EVENT_COORDINATOR" | "TECH_SUPPORT_STAFF" | "EVENT_ORGANISER" | "VENUE_STAFF" | "ATTENDEE";
function signedInAs(userId: string, role: Role) {
  const user = { id: userId, email: "s2@connectsphere.test", role };
  vi.mocked(resolveChangeUser).mockResolvedValue(user);
  vi.mocked(resolveEventUser).mockResolvedValue(user);
}
const asOrg = () => signedInAs(A.org, "EVENT_ORGANISER");
const asC1 = () => signedInAs(A.c1, "EVENT_COORDINATOR");
const asC2 = () => signedInAs(A.c2, "EVENT_COORDINATOR");
const asTs = () => signedInAs(A.ts, "TECH_SUPPORT_STAFF");
const asVs = () => signedInAs(A.vs, "VENUE_STAFF");

/** "D hh:mm" of the cards: UTC on day D, sixty days ahead (tests/support/eventDates.ts). */
const D = EVENT_START.slice(0, 10);
const at = (hhmm: string) => `${D}T${hhmm}:00.000Z`;

/** FX-S1's event: owned by ORG, assigned to C1, D 14:00 to D 18:00, 150 attending, no requirements. */
async function eventIn(status: EventStatus, name = "S2 fixture event") {
  const id = await seedEvent(sql, { ownerId: A.org, status, endsAt: new Date(EVENT_END), name });
  await sql`
    insert into event.assignments (event_id, coordinator_id, assignment_rule)
    values (${id}, ${A.c1}, 'TEST_FIXTURE')
  `;
  const [row] = await sql<{ reference: string }[]>`select reference from event.events where id = ${id}`;
  return { id, reference: row!.reference, name };
}

async function clean() {
  const events = sql`select id from event.events where owner_id = ${A.org}`;
  const requests = sql`select id from change.change_requests where event_id in (${events})`;
  await sql`delete from change.outbox where message_key in (select id::text from (${events}) e)`;
  await sql`delete from change.change_request_fields where request_id in (${requests})`;
  await sql`delete from change.change_requests where event_id in (${events})`;
  await deleteSeededEvents(sql, [A.org]);
}

const KEYNOTE = {
  reason: "Keynote speaker arrives late",
  changes: { proposedStartAt: at("15:00"), expectedAttendance: 180 },
};

const post = (eventId: string, body: unknown) =>
  request(app).post(`/api/v1/events/${eventId}/change-requests`).set(bearer).send(body as object);
const decide = (requestId: string, body: unknown) =>
  request(app).post(`/api/v1/change-requests/${requestId}/decision`).set(bearer).send(body as object);
const readEvent = (eventId: string) => request(app).get(`/api/v1/events/${eventId}`).set(bearer);

/** FX-S2: a fresh Approved event with ORG's pending KEYNOTE request, made through the real route. */
async function fixture(name = "S2 fixture event") {
  const event = await eventIn("APPROVED", name);
  asOrg();
  const created = await post(event.id, KEYNOTE);
  expect(created.status).toBe(201);
  return { event, cr: created.body.id as string };
}

/** What a refused or rejected decision must leave exactly as it was. */
async function eventState(eventId: string) {
  const [row] = await sql<{ version: number; status: string; start: string; attendance: number }[]>`
    select version, status, to_char(proposed_start_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS".000Z"') as start,
           expected_attendance as attendance
    from event.events where id = ${eventId}
  `;
  const [history] = await sql<{ n: number }[]>`
    select count(*)::int as n from event.event_history where event_id = ${eventId} and entry_type = 'FIELD_CHANGE'
  `;
  return { ...row!, fieldChanges: history!.n };
}

async function storedRequest(requestId: string) {
  const [row] = await sql<
    { status: string; decided_by: string | null; decided_at: Date | null; rejection_reason: string | null }[]
  >`select status, decided_by, decided_at, rejection_reason from change.change_requests where id = ${requestId}`;
  return row!;
}
const stillPending = async (requestId: string) =>
  expect(await storedRequest(requestId)).toEqual({ status: "PENDING", decided_by: null, decided_at: null, rejection_reason: null });

const fieldNames = (response: request.Response) =>
  (response.body.error.fields as { field: string }[]).map((entry) => entry.field).sort();

async function outboxTypes(eventId: string) {
  const rows = await sql`select * from change.outbox where message_key = ${eventId} order by seq`;
  return rows.map((row) => ({ row, message: parseCloudEvent(row.envelope) }));
}

let e1: { id: string; reference: string; name: string };
let cr1: string;

beforeAll(clean);
beforeEach(async () => {
  await clean();
  ({ event: e1, cr: cr1 } = await fixture());
  asC1();
});
afterAll(async () => {
  await clean();
  await sql.end();
});

describe("S2 cards: deciding a change request", () => {
  it("S2-T1 approves, applies the change and records each field's history", async () => {
    const before = await eventState(e1.id);
    expect(before).toMatchObject({ start: at("14:00"), attendance: 150, fieldChanges: 0 });

    const started = Date.now();
    const response = await decide(cr1, { decision: "APPROVE" });
    const finished = Date.now();

    expect(response.status).toBe(200);
    expect(response.body.changeRequest).toMatchObject({
      id: cr1,
      status: "APPROVED",
      decidedBy: A.c1,
      rejectionReason: null,
    });
    const decidedAt = new Date(response.body.changeRequest.decidedAt).getTime();
    expect(decidedAt).toBeGreaterThanOrEqual(started - SLACK_MS);
    expect(decidedAt).toBeLessThanOrEqual(finished + SLACK_MS);

    const opened = await readEvent(e1.id);
    expect(opened.status).toBe(200);
    expect(new Date(opened.body.proposedStartAt).toISOString()).toBe(at("15:00"));
    expect(new Date(opened.body.proposedEndAt).toISOString()).toBe(at("18:00"));
    expect(opened.body.expectedAttendance).toBe(180);
    expect(opened.body.version).toBe(before.version + 1);

    const history = await sql<
      {
        field_name: string;
        previous_value: string;
        new_value: string;
        actor_user_id: string;
        actor_role: string;
        occurred_at: Date;
      }[]
    >`
      select field_name, previous_value, new_value, actor_user_id, actor_role, occurred_at
      from event.event_history
      where event_id = ${e1.id} and entry_type = 'FIELD_CHANGE'
      order by field_name
    `;
    expect(history).toHaveLength(2);
    expect(history.map((entry) => [entry.field_name, entry.previous_value, entry.new_value])).toEqual([
      ["expectedAttendance", "150", "180"],
      ["proposedStartAt", at("14:00"), at("15:00")],
    ]);
    for (const entry of history) {
      expect(entry.actor_user_id).toBe(A.c1);
      expect(entry.actor_role).toBe("EVENT_COORDINATOR");
      expect(entry.occurred_at.getTime()).toBeGreaterThanOrEqual(started - SLACK_MS);
      expect(entry.occurred_at.getTime()).toBeLessThanOrEqual(finished + SLACK_MS);
    }
  });

  it("S2-T2 rejects with a reason and leaves the event untouched", async () => {
    const before = await eventState(e1.id);

    const response = await decide(cr1, { decision: "REJECT", reason: "The hall is booked until 15:30" });

    expect(response.status).toBe(200);
    expect(response.body.changeRequest).toMatchObject({
      id: cr1,
      status: "REJECTED",
      decidedBy: A.c1,
      rejectionReason: "The hall is booked until 15:30",
    });
    expect(new Date(response.body.changeRequest.decidedAt).getTime()).not.toBeNaN();

    const opened = await readEvent(e1.id);
    expect(new Date(opened.body.proposedStartAt).toISOString()).toBe(at("14:00"));
    expect(opened.body.expectedAttendance).toBe(150);
    expect(opened.body.version).toBe(before.version);
    const snapshots = await sql<{ field_name: string; current_value: unknown }[]>`
      select field_name, current_value from change.change_request_fields where request_id = ${cr1} order by field_name
    `;
    expect(snapshots.map((row) => [row.field_name, row.current_value])).toEqual([
      ["expectedAttendance", 150],
      ["proposedStartAt", at("14:00")],
    ]);
    expect(await eventState(e1.id)).toEqual(before);
    expect(before.fieldChanges).toBe(0);
  });

  it("S2-T3 refuses a rejection without a reason, with an empty one or a blank one, and changes nothing", async () => {
    const before = await eventState(e1.id);
    for (const body of [{ decision: "REJECT" }, { decision: "REJECT", reason: "" }, { decision: "REJECT", reason: "   " }]) {
      const response = await decide(cr1, body);

      expect(response.status, JSON.stringify(body)).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_FAILED");
      expect(fieldNames(response)).toEqual(["reason"]);
      await stillPending(cr1);
      expect(await eventState(e1.id)).toEqual(before);
    }
  });

  it("S2-T4 refuses a second decision, names the first and leaves it standing", async () => {
    const before = await eventState(e1.id);
    const approved = await decide(cr1, { decision: "APPROVE" });
    expect(approved.status).toBe(200);
    const afterApproval = await eventState(e1.id);
    expect(afterApproval).toMatchObject({ start: at("15:00"), attendance: 180, version: before.version + 1 });

    const again = await decide(cr1, { decision: "APPROVE" });

    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe("CHANGE_REQUEST_ALREADY_DECIDED");
    expect(again.body.error.message).toContain("Approved");
    expect(again.body.error.message).toContain(approved.body.changeRequest.decidedAt);
    expect(again.body.error.details).toEqual({ status: "APPROVED", decidedAt: approved.body.changeRequest.decidedAt });
    expect((await storedRequest(cr1)).status).toBe("APPROVED");
    expect(await eventState(e1.id)).toEqual(afterApproval);

    // A fresh FX-S2 for the rejection.
    const { event: e2, cr: second } = await fixture("S2-T4 fresh fixture");
    asC1();
    const e2Before = await eventState(e2.id);
    const rejected = await decide(second, { decision: "REJECT", reason: "No larger hall" });
    expect(rejected.status).toBe(200);

    const then = await decide(second, { decision: "APPROVE" });

    expect(then.status).toBe(409);
    expect(then.body.error.code).toBe("CHANGE_REQUEST_ALREADY_DECIDED");
    expect(then.body.error.message).toContain("Rejected");
    expect(then.body.error.message).toContain(rejected.body.changeRequest.decidedAt);
    expect(then.body.error.details).toEqual({ status: "REJECTED", decidedAt: rejected.body.changeRequest.decidedAt });
    expect(await storedRequest(second)).toMatchObject({ status: "REJECTED", rejection_reason: "No larger hall" });
    expect(await eventState(e2.id)).toEqual(e2Before);
    expect(e2Before).toMatchObject({ start: at("14:00"), attendance: 150 });
  });

  it("S2-T5 lets only the assigned coordinator decide", async () => {
    const before = await eventState(e1.id);
    const body = { decision: "APPROVE" };

    for (const signIn of [asC2, asOrg, asTs, asVs]) {
      signIn();
      const refused = await decide(cr1, body);
      expect(refused.status).toBe(403);
      expect(refused.body.error.code).toBe("ROLE_NOT_AUTHORISED");
    }

    asC1();
    const unknown = await decide(randomUUID(), body);
    expect(unknown.status).toBe(404);
    expect(unknown.body.error.code).toBe("CHANGE_REQUEST_NOT_FOUND");

    await stillPending(cr1);
    expect(await eventState(e1.id)).toEqual(before);
  });

  it("S2-T6 refuses an approval whose proposed start has since passed, while a rejection still works", async () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    await sql`
      update change.change_request_fields
      set proposed_value = ${JSON.stringify(yesterday)}::text::jsonb
      where request_id = ${cr1} and field_name = 'proposedStartAt'
    `;
    const before = await eventState(e1.id);

    const approval = await decide(cr1, { decision: "APPROVE" });

    expect(approval.status).toBe(409);
    expect(approval.body.error.code).toBe("CHANGE_REQUEST_NO_LONGER_VALID");
    expect((approval.body.error.details.fields as { field: string }[]).map((entry) => entry.field)).toEqual([
      "changes.proposedStartAt",
    ]);
    await stillPending(cr1);
    expect(await eventState(e1.id)).toEqual(before);

    const rejection = await decide(cr1, { decision: "REJECT", reason: "The new time has passed" });

    expect(rejection.status).toBe(200);
    expect(rejection.body.changeRequest).toMatchObject({ status: "REJECTED", rejectionReason: "The new time has passed" });
  });

  it("S2-T7 refuses an approval once the event is cancelled", async () => {
    await sql`update event.events set status = 'CANCELLED' where id = ${e1.id}`;
    const before = await eventState(e1.id);
    expect(before.status).toBe("CANCELLED");

    const response = await decide(cr1, { decision: "APPROVE" });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("CHANGE_REQUEST_NO_LONGER_VALID");
    await stillPending(cr1);
    const after = await eventState(e1.id);
    expect(after).toEqual(before);
    expect(after).toMatchObject({ status: "CANCELLED", start: at("14:00"), attendance: 150, fieldChanges: 0 });
  });

  it("S2-T8 notifies the requesting organiser, and only them, of an approval and of a rejection", async () => {
    const approved = await decide(cr1, { decision: "APPROVE" });
    expect(approved.status).toBe(200);

    const approvals = (await outboxTypes(e1.id)).filter(({ message }) => message.type === "change-request.approved");
    expect(approvals).toHaveLength(1);
    expect(approvals[0]!.row).toMatchObject({ topic: KAFKA_TOPICS.event, message_key: e1.id });
    expect(approvals[0]!.message.data).toMatchObject({ eventId: e1.id, ownerId: A.org, changeRequestId: cr1 });
    const approvalNotices = notificationsFor(approvals[0]!.message);
    expect(approvalNotices).toHaveLength(1);
    expect(approvalNotices[0]).toMatchObject({ recipientUserId: A.org, eventId: e1.id, eventReference: e1.reference });
    expect(approvalNotices[0]!.message).toContain(e1.reference);
    expect(approvalNotices[0]!.message).toContain("start, expected attendance");

    // A fresh FX-S2 for the rejection.
    const { event: e2, cr: second } = await fixture("S2-T8 fresh fixture");
    asC1();
    const rejected = await decide(second, { decision: "REJECT", reason: "No larger hall" });
    expect(rejected.status).toBe(200);

    const rejections = (await outboxTypes(e2.id)).filter(({ message }) => message.type === "change-request.rejected");
    expect(rejections).toHaveLength(1);
    expect(rejections[0]!.row).toMatchObject({ topic: KAFKA_TOPICS.event, message_key: e2.id });
    expect(rejections[0]!.message.data).toMatchObject({ eventId: e2.id, ownerId: A.org, changeRequestId: second });
    expect((await outboxTypes(e2.id)).filter(({ message }) => message.type === "change-request.approved")).toHaveLength(0);
    const rejectionNotices = notificationsFor(rejections[0]!.message);
    expect(rejectionNotices).toHaveLength(1);
    expect(rejectionNotices[0]).toMatchObject({ recipientUserId: A.org, eventId: e2.id, eventReference: e2.reference });
    expect(rejectionNotices[0]!.message).toContain(e2.reference);
    expect(rejectionNotices[0]!.message).toContain("No larger hall");
  });

  it("S2-T9 frees the event for a new request after a decision, and the one-pending rule applies to it", async () => {
    const approved = await decide(cr1, { decision: "APPROVE" });
    expect(approved.status).toBe(200);

    asOrg();
    const body = { reason: "More people registered", changes: { expectedAttendance: 200 } };
    const second = await post(e1.id, body);
    expect(second.status).toBe(201);
    expect(second.body.status).toBe("PENDING");

    const third = await post(e1.id, body);
    expect(third.status).toBe(409);
    expect(third.body.error.code).toBe("CHANGE_REQUEST_ALREADY_PENDING");
    expect(third.body.error.details).toMatchObject({ id: second.body.id });
    expect(third.body.error.message).toContain(second.body.requestedAt);
  });

  it("S2-T10 refuses a details edit carrying the version from before the approval", async () => {
    asOrg();
    const opened = await readEvent(e1.id);
    expect(opened.status).toBe(200);
    const etag = opened.headers.etag as string;
    expect(etag).toEqual(expect.any(String));
    const description = opened.body.description;

    asC1();
    const approved = await decide(cr1, { decision: "APPROVE" });
    expect(approved.status).toBe(200);

    asOrg();
    const edit = await request(app)
      .patch(`/api/v1/events/${e1.id}`)
      .set(bearer)
      .set("If-Match", etag)
      .send({ description: "Updated description after the keynote moved" });

    expect(edit.status).toBe(412);
    expect(edit.body.error.code).toBe("EVENT_VERSION_MISMATCH");
    const reread = await readEvent(e1.id);
    expect(reread.body.description).toBe(description);
    expect(reread.body.expectedAttendance).toBe(180);
    expect(new Date(reread.body.proposedStartAt).toISOString()).toBe(at("15:00"));
  });

  it("S2-T13 refuses to approve a request whose event changed since it was made", async () => {
    await sql`update event.events set proposed_start_at = ${at("14:30")} where id = ${e1.id}`;
    const before = await eventState(e1.id);
    expect(before.start).toBe(at("14:30"));

    const approval = await decide(cr1, { decision: "APPROVE" });

    expect(approval.status).toBe(409);
    expect(approval.body.error.code).toBe("CHANGE_REQUEST_NO_LONGER_VALID");
    expect((approval.body.error.details.fields as { field: string }[]).map((entry) => entry.field)).toEqual([
      "changes.proposedStartAt",
    ]);
    await stillPending(cr1);
    expect(await eventState(e1.id)).toEqual(before);

    const rejection = await decide(cr1, { decision: "REJECT", reason: "The event changed" });

    expect(rejection.status).toBe(200);
    expect(rejection.body.changeRequest).toMatchObject({ status: "REJECTED", rejectionReason: "The event changed" });
    expect((await eventState(e1.id)).start).toBe(at("14:30"));
  });
});
