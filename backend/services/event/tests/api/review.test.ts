import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { testDb } from "../support/testDb.js";

process.env.EVENT_COORDINATOR_POOL = "a5555555-0000-0000-0000-00000000000a";

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

const ORGANISER = "a5555555-0000-0000-0000-000000000001";
const COORDINATOR = "a5555555-0000-0000-0000-000000000002";
const OTHER_COORDINATOR = "a5555555-0000-0000-0000-000000000003";
const ATTENDEE = "a5555555-0000-0000-0000-000000000004";
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
  await sql`delete from event.event_history where event_id in (${owned})`;
  await sql`delete from event.assignments where event_id in (${owned})`;
  await sql`delete from event.outbox where envelope->'payload'->>'ownerId' in ${sql(OWNERS)}`;
  await sql`delete from event.events where owner_id in ${sql(OWNERS)}`;
}

async function givenSubmittedEvent(overrides: Record<string, unknown> = {}) {
  signedInAs(ORGANISER, "EVENT_ORGANISER");
  const res = await request(app)
    .post("/api/v1/events")
    .set(bearer)
    .send({ ...validRequest, ...overrides });
  return res.body;
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

describe("GET /api/v1/events/queue (D1)", () => {
  it("shows a submitted request with the details a coordinator triages on", async () => {
    const event = await givenSubmittedEvent();
    signedInAs(COORDINATOR, "EVENT_COORDINATOR");

    const res = await request(app).get("/api/v1/events/queue").set(bearer);

    expect(res.status).toBe(200);
    const row = res.body.items.find((item: any) => item.id === event.id);
    expect(row).toMatchObject({
      reference: event.reference,
      name: "Annual Research Symposium",
      proposedStartAt: validRequest.proposedStartAt,
      proposedEndAt: validRequest.proposedEndAt,
      expectedAttendance: 150,
      ownerId: ORGANISER,
      status: "SUBMITTED",
    });
    expect(row.submittedAt).toBeTruthy();
  });

  it("orders the queue oldest submission first", async () => {
    const first = await givenSubmittedEvent({ name: "Earlier" });
    const second = await givenSubmittedEvent({ name: "Later" });
    signedInAs(COORDINATOR, "EVENT_COORDINATOR");

    const res = await request(app).get("/api/v1/events/queue").set(bearer);

    const mine = res.body.items
      .filter((item: any) => [first.id, second.id].includes(item.id))
      .map((item: any) => item.id);
    expect(mine).toEqual([first.id, second.id]);
  });

  it("never shows a draft in the queue", async () => {
    signedInAs(ORGANISER, "EVENT_ORGANISER");
    const draft = await request(app)
      .post("/api/v1/event-drafts")
      .set(bearer)
      .send({ name: "Unfinished" });
    signedInAs(COORDINATOR, "EVENT_COORDINATOR");

    const res = await request(app).get("/api/v1/events/queue").set(bearer);

    expect(res.body.items.map((item: any) => item.id)).not.toContain(draft.body.id);
  });

  it("refuses a role that is not an Event Coordinator (A2)", async () => {
    signedInAs(ORGANISER, "EVENT_ORGANISER");

    const res = await request(app).get("/api/v1/events/queue").set(bearer);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("ROLE_NOT_AUTHORISED");
  });
});

/**
 * Drafts and events share one table, so the scope filter — not the absence of
 * a row — is what keeps an unfinished request private to its owner (C1).
 */
describe("a draft is private to its owner, though it lives with the events (C1, A3)", () => {
  async function givenADraft() {
    signedInAs(ORGANISER, "EVENT_ORGANISER");
    const res = await request(app)
      .post("/api/v1/event-drafts")
      .set(bearer)
      .send({ name: "Not ready to be seen" });
    return res.body;
  }

  it("gives a coordinator no draft, even though their scope is every event", async () => {
    const draft = await givenADraft();
    signedInAs(COORDINATOR, "EVENT_COORDINATOR");

    const res = await request(app).get(`/api/v1/events/${draft.id}`).set(bearer);

    expect(res.status).toBe(404);
    expect(res.body.name).toBeUndefined();
  });

  it("leaves a draft out of a coordinator's event list", async () => {
    const draft = await givenADraft();
    signedInAs(COORDINATOR, "EVENT_COORDINATOR");

    const res = await request(app).get("/api/v1/events").set(bearer);

    expect(res.body.items.map((item: any) => item.id)).not.toContain(draft.id);
  });

  it("still gives the owning organiser their own draft", async () => {
    const draft = await givenADraft();

    const res = await request(app).get(`/api/v1/events/${draft.id}`).set(bearer);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("DRAFT");
  });

  it("does not open a draft for review when a coordinator cannot reach it", async () => {
    const draft = await givenADraft();
    signedInAs(COORDINATOR, "EVENT_COORDINATOR");
    await request(app).get(`/api/v1/events/${draft.id}`).set(bearer);

    const stored = await sql`select status from event.events where id = ${draft.id}`;
    expect(stored[0]!.status).toBe("DRAFT");
  });
});

describe("GET /api/v1/events/:id (D1)", () => {
  it("shows the full submitted content, including requirements", async () => {
    const event = await givenSubmittedEvent({
      accessibilityNeeds: "Step-free access",
      venueRequirements: { layout: "THEATRE" },
    });
    signedInAs(COORDINATOR, "EVENT_COORDINATOR");

    const res = await request(app).get(`/api/v1/events/${event.id}`).set(bearer);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      accessibilityNeeds: "Step-free access",
      venueRequirements: { layout: "THEATRE" },
    });
  });

  it("moves a Submitted request to Under Review, recording the reviewer and time", async () => {
    const event = await givenSubmittedEvent();
    signedInAs(COORDINATOR, "EVENT_COORDINATOR");

    const res = await request(app).get(`/api/v1/events/${event.id}`).set(bearer);

    expect(res.body).toMatchObject({ status: "UNDER_REVIEW", reviewingCoordinatorId: COORDINATOR });
    expect(res.body.reviewStartedAt).toBeTruthy();
  });

  it("writes a history entry for the move to Under Review (F1)", async () => {
    const event = await givenSubmittedEvent();
    signedInAs(COORDINATOR, "EVENT_COORDINATOR");
    await request(app).get(`/api/v1/events/${event.id}`).set(bearer);

    const history = await sql`
      select previous_status, new_status, triggering_action from event.event_history
      where event_id = ${event.id} and entry_type = 'STATUS_CHANGE' order by occurred_at asc
    `;
    expect(history[1]).toMatchObject({
      previous_status: "SUBMITTED",
      new_status: "UNDER_REVIEW",
      triggering_action: "OPEN_FOR_REVIEW",
    });
  });

  it("does not overwrite the reviewer when a second coordinator opens it", async () => {
    const event = await givenSubmittedEvent();
    signedInAs(COORDINATOR, "EVENT_COORDINATOR");
    await request(app).get(`/api/v1/events/${event.id}`).set(bearer);

    signedInAs(OTHER_COORDINATOR, "EVENT_COORDINATOR");
    const res = await request(app).get(`/api/v1/events/${event.id}`).set(bearer);

    expect(res.status).toBe(200);
    expect(res.body.reviewingCoordinatorId).toBe(COORDINATOR);
  });

  it("does not move the event to Under Review when the organiser opens it", async () => {
    const event = await givenSubmittedEvent();

    const res = await request(app).get(`/api/v1/events/${event.id}`).set(bearer);

    expect(res.body.status).toBe("SUBMITTED");
    expect(res.body.reviewingCoordinatorId).toBeNull();
  });

  it("gives a user outside the event's scope no event data (A3)", async () => {
    const event = await givenSubmittedEvent();
    signedInAs(ATTENDEE, "ATTENDEE");

    const res = await request(app).get(`/api/v1/events/${event.id}`).set(bearer);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("EVENT_NOT_FOUND");
    expect(res.body.name).toBeUndefined();
  });
});

describe("dependency availability (CP)", () => {
  it("refuses the request when Identity cannot be reached, changing nothing", async () => {
    const { IdentityUnavailableError } = await import("../../src/auth/identityClient.js");
    vi.mocked(fetchCurrentUser).mockRejectedValue(new IdentityUnavailableError("connect ECONNREFUSED"));
    vi.mocked(fetchEventsScope).mockRejectedValue(new IdentityUnavailableError("connect ECONNREFUSED"));

    const res = await request(app).get("/api/v1/events/queue").set(bearer);

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("IDENTITY_UNAVAILABLE");
  });
});
