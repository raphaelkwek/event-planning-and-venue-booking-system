import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { testDb } from "../support/testDb.js";

const ORGANISER = "a8888888-0000-0000-0000-000000000001";
const COORDINATOR_A = "a8888888-0000-0000-0000-000000000002";
const COORDINATOR_B = "a8888888-0000-0000-0000-000000000003";
const COORDINATOR_C = "a8888888-0000-0000-0000-000000000004";
const POOL = [COORDINATOR_A, COORDINATOR_B, COORDINATOR_C];

process.env.EVENT_COORDINATOR_POOL = POOL.join(",");

vi.mock("../../src/auth/verifyJwt.js", () => ({
  verifyJwt: (req: any, _res: any, next: any) => {
    req.auth = { supabaseUserId: "test-subject" };
    next();
  },
}));

vi.mock("../../src/auth/identityClient.js", async () => {
  const actual = await vi.importActual<typeof import("../../src/auth/identityClient.js")>(
    "../../src/auth/identityClient.js"
  );
  return { ...actual, fetchCurrentUser: vi.fn(), fetchEventsScope: vi.fn() };
});

const { fetchCurrentUser, fetchEventsScope } = await import("../../src/auth/identityClient.js");
const { app } = await import("../../src/index.js");

const sql = testDb();
const OWNERS = [ORGANISER];
const bearer = { Authorization: "Bearer test-token" };

function signedInAs(userId: string, role: string) {
  vi.mocked(fetchCurrentUser).mockResolvedValue({
    id: userId,
    email: "user@connectsphere.test",
    role: role as never,
  });
  vi.mocked(fetchEventsScope).mockResolvedValue(
    role === "EVENT_COORDINATOR"
      ? { scopeType: "ALL" }
      : role === "EVENT_ORGANISER"
        ? { scopeType: "OWNED_BY_USER", userId }
        : { scopeType: "NONE" }
  );
}

/** Whichever pool member the round-robin allocator did not pick. */
function otherPoolMember(assignedId: string, exclude: string[] = []): string {
  return POOL.find((id) => id !== assignedId && !exclude.includes(id))!;
}

const validRequest = {
  name: "Annual Research Symposium",
  purpose: "Share faculty research",
  description: "A one-day symposium.",
  proposedStartAt: "2026-10-02T14:00:00.000Z",
  proposedEndAt: "2026-10-02T18:00:00.000Z",
  expectedAttendance: 150,
  registrationRequired: false,
  equipmentRequired: false,
};

async function cleanUp() {
  const owned = sql`select id from event.events where owner_id in ${sql(OWNERS)}`;
  await sql`delete from event.reassignment_proposals where event_id in (${owned})`;
  await sql`delete from event.event_history where event_id in (${owned})`;
  await sql`delete from event.assignments where event_id in (${owned})`;
  await sql`delete from event.outbox where envelope->'payload'->>'ownerId' in ${sql(OWNERS)}`;
  await sql`delete from event.events where owner_id in ${sql(OWNERS)}`;
}

/** Submitted directly, so E1's auto-assignment has already run. */
async function givenSubmittedEvent() {
  signedInAs(ORGANISER, "EVENT_ORGANISER");
  const created = await request(app).post("/api/v1/events").set(bearer).send(validRequest);
  return created.body;
}

async function givenRejectedEvent() {
  const event = await givenSubmittedEvent();
  signedInAs(event.assignedCoordinatorId, "EVENT_COORDINATOR");
  await request(app).get(`/api/v1/events/${event.id}`).set(bearer);
  await request(app)
    .post(`/api/v1/events/${event.id}/reject`)
    .set(bearer)
    .send({ reason: "No suitable venue." });
  return event;
}

beforeEach(async () => {
  vi.mocked(fetchCurrentUser).mockReset();
  vi.mocked(fetchEventsScope).mockReset();
  await cleanUp();
});

afterAll(async () => {
  await cleanUp();
  await sql.end();
});

describe("POST /api/v1/events/:id/reassignment-proposals (E2)", () => {
  it("lets the active coordinator propose reassignment to an eligible nominee", async () => {
    const event = await givenSubmittedEvent();
    const active = event.assignedCoordinatorId;
    const nominee = otherPoolMember(active);
    signedInAs(active, "EVENT_COORDINATOR");

    const res = await request(app)
      .post(`/api/v1/events/${event.id}/reassignment-proposals`)
      .set(bearer)
      .send({ nomineeId: nominee });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      status: "PENDING",
      outgoingCoordinatorId: active,
      nomineeCoordinatorId: nominee,
    });
    expect(res.body.proposedAt).toBeTruthy();
  });

  it("notifies both parties by writing the reassignment-proposed event", async () => {
    const event = await givenSubmittedEvent();
    const active = event.assignedCoordinatorId;
    const nominee = otherPoolMember(active);
    signedInAs(active, "EVENT_COORDINATOR");

    await request(app)
      .post(`/api/v1/events/${event.id}/reassignment-proposals`)
      .set(bearer)
      .send({ nomineeId: nominee });

    const outbox = await sql`
      select envelope from event.outbox
      where message_key = ${event.id} and topic = 'connectsphere.event.reassignment-proposed.v1'
    `;
    expect(outbox).toHaveLength(1);
    expect(outbox[0]!.envelope.payload).toMatchObject({
      outgoingCoordinatorId: active,
      nomineeCoordinatorId: nominee,
    });
  });

  it("refuses reassignment once the event has been rejected", async () => {
    const event = await givenRejectedEvent();
    const nominee = otherPoolMember(event.assignedCoordinatorId);
    signedInAs(event.assignedCoordinatorId, "EVENT_COORDINATOR");

    const res = await request(app)
      .post(`/api/v1/events/${event.id}/reassignment-proposals`)
      .set(bearer)
      .send({ nomineeId: nominee });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("REASSIGNMENT_NOT_PERMITTED");
  });

  it("refuses a coordinator who is not the one currently assigned", async () => {
    const event = await givenSubmittedEvent();
    const active = event.assignedCoordinatorId;
    const bystander = otherPoolMember(active);
    const nominee = otherPoolMember(active, [bystander]);
    signedInAs(bystander, "EVENT_COORDINATOR");

    const res = await request(app)
      .post(`/api/v1/events/${event.id}/reassignment-proposals`)
      .set(bearer)
      .send({ nomineeId: nominee });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("ROLE_NOT_AUTHORISED");
  });

  it("refuses a nominee who does not hold the Coordinator role", async () => {
    const event = await givenSubmittedEvent();
    const active = event.assignedCoordinatorId;
    signedInAs(active, "EVENT_COORDINATOR");

    const res = await request(app)
      .post(`/api/v1/events/${event.id}/reassignment-proposals`)
      .set(bearer)
      .send({ nomineeId: "00000000-0000-0000-0000-000000000000" });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("NOMINEE_NOT_ELIGIBLE");
  });

  it("refuses nominating the coordinator already assigned, creating no history entry", async () => {
    const event = await givenSubmittedEvent();
    const active = event.assignedCoordinatorId;
    signedInAs(active, "EVENT_COORDINATOR");

    const res = await request(app)
      .post(`/api/v1/events/${event.id}/reassignment-proposals`)
      .set(bearer)
      .send({ nomineeId: active });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("SELF_NOMINATION_NOT_PERMITTED");
    const rows = await sql`
      select count(*)::int as count from event.reassignment_proposals where event_id = ${event.id}
    `;
    expect(rows[0]!.count).toBe(0);
  });

  it("refuses a second proposal while one is pending, naming the pending nominee", async () => {
    const event = await givenSubmittedEvent();
    const active = event.assignedCoordinatorId;
    const firstNominee = otherPoolMember(active);
    const secondNominee = otherPoolMember(active, [firstNominee]);
    signedInAs(active, "EVENT_COORDINATOR");

    await request(app)
      .post(`/api/v1/events/${event.id}/reassignment-proposals`)
      .set(bearer)
      .send({ nomineeId: firstNominee });

    const res = await request(app)
      .post(`/api/v1/events/${event.id}/reassignment-proposals`)
      .set(bearer)
      .send({ nomineeId: secondNominee });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("REASSIGNMENT_ALREADY_PENDING");
    expect(res.body.error.message).toContain(firstNominee);
  });

  it("fires two concurrent proposals for the same event and lets exactly one win", async () => {
    const event = await givenSubmittedEvent();
    const active = event.assignedCoordinatorId;
    const nomineeOne = otherPoolMember(active);
    const nomineeTwo = otherPoolMember(active, [nomineeOne]);
    signedInAs(active, "EVENT_COORDINATOR");

    const [first, second] = await Promise.all([
      request(app)
        .post(`/api/v1/events/${event.id}/reassignment-proposals`)
        .set(bearer)
        .send({ nomineeId: nomineeOne }),
      request(app)
        .post(`/api/v1/events/${event.id}/reassignment-proposals`)
        .set(bearer)
        .send({ nomineeId: nomineeTwo }),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([201, 409]);

    const pending = await sql`
      select count(*)::int as count from event.reassignment_proposals
      where event_id = ${event.id} and status = 'PENDING'
    `;
    expect(pending[0]!.count).toBe(1);
  });
});

describe("POST /api/v1/events/:id/reassignment-proposals/accept (E2)", () => {
  async function givenPendingProposal() {
    const event = await givenSubmittedEvent();
    const active = event.assignedCoordinatorId;
    const nominee = otherPoolMember(active);
    signedInAs(active, "EVENT_COORDINATOR");
    await request(app)
      .post(`/api/v1/events/${event.id}/reassignment-proposals`)
      .set(bearer)
      .send({ nomineeId: nominee });
    return { event, active, nominee };
  }

  it("moves coordinator permissions to the nominee and closes the outgoing assignment", async () => {
    const { event, active, nominee } = await givenPendingProposal();
    signedInAs(nominee, "EVENT_COORDINATOR");

    const res = await request(app)
      .post(`/api/v1/events/${event.id}/reassignment-proposals/accept`)
      .set(bearer)
      .send();

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ACCEPTED");

    // Re-read as the organiser: a coordinator's GET on a still-Submitted event
    // claims it for review as a side effect (D1) and returns a placeholder
    // assignedCoordinatorId on that specific response, which isn't what this
    // assertion is about.
    signedInAs(event.ownerId, "EVENT_ORGANISER");
    const reread = await request(app).get(`/api/v1/events/${event.id}`).set(bearer);
    expect(reread.body.assignedCoordinatorId).toBe(nominee);

    const closed = await sql`
      select is_active from event.assignments where event_id = ${event.id} and coordinator_id = ${active}
    `;
    expect(closed[0]!.is_active).toBe(false);
  });

  it("writes the reassignment-accepted event naming both coordinators", async () => {
    const { event, active, nominee } = await givenPendingProposal();
    signedInAs(nominee, "EVENT_COORDINATOR");

    await request(app)
      .post(`/api/v1/events/${event.id}/reassignment-proposals/accept`)
      .set(bearer)
      .send();

    const outbox = await sql`
      select envelope from event.outbox
      where message_key = ${event.id} and topic = 'connectsphere.event.reassignment-accepted.v1'
    `;
    expect(outbox[0]!.envelope.payload).toMatchObject({
      outgoingCoordinatorId: active,
      nomineeCoordinatorId: nominee,
    });
  });

  it("refuses a caller who is not the nominee", async () => {
    const { event, active } = await givenPendingProposal();
    signedInAs(active, "EVENT_COORDINATOR");

    const res = await request(app)
      .post(`/api/v1/events/${event.id}/reassignment-proposals/accept`)
      .set(bearer)
      .send();

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("REASSIGNMENT_PROPOSAL_NOT_FOUND");
  });
});

describe("POST /api/v1/events/:id/reassignment-proposals/decline (E2)", () => {
  it("leaves the outgoing coordinator active and records the decline", async () => {
    const event = await givenSubmittedEvent();
    const active = event.assignedCoordinatorId;
    const nominee = otherPoolMember(active);
    signedInAs(active, "EVENT_COORDINATOR");
    await request(app)
      .post(`/api/v1/events/${event.id}/reassignment-proposals`)
      .set(bearer)
      .send({ nomineeId: nominee });

    signedInAs(nominee, "EVENT_COORDINATOR");
    const res = await request(app)
      .post(`/api/v1/events/${event.id}/reassignment-proposals/decline`)
      .set(bearer)
      .send();

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("DECLINED");

    // Re-read as the organiser, for the same reason as the accept test above.
    signedInAs(event.ownerId, "EVENT_ORGANISER");
    const reread = await request(app).get(`/api/v1/events/${event.id}`).set(bearer);
    expect(reread.body.assignedCoordinatorId).toBe(active);
  });

  it("allows a fresh proposal once the pending one has been declined", async () => {
    const event = await givenSubmittedEvent();
    const active = event.assignedCoordinatorId;
    const firstNominee = otherPoolMember(active);
    const secondNominee = otherPoolMember(active, [firstNominee]);

    signedInAs(active, "EVENT_COORDINATOR");
    await request(app)
      .post(`/api/v1/events/${event.id}/reassignment-proposals`)
      .set(bearer)
      .send({ nomineeId: firstNominee });

    signedInAs(firstNominee, "EVENT_COORDINATOR");
    await request(app)
      .post(`/api/v1/events/${event.id}/reassignment-proposals/decline`)
      .set(bearer)
      .send();

    signedInAs(active, "EVENT_COORDINATOR");
    const res = await request(app)
      .post(`/api/v1/events/${event.id}/reassignment-proposals`)
      .set(bearer)
      .send({ nomineeId: secondNominee });

    expect(res.status).toBe(201);
  });
});
