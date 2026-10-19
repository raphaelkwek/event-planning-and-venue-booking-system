import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { KAFKA_TOPICS, parseCloudEvent, type EventStatus } from "@connectsphere/contracts";
import { notificationsFor } from "../../../../notification/src/domain/recipients.js";
import { testDb } from "../../support/testDb.js";
import { actorsWithPrefix } from "../../support/lineFixtures.js";
import { deleteSeededEvents, seedEvent } from "../../support/seedEvent.js";
import { EVENT_END, EVENT_START } from "../../support/eventDates.js";

// The S1 cards (tests/S1): real Express app and migrated Postgres, with JWT verification and the
// identity lookups replaced. The event module's own read (GET /api/v1/events/:id) is used to prove
// the event is unchanged, so its identity lookup is replaced too. S1-T9 passes the stored message
// through the notification service's recipient rule, the function that turns a message into a notification.
vi.mock("../../../src/shared/auth/verifyJwt.js", () => ({
  verifyJwt: (req: { auth?: { supabaseUserId?: string } }, _res: unknown, next: () => void) => {
    req.auth = { supabaseUserId: "s1-card-subject" };
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
const A = actorsWithPrefix("0c100000");
const ORG2 = "0c100000-0000-4000-8000-000000000007";
const bearer = { Authorization: "Bearer s1-card-token" };
const SLACK_MS = 2_000;
const UNKNOWN_EVENT = "00000000-0000-0000-0000-0000000000ff";

type Role = "EVENT_COORDINATOR" | "TECH_SUPPORT_STAFF" | "EVENT_ORGANISER" | "VENUE_STAFF" | "ATTENDEE";
function signedInAs(userId: string, role: Role) {
  const user = { id: userId, email: "s1@connectsphere.test", role };
  vi.mocked(resolveChangeUser).mockResolvedValue(user);
  vi.mocked(resolveEventUser).mockResolvedValue(user);
}
const asOrg = () => signedInAs(A.org, "EVENT_ORGANISER");
const asOrg2 = () => signedInAs(ORG2, "EVENT_ORGANISER");
const asC1 = () => signedInAs(A.c1, "EVENT_COORDINATOR");
const asTs = () => signedInAs(A.ts, "TECH_SUPPORT_STAFF");
const asVs = () => signedInAs(A.vs, "VENUE_STAFF");

/** "D hh:mm" of the cards: UTC on day D, sixty days ahead (tests/support/eventDates.ts). */
const D = EVENT_START.slice(0, 10);
const at = (hhmm: string) => `${D}T${hhmm}:00.000Z`;

/** FX-S1's event: owned by ORG, assigned to C1, D 14:00 to D 18:00, 150 attending, no requirements. */
async function eventIn(status: EventStatus, name = "S1 fixture event") {
  const id = await seedEvent(sql, { ownerId: A.org, status, endsAt: new Date(EVENT_END), name });
  await sql`
    insert into event.assignments (event_id, coordinator_id, assignment_rule)
    values (${id}, ${A.c1}, 'TEST_FIXTURE')
  `;
  const [row] = await sql<{ reference: string }[]>`select reference from event.events where id = ${id}`;
  return { id, reference: row!.reference, name };
}

async function clean() {
  const events = sql`select id from event.events where owner_id in ${sql([A.org, ORG2])}`;
  const requests = sql`select id from change.change_requests where event_id in (${events})`;
  await sql`delete from change.outbox where message_key in (select id::text from (${events}) e)`;
  await sql`delete from change.change_request_fields where request_id in (${requests})`;
  await sql`delete from change.change_requests where event_id in (${events})`;
  await deleteSeededEvents(sql, [A.org, ORG2]);
}

let e1: { id: string; reference: string; name: string };

beforeAll(clean);
beforeEach(async () => {
  await clean();
  e1 = await eventIn("APPROVED");
  asOrg();
});
afterAll(async () => {
  await clean();
  await sql.end();
});

const post = (eventId: string, body: unknown) =>
  request(app).post(`/api/v1/events/${eventId}/change-requests`).set(bearer).send(body as object);
const list = (eventId: string) => request(app).get(`/api/v1/events/${eventId}/change-requests`).set(bearer);
const readEvent = (eventId: string) => request(app).get(`/api/v1/events/${eventId}`).set(bearer);
const storedCount = async (...eventIds: string[]) =>
  Number((await sql`select count(*) from change.change_requests where event_id in ${sql(eventIds)}`)[0]!.count);
const fieldNames = (response: request.Response) =>
  (response.body.error.fields as { field: string }[]).map((entry) => entry.field).sort();
/** One field of a change request: from a response (`response.body`) or from a listed item. */
const fieldOf = (source: request.Response | { fields: unknown }, name: string) =>
  (("body" in source ? source.body.fields : source.fields) as { fieldName: string; currentValue: unknown; proposedValue: unknown }[]).find(
    (entry) => entry.fieldName === name,
  );

const KEYNOTE = {
  reason: "Keynote speaker arrives late",
  changes: { proposedStartAt: at("15:00"), expectedAttendance: 180 },
};

describe("S1 cards: requesting a change to an event", () => {
  it("S1-T1 records a Pending request with a snapshot of each current value and leaves the event unchanged", async () => {
    const before = Date.now();
    const response = await post(e1.id, KEYNOTE);
    const after = Date.now();

    expect(response.status).toBe(201);
    expect(response.body.id).toEqual(expect.any(String));
    expect(response.body).toMatchObject({
      status: "PENDING",
      reason: "Keynote speaker arrives late",
      requestedBy: A.org,
    });
    expect(new Date(response.body.requestedAt).getTime()).toBeGreaterThanOrEqual(before - SLACK_MS);
    expect(new Date(response.body.requestedAt).getTime()).toBeLessThanOrEqual(after + SLACK_MS);
    expect(response.body.fields).toHaveLength(2);
    expect(fieldOf(response, "proposedStartAt")).toMatchObject({ currentValue: at("14:00"), proposedValue: at("15:00") });
    expect(fieldOf(response, "expectedAttendance")).toMatchObject({ currentValue: 150, proposedValue: 180 });

    const opened = await readEvent(e1.id);
    expect(opened.status).toBe(200);
    expect(new Date(opened.body.proposedStartAt).toISOString()).toBe(at("14:00"));
    expect(opened.body.expectedAttendance).toBe(150);
  });

  it("S1-T2 accepts a request in each of the seven allowed statuses", async () => {
    const statuses: EventStatus[] = [
      "SUBMITTED",
      "UNDER_REVIEW",
      "AWAITING_CLARIFICATION",
      "APPROVED",
      "PLANNING",
      "SAFETY_REVIEW",
      "CONFIRMED",
    ];
    for (const status of statuses) {
      const event = await eventIn(status, `S1-T2 ${status}`);
      const response = await post(event.id, { reason: "x", changes: { expectedAttendance: 160 } });

      expect(response.status, status).toBe(201);
      expect(response.body.status, status).toBe("PENDING");
      expect(response.body.fields, status).toHaveLength(1);
      expect(fieldOf(response, "expectedAttendance"), status).toMatchObject({ currentValue: 150, proposedValue: 160 });
    }
  });

  it("S1-T3 refuses a request in Draft, Completed, Cancelled and Rejected and stores nothing", async () => {
    const cases: { status: EventStatus; label: string }[] = [
      { status: "DRAFT", label: "Draft" },
      { status: "COMPLETED", label: "Completed" },
      { status: "CANCELLED", label: "Cancelled" },
      { status: "REJECTED", label: "Rejected" },
    ];
    const ids: string[] = [];
    for (const { status, label } of cases) {
      const event = await eventIn(status, `S1-T3 ${status}`);
      ids.push(event.id);
      const response = await post(event.id, { reason: "x", changes: { expectedAttendance: 160 } });

      expect(response.status, status).toBe(409);
      expect(response.body.error.code, status).toBe("EVENT_NOT_CHANGEABLE");
      expect(response.body.error.message, status).toContain(label);
      expect(response.body.error.details, status).toMatchObject({ status });
    }
    expect(await storedCount(...ids)).toBe(0);
  });

  it("S1-T4 refuses a second pending request, names the pending one and keeps it unchanged", async () => {
    const first = await post(e1.id, KEYNOTE);
    expect(first.status).toBe(201);

    const second = await post(e1.id, { reason: "Also more people", changes: { expectedAttendance: 200 } });

    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe("CHANGE_REQUEST_ALREADY_PENDING");
    expect(second.body.error.message).toContain(first.body.requestedAt);
    expect(second.body.error.details).toEqual({
      id: first.body.id,
      requestedAt: first.body.requestedAt,
      fields: ["proposedStartAt", "expectedAttendance"],
    });
    expect(await storedCount(e1.id)).toBe(1);
    const stored = await list(e1.id);
    expect(stored.body.items).toEqual([first.body]);
  });

  it("S1-T5 refuses a missing, empty or blank reason on the reason field and stores nothing", async () => {
    const changes = { proposedStartAt: at("15:00"), expectedAttendance: 180 };
    for (const body of [{ changes }, { reason: "", changes }, { reason: "   ", changes }]) {
      const response = await post(e1.id, body);
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_FAILED");
      expect(fieldNames(response)).toEqual(["reason"]);
    }
    // A blank reason does not hide a bad proposed value: both are reported together.
    const both = await post(e1.id, { reason: " ", changes: { expectedAttendance: 0 } });
    expect(both.status).toBe(400);
    expect(fieldNames(both)).toEqual(["changes.expectedAttendance", "reason"]);
    expect(await storedCount(e1.id)).toBe(0);
  });

  it("S1-T6 refuses each invalid proposed value on the field it affects and stores nothing", async () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const cases: { name: string; changes: Record<string, unknown>; fields: string[] }[] = [
      { name: "a", changes: { proposedStartAt: yesterday }, fields: ["changes.proposedStartAt"] },
      { name: "b", changes: { proposedEndAt: at("13:00") }, fields: ["changes.proposedEndAt"] },
      { name: "c", changes: { proposedStartAt: at("19:00") }, fields: ["changes.proposedEndAt"] },
      { name: "d", changes: { expectedAttendance: 0 }, fields: ["changes.expectedAttendance"] },
      { name: "e", changes: { expectedAttendance: 2.5 }, fields: ["changes.expectedAttendance"] },
      {
        name: "f",
        changes: { proposedStartAt: yesterday, expectedAttendance: 0 },
        fields: ["changes.expectedAttendance", "changes.proposedStartAt"],
      },
    ];
    for (const { name, changes, fields } of cases) {
      const response = await post(e1.id, { reason: "x", changes });
      expect(response.status, name).toBe(400);
      expect(response.body.error.code, name).toBe("VALIDATION_FAILED");
      expect(fieldNames(response), name).toEqual(fields);
    }
    expect(await storedCount(e1.id)).toBe(0);
  });

  it("S1-T7 refuses a field outside the six, an empty changes object and a missing one, and stores nothing", async () => {
    const outside = await post(e1.id, { reason: "x", changes: { purpose: "New" } });
    expect(outside.status).toBe(400);
    expect(outside.body.error.code).toBe("VALIDATION_FAILED");
    expect(outside.body.error.fields).toEqual([{ field: "changes.purpose", message: "Change this through Edit details." }]);

    for (const body of [{ reason: "x", changes: {} }, { reason: "x" }]) {
      const response = await post(e1.id, body);
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_FAILED");
      expect(response.body.error.fields).toEqual([{ field: "changes", message: "Propose at least one change." }]);
    }
    expect(await storedCount(e1.id)).toBe(0);
  });

  it("S1-T8 accepts an attendance of 1 and a start one minute from now", async () => {
    const attendance = await post(e1.id, { reason: "x", changes: { expectedAttendance: 1 } });
    expect(attendance.status).toBe(201);
    expect(attendance.body.fields).toHaveLength(1);
    expect(fieldOf(attendance, "expectedAttendance")).toMatchObject({ currentValue: 150, proposedValue: 1 });

    const fresh = await eventIn("APPROVED", "S1-T8 fresh fixture");
    const soon = new Date(Date.now() + 60_000).toISOString();
    const later = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    const window = await post(fresh.id, { reason: "x", changes: { proposedStartAt: soon, proposedEndAt: later } });
    expect(window.status).toBe(201);
    expect(window.body.fields).toHaveLength(2);
    expect(fieldOf(window, "proposedStartAt")).toMatchObject({ currentValue: at("14:00"), proposedValue: soon });
    expect(fieldOf(window, "proposedEndAt")).toMatchObject({ currentValue: at("18:00"), proposedValue: later });
  });

  it("S1-T9 writes one message on the event topic that notifies the assigned coordinator", async () => {
    const response = await post(e1.id, KEYNOTE);
    expect(response.status).toBe(201);

    const messages = await sql`select * from change.outbox where message_key = ${e1.id} order by seq`;
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ topic: KAFKA_TOPICS.event, message_key: e1.id });
    const stored = parseCloudEvent(messages[0]!.envelope);
    expect(stored.type).toBe("change-request.submitted");
    expect(stored.data).toMatchObject({
      eventId: e1.id,
      eventReference: e1.reference,
      coordinatorId: A.c1,
      changeRequestId: response.body.id,
      fields: ["proposedStartAt", "expectedAttendance"],
    });

    const notifications = notificationsFor(stored);
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({ recipientUserId: A.c1, eventId: e1.id, eventReference: e1.reference });
    expect(notifications[0]!.message).toContain(e1.reference);
    expect(notifications[0]!.message).toContain("start");
    expect(notifications[0]!.message).toContain("expected attendance");
  });

  it("S1-T10 lets only the owning organiser request a change", async () => {
    const body = { reason: "x", changes: { expectedAttendance: 160 } };

    asOrg2();
    const other = await post(e1.id, body);
    expect(other.status).toBe(404);
    expect(other.body.error.code).toBe("EVENT_NOT_FOUND");

    for (const signIn of [asC1, asTs, asVs]) {
      signIn();
      const refused = await post(e1.id, body);
      expect(refused.status).toBe(403);
      expect(refused.body.error.code).toBe("ROLE_NOT_AUTHORISED");
    }

    asOrg();
    const unknown = await post(UNKNOWN_EVENT, body);
    expect(unknown.status).toBe(404);
    expect(unknown.body.error.code).toBe("EVENT_NOT_FOUND");

    expect(await storedCount(e1.id)).toBe(0);
  });

  it("S1-T11 lists the pending request with its snapshots for the organiser and the coordinator, event unchanged", async () => {
    const created = await post(e1.id, KEYNOTE);
    expect(created.status).toBe(201);

    for (const signIn of [asOrg, asC1]) {
      signIn();
      const listed = await list(e1.id);
      expect(listed.status).toBe(200);
      expect(listed.body.items).toHaveLength(1);
      expect(listed.body.items[0]).toMatchObject({
        id: created.body.id,
        status: "PENDING",
        reason: "Keynote speaker arrives late",
      });
      expect(listed.body.items[0].fields).toHaveLength(2);
      expect(fieldOf(listed.body.items[0], "proposedStartAt")).toMatchObject({
        currentValue: at("14:00"),
        proposedValue: at("15:00"),
      });
      expect(fieldOf(listed.body.items[0], "expectedAttendance")).toMatchObject({ currentValue: 150, proposedValue: 180 });
    }

    asOrg();
    const opened = await readEvent(e1.id);
    expect(opened.status).toBe(200);
    expect(new Date(opened.body.proposedStartAt).toISOString()).toBe(at("14:00"));
    expect(opened.body.expectedAttendance).toBe(150);
  });

  it("S1-T12 keeps the shapes of the venue and equipment requirements", async () => {
    const venueRequirements = { layout: "Theatre", facilities: ["Stage", "Microphone"], notes: "Step-free access" };
    const equipmentRequirements = [{ equipmentType: "Folding Chairs", quantity: 40, notes: "Rows of 10" }];
    const valid = await post(e1.id, {
      reason: "x",
      changes: { venueRequirements, equipmentRequired: true, equipmentRequirements },
    });

    expect(valid.status).toBe(201);
    expect(valid.body.fields).toHaveLength(3);
    expect(fieldOf(valid, "venueRequirements")).toEqual({
      fieldName: "venueRequirements",
      currentValue: null,
      proposedValue: venueRequirements,
    });
    expect(fieldOf(valid, "equipmentRequired")).toEqual({
      fieldName: "equipmentRequired",
      currentValue: false,
      proposedValue: true,
    });
    expect(fieldOf(valid, "equipmentRequirements")).toEqual({
      fieldName: "equipmentRequirements",
      currentValue: null,
      proposedValue: equipmentRequirements,
    });

    // A fresh FX-S1: the request above is still pending on E1.
    const fresh = await eventIn("APPROVED", "S1-T12 fresh fixture");
    const malformed = await post(fresh.id, { reason: "x", changes: { venueRequirements: "big room" } });
    expect(malformed.status).toBe(400);
    expect(malformed.body.error.code).toBe("VALIDATION_FAILED");
    expect(fieldNames(malformed)).toEqual(["changes.venueRequirements"]);
    expect(await storedCount(fresh.id)).toBe(0);
  });

  it("stores a start written with an offset as a UTC instant", async () => {
    const response = await post(e1.id, { reason: "x", changes: { proposedStartAt: `${D}T23:00:00+08:00` } });
    expect(response.status).toBe(201);
    expect(fieldOf(response, "proposedStartAt")).toMatchObject({ currentValue: at("14:00"), proposedValue: at("15:00") });
  });
});
