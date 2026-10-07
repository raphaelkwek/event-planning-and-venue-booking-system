import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { testDb } from "../../support/testDb.js";
import { EVENT_END, EVENT_START } from "../../support/eventDates.js";
import { deleteSeededEvents } from "../../support/seedEvent.js";

const ORGANISER = randomUUID();
const COORDINATOR = randomUUID();

process.env.EVENT_COORDINATOR_POOL = COORDINATOR;

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

const bearer = { Authorization: "Bearer test-token" };

function signedInAs(userId: string, role: string) {
  vi.mocked(resolveCurrentUser).mockResolvedValue({
    id: userId,
    email: "user@connectsphere.test",
    role: role as never,
  });
  vi.mocked(resolveEventsScope).mockResolvedValue(
    role === "EVENT_COORDINATOR" ? { scopeType: "ALL" } : { scopeType: "OWNED_BY_USER", userId }
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
  await deleteSeededEvents(sql, [ORGANISER]);
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

describe("status history (F1)", () => {
  it("records every change on the way to Approved with both statuses, the actor, role, action and time", async () => {
    signedInAs(ORGANISER, "EVENT_ORGANISER");
    const created = await request(app).post("/api/v1/events").set(bearer).send(validRequest);
    signedInAs(COORDINATOR, "EVENT_COORDINATOR");
    const opened = await request(app).get(`/api/v1/events/${created.body.id}`).set(bearer);
    const approved = await request(app).post(`/api/v1/events/${created.body.id}/approve`).set(bearer).send();
    expect(created.status).toBe(201);
    expect(opened.status).toBe(200);
    expect(approved.status).toBe(200);

    const history = await sql`
      select previous_status, new_status, actor_user_id, actor_role, triggering_action, occurred_at
      from event.event_history
      where event_id = ${created.body.id} and entry_type = 'STATUS_CHANGE'
      order by occurred_at, id
    `;

    expect(history.map((entry) => ({
        previous_status: entry.previous_status,
        new_status: entry.new_status,
        actor_user_id: entry.actor_user_id,
        actor_role: entry.actor_role,
        triggering_action: entry.triggering_action,
      }))).toEqual([
      {
        previous_status: "DRAFT",
        new_status: "SUBMITTED",
        actor_user_id: ORGANISER,
        actor_role: "EVENT_ORGANISER",
        triggering_action: "SUBMIT",
      },
      {
        previous_status: "SUBMITTED",
        new_status: "UNDER_REVIEW",
        actor_user_id: COORDINATOR,
        actor_role: "EVENT_COORDINATOR",
        triggering_action: "OPEN_FOR_REVIEW",
      },
      {
        previous_status: "UNDER_REVIEW",
        new_status: "APPROVED",
        actor_user_id: COORDINATOR,
        actor_role: "EVENT_COORDINATOR",
        triggering_action: "APPROVE",
      },
    ]);
    expect(history.every((entry) => entry.occurred_at !== null)).toBe(true);
  });
});
