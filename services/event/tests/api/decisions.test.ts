import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { testDb } from "../support/testDb.js";

process.env.EVENT_COORDINATOR_POOL = "a7777777-0000-0000-0000-00000000000a";

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

const ORGANISER = "a7777777-0000-0000-0000-000000000001";
const COORDINATOR = "a7777777-0000-0000-0000-000000000002";
const OTHER_COORDINATOR = "a7777777-0000-0000-0000-000000000003";
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
  await sql`delete from event.event_field_edits where event_id in (${owned})`;
  await sql`delete from event.clarifications where event_id in (${owned})`;
  await sql`delete from event.status_history where event_id in (${owned})`;
  await sql`delete from event.assignments where event_id in (${owned})`;
  await sql`delete from event.outbox where envelope->'payload'->>'ownerId' in ${sql(OWNERS)}`;
  await sql`delete from event.events where owner_id in ${sql(OWNERS)}`;
}

async function givenSubmittedEvent() {
  signedInAs(ORGANISER, "EVENT_ORGANISER");
  const created = await request(app).post("/api/v1/events").set(bearer).send(validRequest);
  return created.body;
}

/** Opened by a coordinator, so the event is Under Review. */
async function givenEventUnderReview() {
  const event = await givenSubmittedEvent();
  signedInAs(COORDINATOR, "EVENT_COORDINATOR");
  await request(app).get(`/api/v1/events/${event.id}`).set(bearer);
  return event;
}

async function givenEventAwaitingClarification() {
  const event = await givenEventUnderReview();
  await request(app)
    .post(`/api/v1/events/${event.id}/clarifications`)
    .set(bearer)
    .send({ message: "Please confirm the attendance." });
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

describe("POST /api/v1/events/:id/approve (D4)", () => {
  it("approves an event that is Under Review, recording the coordinator and the time", async () => {
    const event = await givenEventUnderReview();

    const res = await request(app).post(`/api/v1/events/${event.id}/approve`).set(bearer).send();

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "APPROVED", decidedBy: COORDINATOR });
    expect(res.body.decidedAt).toBeTruthy();
  });

  it("approves an event that is Awaiting Clarification", async () => {
    const event = await givenEventAwaitingClarification();

    const res = await request(app).post(`/api/v1/events/${event.id}/approve`).set(bearer).send();

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("APPROVED");
  });

  it("refuses to approve an event that has not been opened for review", async () => {
    const event = await givenSubmittedEvent();
    signedInAs(COORDINATOR, "EVENT_COORDINATOR");

    const res = await request(app).post(`/api/v1/events/${event.id}/approve`).set(bearer).send();

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("STATUS_TRANSITION_NOT_PERMITTED");
    expect(res.body.error.message).toContain("Submitted");
    expect(res.body.error.message).toContain("Approved");
  });

  it("shows the approval outcome and its date to the owning organiser", async () => {
    const event = await givenEventUnderReview();
    await request(app).post(`/api/v1/events/${event.id}/approve`).set(bearer).send();
    signedInAs(ORGANISER, "EVENT_ORGANISER");

    const res = await request(app).get(`/api/v1/events/${event.id}`).set(bearer);

    expect(res.body).toMatchObject({ status: "APPROVED" });
    expect(res.body.decidedAt).toBeTruthy();
  });

  it("notifies the organiser of the approval", async () => {
    const event = await givenEventUnderReview();

    await request(app).post(`/api/v1/events/${event.id}/approve`).set(bearer).send();

    const outbox = await sql`
      select envelope from event.outbox
      where message_key = ${event.id} and topic = 'connectsphere.event.approved.v1'
    `;
    expect(outbox).toHaveLength(1);
    expect(outbox[0]!.envelope.payload).toMatchObject({
      ownerId: ORGANISER,
      approvedBy: COORDINATOR,
    });
  });

  it("writes a history entry for the approval (F1)", async () => {
    const event = await givenEventUnderReview();

    await request(app).post(`/api/v1/events/${event.id}/approve`).set(bearer).send();

    const history = await sql`
      select previous_status, new_status, actor_role, triggering_action
      from event.status_history where event_id = ${event.id} order by occurred_at desc limit 1
    `;
    expect(history[0]).toMatchObject({
      previous_status: "UNDER_REVIEW",
      new_status: "APPROVED",
      actor_role: "EVENT_COORDINATOR",
      triggering_action: "APPROVE",
    });
  });

  it("creates no venue booking and no equipment reservation", async () => {
    const event = await givenEventUnderReview();

    const res = await request(app).post(`/api/v1/events/${event.id}/approve`).set(bearer).send();

    const topics = await sql`select topic from event.outbox where message_key = ${event.id}`;
    expect(topics.map((row) => row.topic)).not.toContain("connectsphere.booking.requested.v1");
    expect(res.body.status).toBe("APPROVED");
  });

  it("cannot approve an event that already carries a decision, writing no second timestamp", async () => {
    const event = await givenEventUnderReview();
    const first = await request(app).post(`/api/v1/events/${event.id}/approve`).set(bearer).send();

    signedInAs(OTHER_COORDINATOR, "EVENT_COORDINATOR");
    const second = await request(app).post(`/api/v1/events/${event.id}/approve`).set(bearer).send();

    expect(second.status).toBe(409);
    const stored = await sql`select decided_at, decided_by from event.events where id = ${event.id}`;
    expect(stored[0]!.decided_at.toISOString()).toBe(first.body.decidedAt);
    expect(stored[0]!.decided_by).toBe(COORDINATOR);
  });

  it("cannot approve an event that was already rejected", async () => {
    const event = await givenEventUnderReview();
    await request(app)
      .post(`/api/v1/events/${event.id}/reject`)
      .set(bearer)
      .send({ reason: "No suitable venue." });

    const res = await request(app).post(`/api/v1/events/${event.id}/approve`).set(bearer).send();

    expect(res.status).toBe(409);
    const stored = await sql`select status from event.events where id = ${event.id}`;
    expect(stored[0]!.status).toBe("REJECTED");
  });

  it("refuses a role that is not an Event Coordinator (A2)", async () => {
    const event = await givenEventUnderReview();
    signedInAs(ORGANISER, "EVENT_ORGANISER");

    const res = await request(app).post(`/api/v1/events/${event.id}/approve`).set(bearer).send();

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("ROLE_NOT_AUTHORISED");
    const stored = await sql`select status from event.events where id = ${event.id}`;
    expect(stored[0]!.status).toBe("UNDER_REVIEW");
  });
});

describe("POST /api/v1/events/:id/reject (D5)", () => {
  it("rejects an event with a reason, recording the coordinator and the time", async () => {
    const event = await givenEventUnderReview();

    const res = await request(app)
      .post(`/api/v1/events/${event.id}/reject`)
      .set(bearer)
      .send({ reason: "No venue can host 150 people on that date." });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: "REJECTED",
      decidedBy: COORDINATOR,
      rejectionReason: "No venue can host 150 people on that date.",
    });
    expect(res.body.decidedAt).toBeTruthy();
  });

  it("refuses a rejection with no reason, changing nothing", async () => {
    const event = await givenEventUnderReview();

    const res = await request(app).post(`/api/v1/events/${event.id}/reject`).set(bearer).send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_FAILED");
    const stored = await sql`select status, decided_at from event.events where id = ${event.id}`;
    expect(stored[0]).toMatchObject({ status: "UNDER_REVIEW", decided_at: null });
  });

  it("refuses a reason of whitespace only", async () => {
    const event = await givenEventUnderReview();

    const res = await request(app)
      .post(`/api/v1/events/${event.id}/reject`)
      .set(bearer)
      .send({ reason: "   " });

    expect(res.status).toBe(400);
    const stored = await sql`select decided_at from event.events where id = ${event.id}`;
    expect(stored[0]!.decided_at).toBeNull();
  });

  it("shows the reason to the owning organiser", async () => {
    const event = await givenEventUnderReview();
    await request(app)
      .post(`/api/v1/events/${event.id}/reject`)
      .set(bearer)
      .send({ reason: "Clashes with graduation." });
    signedInAs(ORGANISER, "EVENT_ORGANISER");

    const res = await request(app).get(`/api/v1/events/${event.id}`).set(bearer);

    expect(res.body.rejectionReason).toBe("Clashes with graduation.");
  });

  it("notifies the organiser of the rejection, including the reason", async () => {
    const event = await givenEventUnderReview();

    await request(app)
      .post(`/api/v1/events/${event.id}/reject`)
      .set(bearer)
      .send({ reason: "Clashes with graduation." });

    const outbox = await sql`
      select envelope from event.outbox
      where message_key = ${event.id} and topic = 'connectsphere.event.rejected.v1'
    `;
    expect(outbox[0]!.envelope.payload).toMatchObject({
      ownerId: ORGANISER,
      rejectedBy: COORDINATOR,
      reason: "Clashes with graduation.",
    });
  });

  it("writes a history entry for the rejection (F1)", async () => {
    const event = await givenEventUnderReview();

    await request(app)
      .post(`/api/v1/events/${event.id}/reject`)
      .set(bearer)
      .send({ reason: "Clashes with graduation." });

    const history = await sql`
      select previous_status, new_status, triggering_action from event.status_history
      where event_id = ${event.id} order by occurred_at desc limit 1
    `;
    expect(history[0]).toMatchObject({
      previous_status: "UNDER_REVIEW",
      new_status: "REJECTED",
      triggering_action: "REJECT",
    });
  });

  it("makes a rejected event read-only: it cannot be resubmitted", async () => {
    const event = await givenEventUnderReview();
    await request(app)
      .post(`/api/v1/events/${event.id}/reject`)
      .set(bearer)
      .send({ reason: "Clashes with graduation." });
    signedInAs(ORGANISER, "EVENT_ORGANISER");

    const res = await request(app)
      .post(`/api/v1/events/${event.id}/clarifications/respond`)
      .set(bearer)
      .send({ amendments: { expectedAttendance: 50 } });

    expect(res.status).toBe(409);
    const stored = await sql`select expected_attendance from event.events where id = ${event.id}`;
    expect(stored[0]!.expected_attendance).toBe(150);
  });

  it("cannot reject an event that already carries a decision", async () => {
    const event = await givenEventUnderReview();
    await request(app).post(`/api/v1/events/${event.id}/approve`).set(bearer).send();

    const res = await request(app)
      .post(`/api/v1/events/${event.id}/reject`)
      .set(bearer)
      .send({ reason: "Changed my mind." });

    expect(res.status).toBe(409);
    const stored = await sql`select status, rejection_reason from event.events where id = ${event.id}`;
    expect(stored[0]).toMatchObject({ status: "APPROVED", rejection_reason: null });
  });

  it("refuses a role that is not an Event Coordinator (A2)", async () => {
    const event = await givenEventUnderReview();
    signedInAs(ORGANISER, "EVENT_ORGANISER");

    const res = await request(app)
      .post(`/api/v1/events/${event.id}/reject`)
      .set(bearer)
      .send({ reason: "I give up on my own event." });

    expect(res.status).toBe(403);
    const stored = await sql`select status from event.events where id = ${event.id}`;
    expect(stored[0]!.status).toBe("UNDER_REVIEW");
  });
});
