import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { testDb } from "../../support/testDb.js";
import { assignForTest } from "../../support/assignment.js";
import { EVENT_END, EVENT_START } from "../../support/eventDates.js";

const ORGANISER = "a8888888-0000-0000-0000-000000000001";
const COORDINATOR_A = "a8888888-0000-0000-0000-000000000002";
const COORDINATOR_B = "a8888888-0000-0000-0000-000000000003";
const COORDINATOR_C = "a8888888-0000-0000-0000-000000000004";
const POOL = [COORDINATOR_A, COORDINATOR_B, COORDINATOR_C];

/** E3: submission assigns no one, so each test assigns as the Lead would. */
const POOL_COORDINATOR = COORDINATOR_A;

vi.mock("../../../src/shared/auth/verifyJwt.js", () => ({
  verifyJwt: (
    req: { auth?: { supabaseUserId?: string }; header(name: string): string | undefined },
    _res: unknown,
    next: () => void
  ) => {
    req.auth = { supabaseUserId: "test-subject" };
    next();
  },
}));

vi.mock("../../../src/modules/event/auth/identity.js", async () => {
  const actual = await vi.importActual<typeof import("../../../src/modules/event/auth/identity.js")>(
    "../../../src/modules/event/auth/identity.js"
  );
  return { ...actual, resolveCurrentUser: vi.fn(), resolveEventsScope: vi.fn() };
});

const { resolveCurrentUser, resolveEventsScope } = await import("../../../src/modules/event/auth/identity.js");
const { app } = await import("../../../src/app.js");

const sql = testDb();
const OWNERS = [ORGANISER];
const bearer = { Authorization: "Bearer test-token" };

function signedInAs(userId: string, role: string) {
  vi.mocked(resolveCurrentUser).mockResolvedValue({
    id: userId,
    email: "user@connectsphere.test",
    role: role as never,
  });
  vi.mocked(resolveEventsScope).mockResolvedValue(
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
  proposedStartAt: EVENT_START,
  proposedEndAt: EVENT_END,
  expectedAttendance: 150,
  registrationRequired: false,
  equipmentRequired: false,
};

async function cleanUp() {
  const owned = sql`select id from event.events where owner_id in ${sql(OWNERS)}`;
  await sql`delete from event.reassignment_proposals where event_id in (${owned})`;
  await sql`delete from event.event_history where event_id in (${owned})`;
  await sql`delete from event.assignments where event_id in (${owned})`;
  await sql`delete from event.outbox where coalesce(envelope->'data', envelope->'payload')->>'ownerId' in ${sql(OWNERS)}`;
  await sql`delete from event.events where owner_id in ${sql(OWNERS)}`;
}

/** Submitted directly, so E1's auto-assignment has already run. */
async function givenSubmittedEvent() {
  signedInAs(ORGANISER, "EVENT_ORGANISER");
  const created = await request(app).post("/api/v1/events").set(bearer).send(validRequest);
  await assignForTest(sql, created.body, POOL_COORDINATOR);
  return created.body;
}

/** A proposal made before E2 was retired: the FX-PROPOSAL statement (tests/E4/README.md). */
async function pendingProposal(eventId: string, outgoing: string, nominee: string): Promise<void> {
  await sql`
    insert into event.reassignment_proposals (event_id, outgoing_coordinator_id, nominee_coordinator_id, status, created_by, updated_by)
    values (${eventId}, ${outgoing}, ${nominee}, 'PENDING', ${outgoing}, ${outgoing})
  `;
}

beforeEach(async () => {
  vi.mocked(resolveCurrentUser).mockReset();
  vi.mocked(resolveEventsScope).mockReset();
  await cleanUp();
});

afterAll(async () => {
  await cleanUp();
  await sql.end();
});

/**
 * E4 retires E2's peer flow (W9-FX-5, W9-59): the Lead alone reassigns. A
 * coordinator can no longer propose, accept or decline; migration event/0020 closed
 * every proposal made before the retirement, and the Lead's reassignment closes any
 * other. The pending proposals below stand for one that 0020 has not yet closed.
 */
describe("POST /api/v1/events/:id/reassignment-proposals is retired (E4)", () => {
  it("refuses a proposal, saying the Lead reassigns events, and stores nothing (E4-T6)", async () => {
    const event = await givenSubmittedEvent();
    signedInAs(event.assignedCoordinatorId, "EVENT_COORDINATOR");

    const res = await request(app)
      .post(`/api/v1/events/${event.id}/reassignment-proposals`)
      .set(bearer)
      .send({ nomineeId: COORDINATOR_B });

    expect(res.status).toBe(410);
    expect(res.body.error).toMatchObject({
      code: "REASSIGNMENT_RETIRED",
      message: "Coordinators no longer propose reassignments: the Event Coordinator Lead reassigns events.",
    });
    const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from event.reassignment_proposals where event_id = ${event.id}`;
    expect(n).toBe(0);
  });
});

describe("POST /api/v1/events/:id/reassignment-proposals/accept is retired (E4, W9-FX-5)", () => {
  async function givenPendingProposal() {
    const event = await givenSubmittedEvent();
    const active = event.assignedCoordinatorId;
    const nominee = otherPoolMember(active);
    await pendingProposal(event.id, active, nominee);
    return { event, active, nominee };
  }

  it("refuses the nominee's accept with 410, pointing to the Lead, and moves nothing (M8)", async () => {
    const { event, active, nominee } = await givenPendingProposal();
    signedInAs(nominee, "EVENT_COORDINATOR");

    const res = await request(app).post(`/api/v1/events/${event.id}/reassignment-proposals/accept`).set(bearer).send();

    expect(res.status).toBe(410);
    expect(res.body.error).toMatchObject({
      code: "REASSIGNMENT_RETIRED",
      message: "Coordinators no longer accept reassignment proposals: the Event Coordinator Lead reassigns events (E4).",
    });
    const assignments = await sql<{ coordinator_id: string; is_active: boolean }[]>`
      select coordinator_id, is_active from event.assignments where event_id = ${event.id}
    `;
    expect(assignments).toEqual([{ coordinator_id: active, is_active: true }]);
    const [proposal] = await sql<{ status: string }[]>`select status from event.reassignment_proposals where event_id = ${event.id}`;
    expect(proposal!.status).toBe("PENDING");
    expect(
      await sql`select 1 from event.outbox where message_key = ${event.id} and envelope->>'type' = 'event.reassignment-accepted'`
    ).toEqual([]);
  });

  it("refuses everyone's accept the same way, the assigned coordinator's included", async () => {
    const { event, active } = await givenPendingProposal();
    signedInAs(active, "EVENT_COORDINATOR");

    const res = await request(app).post(`/api/v1/events/${event.id}/reassignment-proposals/accept`).set(bearer).send();

    expect(res.status).toBe(410);
    expect(res.body.error.code).toBe("REASSIGNMENT_RETIRED");
  });

  it("is still the coordinators' to call: an organiser is refused as for any coordinator action", async () => {
    const { event } = await givenPendingProposal();
    signedInAs(ORGANISER, "EVENT_ORGANISER");

    const res = await request(app).post(`/api/v1/events/${event.id}/reassignment-proposals/accept`).set(bearer).send();

    expect(res.status).toBe(403);
  });
});

describe("POST /api/v1/events/:id/reassignment-proposals/decline is retired (E4, W9-FX-5)", () => {
  it("refuses the nominee's decline with 410, pointing to the Lead, and changes nothing (M8)", async () => {
    const event = await givenSubmittedEvent();
    const active = event.assignedCoordinatorId;
    const nominee = otherPoolMember(active);
    await pendingProposal(event.id, active, nominee);
    signedInAs(nominee, "EVENT_COORDINATOR");

    const res = await request(app).post(`/api/v1/events/${event.id}/reassignment-proposals/decline`).set(bearer).send();

    expect(res.status).toBe(410);
    expect(res.body.error).toMatchObject({
      code: "REASSIGNMENT_RETIRED",
      message: "Coordinators no longer answer reassignment proposals: none is pending, and the Event Coordinator Lead reassigns events (E4).",
    });
    const assignments = await sql<{ coordinator_id: string; is_active: boolean }[]>`
      select coordinator_id, is_active from event.assignments where event_id = ${event.id}
    `;
    expect(assignments).toEqual([{ coordinator_id: active, is_active: true }]);
    const [proposal] = await sql<{ status: string }[]>`select status from event.reassignment_proposals where event_id = ${event.id}`;
    expect(proposal!.status).toBe("PENDING");
    expect(
      await sql`select 1 from event.outbox where message_key = ${event.id} and envelope->>'type' = 'event.reassignment-declined'`
    ).toEqual([]);
  });
});
