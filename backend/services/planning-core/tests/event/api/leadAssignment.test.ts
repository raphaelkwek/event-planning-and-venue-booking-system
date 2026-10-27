import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { testDb } from "../../support/testDb.js";
import { EVENT_END, EVENT_START } from "../../support/eventDates.js";

/**
 * E3 (CR-05) — new requests wait, unassigned, until an Event Coordinator Lead
 * assigns one active Event Coordinator. Only the Lead sees the queue; a
 * coordinator neither sees an unassigned request in their queue nor claims it
 * by opening it (W9-35, W9-60).
 */

vi.mock("../../../src/shared/auth/verifyJwt.js", () => ({
  verifyJwt: (req: { auth?: { supabaseUserId?: string } }, _res: unknown, next: () => void) => {
    req.auth = { supabaseUserId: "test-subject" };
    next();
  },
}));

vi.mock("../../../src/modules/event/auth/identity.js", async () => {
  const actual = await vi.importActual<typeof import("../../../src/modules/event/auth/identity.js")>(
    "../../../src/modules/event/auth/identity.js",
  );
  return { ...actual, resolveCurrentUser: vi.fn(), resolveEventsScope: vi.fn() };
});

const { resolveCurrentUser, resolveEventsScope } = await import("../../../src/modules/event/auth/identity.js");
const { app } = await import("../../../src/app.js");

const sql = testDb();
const ORGANISER = "ae300000-0000-0000-0000-000000000001";
const LEAD = "ae300000-0000-0000-0000-000000000002";
const COORDINATOR = "ae300000-0000-0000-0000-000000000003";
const OTHER_COORDINATOR = "ae300000-0000-0000-0000-000000000004";
const RETIRED_COORDINATOR = "ae300000-0000-0000-0000-000000000005";
const STAFF = "ae300000-0000-0000-0000-000000000006";
const USERS: [string, string, string, boolean, string | null][] = [
  [ORGANISER, "EVENT_ORGANISER", "e3-organiser", true, "E3 Organiser"],
  [LEAD, "EVENT_COORDINATOR_LEAD", "e3-lead", true, "E3 Lead"],
  [COORDINATOR, "EVENT_COORDINATOR", "e3-coordinator", true, "E3 Coordinator"],
  [OTHER_COORDINATOR, "EVENT_COORDINATOR", "e3-coordinator2", true, "E3 Second Coordinator"],
  [RETIRED_COORDINATOR, "EVENT_COORDINATOR", "e3-retired", false, "E3 Retired Coordinator"],
  [STAFF, "VENUE_STAFF", "e3-staff", true, "E3 Venue Staff"],
];
const bearer = { Authorization: "Bearer test-token" };

function signedInAs(userId: string, role: string) {
  vi.mocked(resolveCurrentUser).mockResolvedValue({ id: userId, email: "user@connectsphere.test", role: role as never });
  vi.mocked(resolveEventsScope).mockResolvedValue(
    role === "EVENT_ORGANISER" ? { scopeType: "OWNED_BY_USER", userId } : role === "VENUE_STAFF" ? { scopeType: "NONE" } : { scopeType: "ALL" },
  );
}

const validRequest = {
  name: "Annual Research Symposium",
  purpose: "Share faculty research",
  description: "A one-day symposium.",
  proposedStartAt: EVENT_START,
  proposedEndAt: EVENT_END,
  expectedAttendance: 150,
  registrationRequired: false,
  equipmentRequired: false,
};

async function cleanUp() {
  const owned = sql`select id from event.events where owner_id = ${ORGANISER}`;
  await sql`delete from event.event_history where event_id in (${owned})`;
  await sql`delete from event.assignments where event_id in (${owned})`;
  await sql`delete from event.outbox where message_key in (select id::text from event.events where owner_id = ${ORGANISER})`;
  await sql`delete from event.events where owner_id = ${ORGANISER}`;
  const ids = USERS.map(([id]) => id);
  await sql`delete from identity.user_roles where user_id in ${sql(ids)}`;
  await sql`delete from identity.users where id in ${sql(ids)}`;
}

beforeEach(async () => {
  await cleanUp();
  for (const [id, role, name, active, displayName] of USERS) {
    await sql`
      insert into identity.users (id, supabase_user_id, email, is_active, display_name)
      values (${id}, gen_random_uuid(), ${`${name}@connectsphere.test`}, ${active}, ${displayName})
    `;
    await sql`insert into identity.user_roles (user_id, role) values (${id}, ${role})`;
  }
});

afterAll(async () => {
  await cleanUp();
  await sql.end();
});

async function submitted(name = validRequest.name): Promise<{ id: string; reference: string }> {
  signedInAs(ORGANISER, "EVENT_ORGANISER");
  const res = await request(app).post("/api/v1/events").set(bearer).send({ ...validRequest, name });
  expect(res.status).toBe(201);
  return res.body;
}

const unassigned = () => request(app).get("/api/v1/assignments/unassigned").set(bearer);
const coordinators = () => request(app).get("/api/v1/coordinators").set(bearer);
const assign = (eventId: string, coordinatorId: unknown) =>
  request(app).post(`/api/v1/events/${eventId}/assignment`).set(bearer).send({ coordinatorId });
const assignments = (eventId: string) =>
  sql<{ coordinator_id: string; created_by: string; assignment_rule: string; is_active: boolean; assigned_at: Date }[]>`
    select coordinator_id, created_by, assignment_rule, is_active, assigned_at from event.assignments where event_id = ${eventId}
  `;
const outbox = (eventId: string, type: string) =>
  sql<{ envelope: { data: Record<string, unknown> } }[]>`
    select envelope from event.outbox where message_key = ${eventId} and envelope->>'type' = ${type}
  `;

describe("submission assigns no coordinator (E3, replacing E1)", () => {
  it("submits the request with no assignment and no assignment message (E3-T1)", async () => {
    const event = await submitted();

    expect(await assignments(event.id)).toEqual([]);
    expect(await outbox(event.id, "event.coordinator-assigned")).toEqual([]);
    signedInAs(ORGANISER, "EVENT_ORGANISER");
    const shown = await request(app).get(`/api/v1/events/${event.id}`).set(bearer);
    expect(shown.body).toMatchObject({ status: "SUBMITTED", assignedCoordinatorId: null });
  });
});

describe("GET /api/v1/assignments/unassigned (E3)", () => {
  it("lists unassigned requests, oldest submission first, with what the Lead triages on (E3-T2)", async () => {
    const first = await submitted();
    const second = await submitted("Alumni Networking Night");
    await sql`update event.events set submitted_at = submitted_at - interval '1 minute' where id = ${first.id}`;
    signedInAs(LEAD, "EVENT_COORDINATOR_LEAD");

    const res = await unassigned();

    expect(res.status).toBe(200);
    const ours = res.body.items.filter((item: { id: string }) => [first.id, second.id].includes(item.id));
    expect(ours.map((item: { id: string }) => item.id)).toEqual([first.id, second.id]);
    expect(ours[0]).toEqual({
      id: first.id,
      reference: first.reference,
      name: "Annual Research Symposium",
      proposedStartAt: EVENT_START,
      proposedEndAt: EVENT_END,
      expectedAttendance: 150,
      submittedAt: expect.any(String),
      status: "SUBMITTED",
    });
  });

  it("leaves out an assigned request, a draft, and a Rejected, Cancelled or Completed one", async () => {
    const assigned = await submitted();
    const rejected = await submitted("Rejected request");
    await sql`update event.events set status = 'REJECTED' where id = ${rejected.id}`;
    signedInAs(LEAD, "EVENT_COORDINATOR_LEAD");
    expect((await assign(assigned.id, COORDINATOR)).status).toBe(201);

    const ids = (await unassigned()).body.items.map((item: { id: string }) => item.id);
    expect(ids).not.toContain(assigned.id);
    expect(ids).not.toContain(rejected.id);
  });

  it("is refused to every other role, naming none of the requests (E3-T2, A2)", async () => {
    await submitted();
    for (const [userId, role] of [
      [COORDINATOR, "EVENT_COORDINATOR"],
      [ORGANISER, "EVENT_ORGANISER"],
      [STAFF, "VENUE_STAFF"],
      [STAFF, "TECH_SUPPORT_STAFF"],
      [STAFF, "ATTENDEE"],
    ]) {
      signedInAs(userId!, role!);
      const res = await unassigned();
      expect(res.status, role).toBe(403);
      expect(res.body.items, role).toBeUndefined();
    }
  });
});

describe("GET /api/v1/coordinators (E3, E5)", () => {
  it("lists the active Event Coordinators with their names and active assignments, and no one else", async () => {
    const event = await submitted();
    signedInAs(LEAD, "EVENT_COORDINATOR_LEAD");
    await assign(event.id, COORDINATOR);

    const res = await coordinators();

    expect(res.status).toBe(200);
    const byId = new Map(res.body.items.map((c: { id: string }) => [c.id, c]));
    expect(byId.get(COORDINATOR)).toEqual({ id: COORDINATOR, displayName: "E3 Coordinator", email: "e3-coordinator@connectsphere.test", activeAssignments: 1 });
    expect(byId.get(OTHER_COORDINATOR)).toMatchObject({ activeAssignments: 0 });
    for (const excluded of [RETIRED_COORDINATOR, STAFF, LEAD, ORGANISER]) expect(byId.has(excluded), excluded).toBe(false);
  });

  it("is the Lead's alone", async () => {
    signedInAs(COORDINATOR, "EVENT_COORDINATOR");
    expect((await coordinators()).status).toBe(403);
  });
});

describe("POST /api/v1/events/:id/assignment (E3)", () => {
  it("assigns the coordinator, recording them, the Lead and the time, and the request leaves the queue (E3-T4)", async () => {
    const event = await submitted();
    signedInAs(LEAD, "EVENT_COORDINATOR_LEAD");
    const before = Date.now();

    const res = await assign(event.id, OTHER_COORDINATOR);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ eventId: event.id, coordinatorId: OTHER_COORDINATOR, assignedBy: LEAD });
    const [row] = await assignments(event.id);
    expect(row).toMatchObject({ coordinator_id: OTHER_COORDINATOR, created_by: LEAD, assignment_rule: "LEAD", is_active: true });
    expect(row!.assigned_at.getTime()).toBeGreaterThanOrEqual(before - 5000);
    expect((await unassigned()).body.items.map((item: { id: string }) => item.id)).not.toContain(event.id);
  });

  it("tells the coordinator and the owner, naming the coordinator, in the same transaction (E3-T4)", async () => {
    const event = await submitted();
    signedInAs(LEAD, "EVENT_COORDINATOR_LEAD");
    const res = await assign(event.id, OTHER_COORDINATOR);

    const [message] = await outbox(event.id, "event.coordinator-assigned");
    expect(message!.envelope.data).toEqual({
      eventId: event.id,
      eventReference: event.reference,
      eventName: "Annual Research Symposium",
      coordinatorId: OTHER_COORDINATOR,
      coordinatorName: "E3 Second Coordinator",
      ownerId: ORGANISER,
      assignedBy: LEAD,
      assignmentRule: "LEAD",
      assignedAt: res.body.assignedAt,
    });
  });

  it("puts the request in the coordinator's review queue, and shows the organiser their point of contact", async () => {
    const event = await submitted();
    signedInAs(LEAD, "EVENT_COORDINATOR_LEAD");
    await assign(event.id, OTHER_COORDINATOR);

    signedInAs(OTHER_COORDINATOR, "EVENT_COORDINATOR");
    const queue = await request(app).get("/api/v1/events/queue").set(bearer);
    expect(queue.body.items.map((item: { id: string }) => item.id)).toContain(event.id);
    signedInAs(ORGANISER, "EVENT_ORGANISER");
    expect((await request(app).get(`/api/v1/events/${event.id}`).set(bearer)).body.assignedCoordinatorId).toBe(OTHER_COORDINATOR);
  });

  it("refuses anyone but an active Event Coordinator, storing nothing (E3-T5)", async () => {
    const event = await submitted();
    signedInAs(LEAD, "EVENT_COORDINATOR_LEAD");

    for (const candidate of [STAFF, RETIRED_COORDINATOR, LEAD, "00000000-0000-0000-0000-0000000000ff"]) {
      const res = await assign(event.id, candidate);
      expect(res.status, candidate).toBe(400);
      expect(res.body.error).toMatchObject({ code: "NOT_AN_ACTIVE_COORDINATOR", message: "Only an active Event Coordinator can be assigned." });
    }
    const missing = await assign(event.id, undefined);
    expect(missing.status).toBe(400);
    expect(missing.body.error.code).toBe("VALIDATION_FAILED");
    expect(await assignments(event.id)).toEqual([]);
    expect(await outbox(event.id, "event.coordinator-assigned")).toEqual([]);
  });

  it("refuses a second assignment, naming the coordinator already assigned (E3-T6)", async () => {
    const event = await submitted();
    signedInAs(LEAD, "EVENT_COORDINATOR_LEAD");
    await assign(event.id, OTHER_COORDINATOR);

    const res = await assign(event.id, COORDINATOR);

    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({
      code: "ALREADY_ASSIGNED",
      message: "This event is already assigned to E3 Second Coordinator. Reassign it instead.",
    });
    expect((await assignments(event.id)).filter((a) => a.is_active)).toEqual([expect.objectContaining({ coordinator_id: OTHER_COORDINATOR })]);
  });

  it("assigns once when two Leads assign at the same moment", async () => {
    const event = await submitted();
    signedInAs(LEAD, "EVENT_COORDINATOR_LEAD");

    const results = await Promise.all([assign(event.id, COORDINATOR), assign(event.id, OTHER_COORDINATOR)]);

    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect((await assignments(event.id)).filter((a) => a.is_active)).toHaveLength(1);
  });

  it("refuses a draft and a Rejected, Cancelled or Completed event", async () => {
    const event = await submitted();
    signedInAs(LEAD, "EVENT_COORDINATOR_LEAD");
    for (const status of ["REJECTED", "CANCELLED", "COMPLETED", "DRAFT"]) {
      await sql`update event.events set status = ${status} where id = ${event.id}`;
      const res = await assign(event.id, COORDINATOR);
      expect(res.status, status).toBe(409);
      expect(res.body.error.code, status).toBe("STATUS_NOT_ASSIGNABLE");
    }
    expect(await assignments(event.id)).toEqual([]);
  });

  it("answers 404 for an unknown event, and refuses every role but the Lead (A2)", async () => {
    const event = await submitted();
    signedInAs(LEAD, "EVENT_COORDINATOR_LEAD");
    expect((await assign("00000000-0000-0000-0000-0000000000ff", COORDINATOR)).status).toBe(404);
    expect((await assign("not-a-uuid", COORDINATOR)).status).toBe(404);

    for (const [userId, role] of [[COORDINATOR, "EVENT_COORDINATOR"], [ORGANISER, "EVENT_ORGANISER"]]) {
      signedInAs(userId!, role!);
      expect((await assign(event.id, COORDINATOR)).status, role).toBe(403);
    }
    expect(await assignments(event.id)).toEqual([]);
  });
});

describe("coordinators and unassigned requests (E3-T7, W9-35)", () => {
  it("leaves an unassigned request out of a coordinator's review queue", async () => {
    const event = await submitted();
    signedInAs(COORDINATOR, "EVENT_COORDINATOR");

    const res = await request(app).get("/api/v1/events/queue").set(bearer);

    expect(res.body.items.map((item: { id: string }) => item.id)).not.toContain(event.id);
  });

  it("shows a coordinator an unassigned request without claiming it for review", async () => {
    const event = await submitted();
    signedInAs(COORDINATOR, "EVENT_COORDINATOR");

    const res = await request(app).get(`/api/v1/events/${event.id}`).set(bearer);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "SUBMITTED", reviewingCoordinatorId: null });
    const [stored] = await sql`select status from event.events where id = ${event.id}`;
    expect(stored).toEqual({ status: "SUBMITTED" });
  });
});

describe("the Lead is a role of its own (E3-T8, A2)", () => {
  it("opens a request without claiming it, and is refused a coordinator's action", async () => {
    const event = await submitted();
    signedInAs(LEAD, "EVENT_COORDINATOR_LEAD");
    await assign(event.id, COORDINATOR);

    const opened = await request(app).get(`/api/v1/events/${event.id}`).set(bearer);
    expect(opened.status).toBe(200);
    expect(opened.body.status).toBe("SUBMITTED");

    const approve = await request(app).post(`/api/v1/events/${event.id}/approve`).set(bearer);
    expect(approve.status).toBe(403);
    expect(approve.body.error.code).toBe("ROLE_NOT_AUTHORISED");
  });
});
