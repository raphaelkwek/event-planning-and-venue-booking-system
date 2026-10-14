import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { testDb } from "../../support/testDb.js";
import { EVENT_END, EVENT_START } from "../../support/eventDates.js";
import { deleteSeededEvents, seedEvent } from "../../support/seedEvent.js";

const ORGANISER = randomUUID();
const OTHER_ORGANISER = randomUUID();
const COORDINATOR = randomUUID();
const OTHER_COORDINATOR = randomUUID();
const FUTURE = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

process.env.EVENT_COORDINATOR_POOL = COORDINATOR;

vi.mock("../../../src/shared/auth/verifyJwt.js", () => ({
  verifyJwt: (req: { auth?: { supabaseUserId?: string } }, _res: unknown, next: () => void) => {
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
    role === "EVENT_COORDINATOR"
      ? { scopeType: "ALL" }
      : role === "ATTENDEE"
        ? { scopeType: "PUBLISHED_OPEN_REGISTRATION" }
        : { scopeType: "OWNED_BY_USER", userId }
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

async function addHistory(eventId: string, previous: string | null, next: string, role: string, at: string) {
  await sql`
    insert into event.event_history (
      event_id, entry_type, previous_status, new_status, actor_role, triggering_action, occurred_at
    ) values (${eventId}, 'STATUS_CHANGE', ${previous}, ${next}, ${role}, 'TEST', ${at})
  `;
}

const cleanUp = () => deleteSeededEvents(sql, [ORGANISER, OTHER_ORGANISER]);

beforeEach(async () => {
  vi.mocked(resolveCurrentUser).mockReset();
  vi.mocked(resolveEventsScope).mockReset();
  await cleanUp();
});

afterAll(async () => {
  await cleanUp();
  await sql.end();
});

describe("F2 - current status and status history", () => {
  it("shows the organiser the status and every change on their own event, oldest first (AC1, AC2, AC4)", async () => {
    signedInAs(ORGANISER, "EVENT_ORGANISER");
    const created = await request(app).post("/api/v1/events").set(bearer).send(validRequest);
    signedInAs(COORDINATOR, "EVENT_COORDINATOR");
    await request(app).get(`/api/v1/events/${created.body.id}`).set(bearer);
    await request(app).post(`/api/v1/events/${created.body.id}/approve`).set(bearer).send();

    signedInAs(ORGANISER, "EVENT_ORGANISER");
    const history = await request(app).get(`/api/v1/events/${created.body.id}/status-history`).set(bearer);
    const status = await request(app).get(`/api/v1/events/${created.body.id}/status`).set(bearer);

    expect(status.status).toBe(200);
    expect(status.body).toStrictEqual({ eventId: created.body.id, status: "APPROVED" });
    expect(history.status).toBe(200);
    expect(history.body.status).toBe("APPROVED");
    expect(
      history.body.items.map((e: Record<string, unknown>) => [e.previousStatus, e.newStatus, e.actorRole])
    ).toEqual([
      ["DRAFT", "SUBMITTED", "EVENT_ORGANISER"],
      ["SUBMITTED", "UNDER_REVIEW", "EVENT_COORDINATOR"],
      ["UNDER_REVIEW", "APPROVED", "EVENT_COORDINATOR"],
    ]);
    const times = history.body.items.map((e: { occurredAt: string }) => Date.parse(e.occurredAt));
    expect(times.every((t: number) => Number.isFinite(t))).toBe(true);
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it("lists entries by time even when they were stored out of order (AC4)", async () => {
    const id = await seedEvent(sql, { ownerId: ORGANISER, status: "PLANNING", endsAt: FUTURE });
    await addHistory(id, "APPROVED", "PLANNING", "EVENT_COORDINATOR", "2026-10-03T00:00:00Z");
    await addHistory(id, "DRAFT", "SUBMITTED", "EVENT_ORGANISER", "2026-10-01T00:00:00Z");
    await addHistory(id, "UNDER_REVIEW", "APPROVED", "EVENT_COORDINATOR", "2026-10-02T00:00:00Z");

    signedInAs(ORGANISER, "EVENT_ORGANISER");
    const history = await request(app).get(`/api/v1/events/${id}/status-history`).set(bearer);

    expect(history.body.items.map((e: { newStatus: string }) => e.newStatus)).toEqual([
      "SUBMITTED",
      "APPROVED",
      "PLANNING",
    ]);
  });

  it("returns exactly one entry for an event with one history entry (boundary)", async () => {
    signedInAs(ORGANISER, "EVENT_ORGANISER");
    const created = await request(app).post("/api/v1/events").set(bearer).send(validRequest);

    const history = await request(app).get(`/api/v1/events/${created.body.id}/status-history`).set(bearer);

    expect(history.status).toBe(200);
    expect(history.body.items).toHaveLength(1);
    expect(history.body.items[0]).toMatchObject({
      previousStatus: "DRAFT",
      newStatus: "SUBMITTED",
      actorRole: "EVENT_ORGANISER",
    });
  });

  it.each([COORDINATOR, OTHER_COORDINATOR])(
    "shows Event Coordinators generally the full history, assigned or not (AC2): %s",
    async (coordinatorId) => {
      signedInAs(ORGANISER, "EVENT_ORGANISER");
      const created = await request(app).post("/api/v1/events").set(bearer).send(validRequest);

      signedInAs(coordinatorId, "EVENT_COORDINATOR");
      const history = await request(app).get(`/api/v1/events/${created.body.id}/status-history`).set(bearer);

      expect(history.status).toBe(200);
      expect(history.body.items).toHaveLength(1);
    }
  );

  it("leaves field amendments out of the status history", async () => {
    const id = await seedEvent(sql, { ownerId: ORGANISER, status: "APPROVED", endsAt: FUTURE });
    await addHistory(id, "UNDER_REVIEW", "APPROVED", "EVENT_COORDINATOR", "2026-10-02T00:00:00Z");
    await sql`
      insert into event.event_history (event_id, entry_type, field_name, previous_value, new_value, actor_role, triggering_action)
      values (${id}, 'FIELD_CHANGE', 'purpose', 'a', 'b', 'EVENT_ORGANISER', 'TEST')
    `;

    signedInAs(ORGANISER, "EVENT_ORGANISER");
    const history = await request(app).get(`/api/v1/events/${id}/status-history`).set(bearer);

    expect(history.body.items).toHaveLength(1);
    expect(history.body.items[0].newStatus).toBe("APPROVED");
  });

  it("never gives an attendee the history, and gives no event data at all outside their scope (AC3)", async () => {
    const id = await seedEvent(sql, { ownerId: ORGANISER, status: "REJECTED", endsAt: FUTURE });
    await sql`update event.events set rejection_reason = 'No suitable venue is available.' where id = ${id}`;
    await addHistory(id, "UNDER_REVIEW", "REJECTED", "EVENT_COORDINATOR", "2026-10-02T00:00:00Z");

    signedInAs(randomUUID(), "ATTENDEE");
    const history = await request(app).get(`/api/v1/events/${id}/status-history`).set(bearer);
    const status = await request(app).get(`/api/v1/events/${id}/status`).set(bearer);

    expect(history.status).toBe(403);
    expect(history.body.error.code).toBe("ROLE_NOT_AUTHORISED");
    expect(status.status).toBe(404);
    for (const response of [history, status]) {
      expect(JSON.stringify(response.body)).not.toContain("No suitable venue");
      expect(JSON.stringify(response.body)).not.toContain("REJECTED");
    }
  });

  it.each(["VENUE_STAFF", "TECH_SUPPORT_STAFF"])("refuses the history to %s", async (role) => {
    const id = await seedEvent(sql, { ownerId: ORGANISER, status: "APPROVED", endsAt: FUTURE });
    signedInAs(randomUUID(), role);

    const history = await request(app).get(`/api/v1/events/${id}/status-history`).set(bearer);

    expect(history.status).toBe(403);
    expect(history.body.error.code).toBe("ROLE_NOT_AUTHORISED");
  });

  it("answers 404 and no data for another organiser's event (A3)", async () => {
    const id = await seedEvent(sql, { ownerId: ORGANISER, status: "APPROVED", endsAt: FUTURE });
    await addHistory(id, "UNDER_REVIEW", "APPROVED", "EVENT_COORDINATOR", "2026-10-02T00:00:00Z");
    signedInAs(OTHER_ORGANISER, "EVENT_ORGANISER");

    const history = await request(app).get(`/api/v1/events/${id}/status-history`).set(bearer);
    const status = await request(app).get(`/api/v1/events/${id}/status`).set(bearer);

    for (const response of [history, status]) {
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("EVENT_NOT_FOUND");
      expect(JSON.stringify(response.body)).not.toContain("APPROVED");
    }
  });

  it("does not show a coordinator another organiser's draft (A3)", async () => {
    const id = await seedEvent(sql, { ownerId: ORGANISER, status: "DRAFT", endsAt: FUTURE });
    signedInAs(COORDINATOR, "EVENT_COORDINATOR");

    const history = await request(app).get(`/api/v1/events/${id}/status-history`).set(bearer);

    expect(history.status).toBe(404);
  });

  it.each(["status-history", "status"])("answers 404 for an unknown or malformed id on /%s", async (leaf) => {
    signedInAs(COORDINATOR, "EVENT_COORDINATOR");

    const unknown = await request(app).get(`/api/v1/events/${randomUUID()}/${leaf}`).set(bearer);
    const malformed = await request(app).get(`/api/v1/events/not-a-uuid/${leaf}`).set(bearer);

    expect(unknown.status).toBe(404);
    expect(malformed.status).toBe(404);
    expect(malformed.body.error.code).toBe("EVENT_NOT_FOUND");
  });

  it("offers no way to change a history entry (AC5)", async () => {
    const id = await seedEvent(sql, { ownerId: ORGANISER, status: "APPROVED", endsAt: FUTURE });
    await addHistory(id, "UNDER_REVIEW", "APPROVED", "EVENT_COORDINATOR", "2026-10-02T00:00:00Z");
    signedInAs(COORDINATOR, "EVENT_COORDINATOR");
    const path = `/api/v1/events/${id}/status-history`;

    const attempts = [
      await request(app).delete(path).set(bearer),
      await request(app).put(path).set(bearer).send({ items: [] }),
      await request(app).patch(path).set(bearer).send({ newStatus: "CONFIRMED" }),
      await request(app).post(path).set(bearer).send({ newStatus: "CONFIRMED" }),
    ];

    expect(attempts.map((r) => r.status)).toEqual([404, 404, 404, 404]);
    const [{ count }] = await sql`select count(*)::int as count from event.event_history where event_id = ${id}`;
    expect(count).toBe(1);
  });
});
