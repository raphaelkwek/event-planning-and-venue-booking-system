import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { testDb } from "../support/testDb.js";

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

const ORGANISER = "a3333333-0000-0000-0000-000000000001";
const OTHER_ORGANISER = "a3333333-0000-0000-0000-000000000002";
const COORDINATOR = "a3333333-0000-0000-0000-000000000003";
const OWNERS = [ORGANISER, OTHER_ORGANISER];

function signedInAs(userId: string, role: string) {
  vi.mocked(fetchCurrentUser).mockResolvedValue({
    id: userId,
    email: `${role.toLowerCase()}@connectsphere.test`,
    role: role as never,
  });
  vi.mocked(fetchEventsScope).mockResolvedValue(
    role === "EVENT_COORDINATOR" ? { scopeType: "ALL" } : { scopeType: "OWNED_BY_USER", userId }
  );
}

const bearer = { Authorization: "Bearer test-token" };

async function cleanUp() {
  await sql`delete from event.status_history where event_id in (
    select id from event.events where owner_id in ${sql(OWNERS)}
  )`;
  await sql`delete from event.assignments where event_id in (
    select id from event.events where owner_id in ${sql(OWNERS)}
  )`;
  await sql`delete from event.events where owner_id in ${sql(OWNERS)}`;
}

beforeEach(async () => {
  vi.mocked(fetchCurrentUser).mockReset();
  vi.mocked(fetchEventsScope).mockReset();
  signedInAs(ORGANISER, "EVENT_ORGANISER");
  await cleanUp();
});

afterAll(async () => {
  await cleanUp();
  await sql.end();
});

describe("POST /api/v1/event-drafts (C1)", () => {
  it("saves a draft once the event name is present, every other field empty", async () => {
    const res = await request(app).post("/api/v1/event-drafts").set(bearer).send({ name: "Just an idea" });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: "Just an idea", status: "DRAFT" });
    expect(res.body.lastSavedAt).toBeTruthy();
  });

  it("refuses a draft with no event name", async () => {
    const res = await request(app).post("/api/v1/event-drafts").set(bearer).send({ purpose: "No name" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_FAILED");
  });

  it("does not apply the submission rules on save", async () => {
    const res = await request(app)
      .post("/api/v1/event-drafts")
      .set(bearer)
      .send({ name: "Incomplete", expectedAttendance: 0, proposedStartAt: "2020-01-01T00:00:00.000Z" });

    expect(res.status).toBe(201);
  });

  it("refuses a date that is not a valid date, even on save", async () => {
    const res = await request(app)
      .post("/api/v1/event-drafts")
      .set(bearer)
      .send({ name: "Bad date", proposedStartAt: "the 4th of Octember" });

    expect(res.status).toBe(400);
    expect(res.body.error.fields.map((field: { field: string }) => field.field)).toContain(
      "proposedStartAt"
    );
  });

  it("refuses a role that is not an Event Organiser (A2)", async () => {
    signedInAs(COORDINATOR, "EVENT_COORDINATOR");

    const res = await request(app).post("/api/v1/event-drafts").set(bearer).send({ name: "Not mine to make" });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("ROLE_NOT_AUTHORISED");
  });
});

describe("GET/PUT /api/v1/event-drafts/:id (C2)", () => {
  async function givenADraft(owner = ORGANISER) {
    signedInAs(owner, "EVENT_ORGANISER");
    const created = await request(app)
      .post("/api/v1/event-drafts")
      .set(bearer)
      .send({ name: "Symposium", purpose: "Research", expectedAttendance: 150 });
    signedInAs(ORGANISER, "EVENT_ORGANISER");
    return created.body;
  }

  it("restores every saved field when the owner reopens the draft", async () => {
    const draft = await givenADraft();

    const res = await request(app).get(`/api/v1/event-drafts/${draft.id}`).set(bearer);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: "Symposium", purpose: "Research", expectedAttendance: 150 });
  });

  it("keeps the draft a draft when it is edited and saved", async () => {
    const draft = await givenADraft();

    const res = await request(app)
      .put(`/api/v1/event-drafts/${draft.id}`)
      .set(bearer)
      .send({ name: "Symposium", purpose: "Research and industry" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "DRAFT", purpose: "Research and industry" });
  });

  it("gives an organiser who does not own the draft no draft content", async () => {
    const draft = await givenADraft(OTHER_ORGANISER);

    const res = await request(app).get(`/api/v1/event-drafts/${draft.id}`).set(bearer);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("DRAFT_NOT_FOUND");
  });

  it("refuses an edit by an organiser who does not own the draft", async () => {
    const draft = await givenADraft(OTHER_ORGANISER);

    const res = await request(app)
      .put(`/api/v1/event-drafts/${draft.id}`)
      .set(bearer)
      .send({ name: "Hijacked" });

    expect(res.status).toBe(404);
  });
});

describe("GET /api/v1/events (C3)", () => {
  it("shows the status of every request, with drafts distinct from submitted ones", async () => {
    await request(app).post("/api/v1/event-drafts").set(bearer).send({ name: "Still a draft" });
    await request(app)
      .post("/api/v1/events")
      .set(bearer)
      .send({
        name: "Already submitted",
        purpose: "Purpose",
        description: "Description",
        proposedStartAt: "2026-10-02T14:00:00.000Z",
        proposedEndAt: "2026-10-02T18:00:00.000Z",
        expectedAttendance: 10,
        registrationRequired: false,
        equipmentRequired: false,
      });

    const res = await request(app).get("/api/v1/events").set(bearer);

    expect(res.status).toBe(200);
    const byName = Object.fromEntries(res.body.items.map((item: any) => [item.name, item]));
    expect(byName["Still a draft"].status).toBe("DRAFT");
    expect(byName["Already submitted"].status).toBe("SUBMITTED");
  });

  it("can be filtered to drafts only", async () => {
    await request(app).post("/api/v1/event-drafts").set(bearer).send({ name: "Still a draft" });

    const res = await request(app).get("/api/v1/events?kind=drafts").set(bearer);

    expect(res.body.items.map((item: any) => item.name)).toEqual(["Still a draft"]);
  });

  it("shows a draft row with its last-saved time, no reference and no coordinator", async () => {
    await request(app).post("/api/v1/event-drafts").set(bearer).send({ name: "Still a draft" });

    const res = await request(app).get("/api/v1/events?kind=drafts").set(bearer);

    const draft = res.body.items[0];
    expect(draft.lastSavedAt).toBeTruthy();
    expect(draft.reference).toBeNull();
    expect(draft.assignedCoordinatorId).toBeNull();
    expect(draft.submittedAt).toBeNull();
  });

  it("lists no other organiser's requests (A3)", async () => {
    signedInAs(OTHER_ORGANISER, "EVENT_ORGANISER");
    await request(app).post("/api/v1/event-drafts").set(bearer).send({ name: "Theirs" });
    signedInAs(ORGANISER, "EVENT_ORGANISER");

    const res = await request(app).get("/api/v1/events").set(bearer);

    expect(res.body.items.map((item: any) => item.name)).not.toContain("Theirs");
  });
});
