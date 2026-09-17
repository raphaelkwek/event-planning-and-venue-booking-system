import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { testDb } from "../support/testDb.js";

process.env.EVENT_COORDINATOR_POOL = "a6666666-0000-0000-0000-00000000000a";

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

const ORGANISER = "a6666666-0000-0000-0000-000000000001";
const OTHER_ORGANISER = "a6666666-0000-0000-0000-000000000002";
const COORDINATOR = "a6666666-0000-0000-0000-000000000003";
const OWNERS = [ORGANISER, OTHER_ORGANISER];
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
  await sql`delete from event.clarifications where event_id in (${owned})`;
  await sql`delete from event.event_history where event_id in (${owned})`;
  await sql`delete from event.assignments where event_id in (${owned})`;
  await sql`delete from event.outbox where envelope->'payload'->>'ownerId' in ${sql(OWNERS)}`;
  await sql`delete from event.events where owner_id in ${sql(OWNERS)}`;
}

/** An event a coordinator has opened, so it is Under Review and can be queried. */
async function givenEventUnderReview(owner = ORGANISER) {
  signedInAs(owner, "EVENT_ORGANISER");
  const created = await request(app).post("/api/v1/events").set(bearer).send(validRequest);
  signedInAs(COORDINATOR, "EVENT_COORDINATOR");
  await request(app).get(`/api/v1/events/${created.body.id}`).set(bearer);
  return created.body;
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

describe("POST /api/v1/events/:id/clarifications (D2)", () => {
  it("moves the event to Awaiting Clarification, recording who asked and when", async () => {
    const event = await givenEventUnderReview();

    const res = await request(app)
      .post(`/api/v1/events/${event.id}/clarifications`)
      .set(bearer)
      .send({ message: "Please confirm the catering requirements." });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ requestedBy: COORDINATOR, status: "OPEN" });
    expect(res.body.requestedAt).toBeTruthy();

    const stored = await sql`select status from event.events where id = ${event.id}`;
    expect(stored[0]!.status).toBe("AWAITING_CLARIFICATION");
  });

  it("refuses an empty message, storing nothing and leaving the status unchanged", async () => {
    const event = await givenEventUnderReview();

    const res = await request(app)
      .post(`/api/v1/events/${event.id}/clarifications`)
      .set(bearer)
      .send({ message: "   " });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_FAILED");

    const rows = await sql`select count(*)::int as n from event.clarifications where event_id = ${event.id}`;
    expect(rows[0]!.n).toBe(0);
    const stored = await sql`select status from event.events where id = ${event.id}`;
    expect(stored[0]!.status).toBe("UNDER_REVIEW");
  });

  it("notifies the organiser that clarification is required", async () => {
    const event = await givenEventUnderReview();

    await request(app)
      .post(`/api/v1/events/${event.id}/clarifications`)
      .set(bearer)
      .send({ message: "Please confirm the catering." });

    const outbox = await sql`
      select envelope from event.outbox
      where message_key = ${event.id} and topic = 'connectsphere.event.clarification-requested.v1'
    `;
    expect(outbox[0]!.envelope.payload.ownerId).toBe(ORGANISER);
  });

  it("retains multiple clarifications in order rather than overwriting", async () => {
    const event = await givenEventUnderReview();

    await request(app)
      .post(`/api/v1/events/${event.id}/clarifications`)
      .set(bearer)
      .send({ message: "First question" });
    signedInAs(ORGANISER, "EVENT_ORGANISER");
    await request(app)
      .post(`/api/v1/events/${event.id}/clarifications/respond`)
      .set(bearer)
      .send({ message: "First answer" });
    signedInAs(COORDINATOR, "EVENT_COORDINATOR");
    await request(app)
      .post(`/api/v1/events/${event.id}/clarifications`)
      .set(bearer)
      .send({ message: "Second question" });

    const res = await request(app).get(`/api/v1/events/${event.id}/clarifications`).set(bearer);

    expect(res.body.items.map((item: any) => item.message)).toEqual([
      "First question",
      "Second question",
    ]);
  });

  it("refuses a role that is not an Event Coordinator (A2)", async () => {
    const event = await givenEventUnderReview();
    signedInAs(ORGANISER, "EVENT_ORGANISER");

    const res = await request(app)
      .post(`/api/v1/events/${event.id}/clarifications`)
      .set(bearer)
      .send({ message: "Asking about my own event" });

    expect(res.status).toBe(403);
  });

  it("refuses a clarification on an event that is not under review (F1)", async () => {
    signedInAs(ORGANISER, "EVENT_ORGANISER");
    const created = await request(app).post("/api/v1/events").set(bearer).send(validRequest);
    signedInAs(COORDINATOR, "EVENT_COORDINATOR");

    const res = await request(app)
      .post(`/api/v1/events/${created.body.id}/clarifications`)
      .set(bearer)
      .send({ message: "Too early" });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("STATUS_TRANSITION_NOT_PERMITTED");
  });
});

describe("POST /api/v1/events/:id/clarifications/respond (D3)", () => {
  async function givenAwaitingClarification(owner = ORGANISER) {
    const event = await givenEventUnderReview(owner);
    await request(app)
      .post(`/api/v1/events/${event.id}/clarifications`)
      .set(bearer)
      .send({ message: "Please confirm the expected attendance." });
    signedInAs(owner, "EVENT_ORGANISER");
    return event;
  }

  it("lets the owning organiser see the outstanding clarification", async () => {
    const event = await givenAwaitingClarification();

    const res = await request(app).get(`/api/v1/events/${event.id}/clarifications`).set(bearer);

    expect(res.status).toBe(200);
    expect(res.body.items[0]).toMatchObject({
      message: "Please confirm the expected attendance.",
      status: "OPEN",
    });
  });

  it("returns the event to Under Review and records the response time", async () => {
    const event = await givenAwaitingClarification();

    const res = await request(app)
      .post(`/api/v1/events/${event.id}/clarifications/respond`)
      .set(bearer)
      .send({ message: "We now expect 200 people." });

    expect(res.status).toBe(200);
    expect(res.body.clarification).toMatchObject({ status: "RESPONDED", respondedBy: ORGANISER });
    expect(res.body.clarification.respondedAt).toBeTruthy();
    expect(res.body.event.status).toBe("UNDER_REVIEW");
  });

  it("accepts an amendment with no message", async () => {
    const event = await givenAwaitingClarification();

    const res = await request(app)
      .post(`/api/v1/events/${event.id}/clarifications/respond`)
      .set(bearer)
      .send({ amendments: { expectedAttendance: 200 } });

    expect(res.status).toBe(200);
    expect(res.body.event.expectedAttendance).toBe(200);
  });

  it("refuses a response with neither a message nor an amendment, recording no timestamp", async () => {
    const event = await givenAwaitingClarification();

    const res = await request(app)
      .post(`/api/v1/events/${event.id}/clarifications/respond`)
      .set(bearer)
      .send({});

    expect(res.status).toBe(400);
    const rows = await sql`select responded_at from event.clarifications where event_id = ${event.id}`;
    expect(rows[0]!.responded_at).toBeNull();
  });

  it("retains the value as originally submitted alongside the amended value", async () => {
    const event = await givenAwaitingClarification();

    await request(app)
      .post(`/api/v1/events/${event.id}/clarifications/respond`)
      .set(bearer)
      .send({ amendments: { expectedAttendance: 200 } });

    const edits = await sql`
      select field_name, previous_value, new_value, actor_role, triggering_action
      from event.event_history
      where event_id = ${event.id} and entry_type = 'FIELD_CHANGE'
    `;
    expect(edits[0]).toMatchObject({
      field_name: "expectedAttendance",
      previous_value: "150",
      new_value: "200",
      actor_role: "EVENT_ORGANISER",
      triggering_action: "RESPOND_TO_CLARIFICATION",
    });
  });

  it("lets the organiser amend the venue requirements, keeping the original in the history", async () => {
    const event = await givenAwaitingClarification();
    const venueRequirements = { layout: "Banquet", facilities: ["Projector"], notes: null };

    const res = await request(app)
      .post(`/api/v1/events/${event.id}/clarifications/respond`)
      .set(bearer)
      .send({ amendments: { venueRequirements } });

    expect(res.status).toBe(200);
    expect(res.body.event.venueRequirements).toEqual(venueRequirements);
    const edits = await sql`
      select field_name, previous_value, new_value from event.event_history
      where event_id = ${event.id} and entry_type = 'FIELD_CHANGE'
    `;
    expect(edits[0]).toMatchObject({ field_name: "venueRequirements", previous_value: null });
    expect(JSON.parse(edits[0]!.new_value)).toEqual(venueRequirements);
  });

  it("notifies the coordinator who asked for the clarification", async () => {
    const event = await givenAwaitingClarification();

    await request(app)
      .post(`/api/v1/events/${event.id}/clarifications/respond`)
      .set(bearer)
      .send({ message: "Answered." });

    const outbox = await sql`
      select envelope from event.outbox
      where message_key = ${event.id} and topic = 'connectsphere.event.clarification-responded.v1'
    `;
    expect(outbox[0]!.envelope.payload.requestedBy).toBe(COORDINATOR);
  });

  it("gives an organiser who does not own the event no clarification content", async () => {
    const event = await givenAwaitingClarification(OTHER_ORGANISER);
    signedInAs(ORGANISER, "EVENT_ORGANISER");

    const view = await request(app).get(`/api/v1/events/${event.id}/clarifications`).set(bearer);
    const answer = await request(app)
      .post(`/api/v1/events/${event.id}/clarifications/respond`)
      .set(bearer)
      .send({ message: "Not mine to answer" });

    expect(view.status).toBe(404);
    expect(answer.status).toBe(404);
  });
});
