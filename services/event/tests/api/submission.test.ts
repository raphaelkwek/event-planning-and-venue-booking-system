import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { testDb } from "../support/testDb.js";

const COORDINATOR_A = "a4444444-0000-0000-0000-00000000000a";
const COORDINATOR_B = "a4444444-0000-0000-0000-00000000000b";

// E1's eligible pool is configuration while the story is stubbed.
process.env.EVENT_COORDINATOR_POOL = `${COORDINATOR_A},${COORDINATOR_B}`;

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

const ORGANISER = "a4444444-0000-0000-0000-000000000001";
const OWNERS = [ORGANISER];
const bearer = { Authorization: "Bearer test-token" };

function signedInAs(userId: string, role: string) {
  vi.mocked(fetchCurrentUser).mockResolvedValue({
    id: userId,
    email: "organiser@connectsphere.test",
    role: role as never,
  });
  vi.mocked(fetchEventsScope).mockResolvedValue(
    role === "EVENT_COORDINATOR" ? { scopeType: "ALL" } : { scopeType: "OWNED_BY_USER", userId }
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

/**
 * Drafts and events reference each other, so the link is broken before either
 * side is removed. Test data only — production never deletes a row.
 */
async function cleanUp() {
  const owned = sql`select id from event.events where owner_id in ${sql(OWNERS)}`;
  await sql`delete from event.event_history where event_id in (${owned})`;
  await sql`delete from event.assignments where event_id in (${owned})`;
  await sql`delete from event.outbox where envelope->'payload'->>'ownerId' in ${sql(OWNERS)}`;
  await sql`delete from event.events where owner_id in ${sql(OWNERS)}`;
}

beforeEach(async () => {
  vi.mocked(fetchCurrentUser).mockReset();
  vi.mocked(fetchEventsScope).mockReset();
  signedInAs(ORGANISER, "EVENT_ORGANISER");
  await cleanUp();
  await sql`update event.assignment_cursor set next_index = 0 where id = true`;
});

afterAll(async () => {
  await cleanUp();
  await sql.end();
});

describe("POST /api/v1/events (B1)", () => {
  it("stores the request as Submitted with a reference and a submission time", async () => {
    const res = await request(app).post("/api/v1/events").set(bearer).send(validRequest);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ status: "SUBMITTED", ownerId: ORGANISER });
    expect(res.body.reference).toMatch(/^EVT-\d{6}$/);
    expect(res.body.submittedAt).toBeTruthy();
  });

  it("records the submitting organiser as the owner of the event", async () => {
    const res = await request(app).post("/api/v1/events").set(bearer).send(validRequest);

    const stored = await sql`select owner_id from event.events where id = ${res.body.id}`;
    expect(stored[0]!.owner_id).toBe(ORGANISER);
  });

  it("writes the first status history entry for the submission (F1)", async () => {
    const res = await request(app).post("/api/v1/events").set(bearer).send(validRequest);

    const history = await sql`
      select previous_status, new_status, actor_user_id, actor_role, triggering_action
      from event.event_history where event_id = ${res.body.id} and entry_type = 'STATUS_CHANGE'
    `;
    expect(history[0]).toMatchObject({
      previous_status: "DRAFT",
      new_status: "SUBMITTED",
      actor_user_id: ORGANISER,
      actor_role: "EVENT_ORGANISER",
    });
  });

  it("raises the notification that a new request awaits review, in the same transaction", async () => {
    const res = await request(app).post("/api/v1/events").set(bearer).send(validRequest);

    const outbox = await sql`
      select topic, message_key, envelope from event.outbox
      where message_key = ${res.body.id} and topic = 'connectsphere.event.submitted.v1'
    `;
    expect(outbox).toHaveLength(1);
    expect(outbox[0]!.envelope.payload.eventReference).toBe(res.body.reference);
    expect(outbox[0]!.envelope.published_at ?? null).toBeNull();
  });

  it("creates no event record at all when validation fails (B1, B2)", async () => {
    const before = await sql`select count(*)::int as n from event.events where owner_id = ${ORGANISER}`;

    const res = await request(app)
      .post("/api/v1/events")
      .set(bearer)
      .send({ ...validRequest, expectedAttendance: 0 });

    expect(res.status).toBe(400);
    const after = await sql`select count(*)::int as n from event.events where owner_id = ${ORGANISER}`;
    expect(after[0]!.n).toBe(before[0]!.n);
  });

  it("names every field that caused the rejection, not just the first (B2)", async () => {
    const res = await request(app)
      .post("/api/v1/events")
      .set(bearer)
      .send({ name: "Only a name" });

    expect(res.status).toBe(400);
    const named = res.body.error.fields.map((field: { field: string }) => field.field);
    expect(named).toEqual(
      expect.arrayContaining([
        "purpose",
        "description",
        "proposedStartAt",
        "proposedEndAt",
        "expectedAttendance",
        "registrationRequired",
        "equipmentRequired",
      ])
    );
  });

  it("stores the venue and equipment requirements it captures (B1)", async () => {
    const venueRequirements = { layout: "Theatre", facilities: ["Projector"], notes: "Stage needed" };
    const equipmentRequirements = [{ equipmentType: "Wireless microphone", quantity: 4, notes: null }];

    const res = await request(app)
      .post("/api/v1/events")
      .set(bearer)
      .send({ ...validRequest, equipmentRequired: true, venueRequirements, equipmentRequirements });

    expect(res.status).toBe(201);
    expect(res.body.venueRequirements).toEqual(venueRequirements);
    expect(res.body.equipmentRequirements).toEqual(equipmentRequirements);
  });

  it("refuses an equipment line with a quantity of zero, naming the line", async () => {
    const res = await request(app)
      .post("/api/v1/events")
      .set(bearer)
      .send({
        ...validRequest,
        equipmentRequired: true,
        equipmentRequirements: [{ equipmentType: "Projector", quantity: 0 }],
      });

    expect(res.status).toBe(400);
    expect(res.body.error.fields.map((field: { field: string }) => field.field)).toContain(
      "equipmentRequirements.0.quantity"
    );
  });

  it("refuses a role that is not an Event Organiser (A2)", async () => {
    signedInAs("a4444444-0000-0000-0000-000000000009", "VENUE_STAFF");

    const res = await request(app).post("/api/v1/events").set(bearer).send(validRequest);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("ROLE_NOT_AUTHORISED");
  });
});

describe("coordinator assignment on submission (E1)", () => {
  it("assigns a coordinator as part of the submission", async () => {
    const res = await request(app).post("/api/v1/events").set(bearer).send(validRequest);

    expect(res.body.assignedCoordinatorId).toBe(COORDINATOR_A);
  });

  it("records the allocation rule that was applied, so the outcome can be explained", async () => {
    const res = await request(app).post("/api/v1/events").set(bearer).send(validRequest);

    const rows = await sql`
      select assignment_rule, is_active from event.assignments where event_id = ${res.body.id}
    `;
    expect(rows[0]).toMatchObject({ assignment_rule: "ROUND_ROBIN_STUB", is_active: true });
  });

  it("gives each event exactly one active assignment", async () => {
    const res = await request(app).post("/api/v1/events").set(bearer).send(validRequest);

    const rows = await sql`
      select count(*)::int as n from event.assignments where event_id = ${res.body.id} and is_active
    `;
    expect(rows[0]!.n).toBe(1);
  });

  it("applies the rule consistently, taking the next coordinator in turn", async () => {
    const first = await request(app).post("/api/v1/events").set(bearer).send(validRequest);
    const second = await request(app).post("/api/v1/events").set(bearer).send(validRequest);

    expect(first.body.assignedCoordinatorId).toBe(COORDINATOR_A);
    expect(second.body.assignedCoordinatorId).toBe(COORDINATOR_B);
  });

  it("notifies the newly assigned coordinator", async () => {
    const res = await request(app).post("/api/v1/events").set(bearer).send(validRequest);

    const outbox = await sql`
      select envelope from event.outbox
      where message_key = ${res.body.id}
        and topic = 'connectsphere.event.coordinator-assigned.v1'
    `;
    expect(outbox[0]!.envelope.payload.coordinatorId).toBe(COORDINATOR_A);
  });
});

describe("POST /api/v1/event-drafts/:id/submit (C2)", () => {
  async function givenADraft(body: Record<string, unknown>) {
    const res = await request(app).post("/api/v1/event-drafts").set(bearer).send(body);
    return res.body;
  }

  it("moves the draft to Submitted and records the submission time", async () => {
    const draft = await givenADraft(validRequest);

    const res = await request(app).post(`/api/v1/event-drafts/${draft.id}/submit`).set(bearer).send();

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ status: "SUBMITTED" });
    expect(res.body.submittedAt).toBeTruthy();
  });

  it("stores and submits the values sent with the submission in one step", async () => {
    const draft = await givenADraft({ name: "Partly planned symposium", expectedAttendance: 100 });

    const res = await request(app)
      .post(`/api/v1/event-drafts/${draft.id}/submit`)
      .set(bearer)
      .send({ ...validRequest, name: "Partly planned symposium", expectedAttendance: 200 });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: draft.id, status: "SUBMITTED", expectedAttendance: 200 });
    const stored = await sql`select expected_attendance, status from event.events where id = ${draft.id}`;
    expect(stored[0]).toMatchObject({ expected_attendance: 200, status: "SUBMITTED" });
  });

  it("stores none of the sent values when the submission is blocked (B2)", async () => {
    const draft = await givenADraft({ name: "Partly planned symposium", expectedAttendance: 100 });

    const res = await request(app)
      .post(`/api/v1/event-drafts/${draft.id}/submit`)
      .set(bearer)
      .send({ name: "Partly planned symposium", expectedAttendance: 200 });

    expect(res.status).toBe(400);
    const stored = await sql`select expected_attendance, status from event.events where id = ${draft.id}`;
    expect(stored[0]).toMatchObject({ expected_attendance: 100, status: "DRAFT" });
  });

  it("validates the sent values rather than the stored ones, naming an emptied name", async () => {
    const draft = await givenADraft(validRequest);

    const res = await request(app)
      .post(`/api/v1/event-drafts/${draft.id}/submit`)
      .set(bearer)
      .send({ ...validRequest, name: "" });

    expect(res.status).toBe(400);
    expect(res.body.error.fields.map((field: { field: string }) => field.field)).toContain("name");
    const stored = await sql`select name, status from event.events where id = ${draft.id}`;
    expect(stored[0]).toMatchObject({ name: validRequest.name, status: "DRAFT" });
  });

  it("applies the full B2 validation when submitting from a draft", async () => {
    const draft = await givenADraft({ name: "Incomplete draft" });

    const res = await request(app).post(`/api/v1/event-drafts/${draft.id}/submit`).set(bearer).send();

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_FAILED");
  });

  it("submits the same record rather than copying it to a new one", async () => {
    const draft = await givenADraft(validRequest);

    const submitted = await request(app)
      .post(`/api/v1/event-drafts/${draft.id}/submit`)
      .set(bearer)
      .send();

    expect(submitted.body.id).toBe(draft.id);
    const rows = await sql`select status, reference from event.events where id = ${draft.id}`;
    expect(rows[0]!.status).toBe("SUBMITTED");
    expect(rows[0]!.reference).toMatch(/^EVT-\d{6}$/);
  });

  it("gives the submitted request its reference and submission time only on submission", async () => {
    const draft = await givenADraft(validRequest);

    const before = await sql`select reference, submitted_at from event.events where id = ${draft.id}`;
    expect(before[0]).toMatchObject({ reference: null, submitted_at: null });

    await request(app).post(`/api/v1/event-drafts/${draft.id}/submit`).set(bearer).send();

    const after = await sql`select reference, submitted_at from event.events where id = ${draft.id}`;
    expect(after[0]!.reference).toBeTruthy();
    expect(after[0]!.submitted_at).toBeTruthy();
  });

  it("keeps the draft's own history, so the submission continues one record", async () => {
    const draft = await givenADraft(validRequest);

    await request(app).post(`/api/v1/event-drafts/${draft.id}/submit`).set(bearer).send();

    const history = await sql`
      select previous_status, new_status from event.event_history where event_id = ${draft.id} and entry_type = 'STATUS_CHANGE'
    `;
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ previous_status: "DRAFT", new_status: "SUBMITTED" });
  });

  it("stops the request being edited through the draft screen once submitted", async () => {
    const draft = await givenADraft(validRequest);
    await request(app).post(`/api/v1/event-drafts/${draft.id}/submit`).set(bearer).send();

    const edit = await request(app)
      .put(`/api/v1/event-drafts/${draft.id}`)
      .set(bearer)
      .send({ ...validRequest, name: "Edited after submission" });

    expect(edit.status).toBe(404);
  });

  it("refuses to submit the same draft twice", async () => {
    const draft = await givenADraft(validRequest);
    await request(app).post(`/api/v1/event-drafts/${draft.id}/submit`).set(bearer).send();

    const again = await request(app).post(`/api/v1/event-drafts/${draft.id}/submit`).set(bearer).send();

    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe("DRAFT_ALREADY_SUBMITTED");
  });
});
