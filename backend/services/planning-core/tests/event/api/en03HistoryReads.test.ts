import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { testDb } from "../../support/testDb.js";
import { assignForTest } from "../../support/assignment.js";
import { EVENT_END, EVENT_START } from "../../support/eventDates.js";
import { deleteSeededEvents, seedEvent } from "../../support/seedEvent.js";

/**
 * EN-03 criterion 4 — F1's and F2's history reads come from the stream. Each
 * test removes or never writes the history projection's rows, so a read that
 * still answers can only have read the stream.
 */

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
const { latestStatusChangeAt } = await import("../../../src/modules/event/repo/eventHistory.js");

const sql = testDb();
const ORGANISER = randomUUID();
const COORDINATOR = randomUUID();
const bearer = { Authorization: "Bearer test-token" };

function signedInAs(userId: string, role: "EVENT_ORGANISER" | "EVENT_COORDINATOR") {
  vi.mocked(resolveCurrentUser).mockResolvedValue({ id: userId, email: "user@connectsphere.test", role });
  vi.mocked(resolveEventsScope).mockResolvedValue(
    role === "EVENT_COORDINATOR" ? { scopeType: "ALL" } : { scopeType: "OWNED_BY_USER", userId }
  );
}

const validRequest = {
  name: "Stream-backed history",
  purpose: "Check where history is read from",
  description: "EN-03",
  proposedStartAt: EVENT_START,
  proposedEndAt: EVENT_END,
  expectedAttendance: 150,
  registrationRequired: false,
  equipmentRequired: false,
};

beforeEach(async () => {
  vi.mocked(resolveCurrentUser).mockReset();
  vi.mocked(resolveEventsScope).mockReset();
  await deleteSeededEvents(sql, [ORGANISER]);
});

afterAll(async () => {
  await deleteSeededEvents(sql, [ORGANISER]);
  await sql.end();
});

describe("F1 and F2 read the stream (EN-03 criterion 4)", () => {
  it("EN-03-T12 F2's status history is read from the stream", async () => {
    signedInAs(ORGANISER, "EVENT_ORGANISER");
    const created = await request(app).post("/api/v1/events").set(bearer).send(validRequest);
    expect(created.status).toBe(201);
    const id: string = created.body.id;
    await assignForTest(sql, created.body, COORDINATOR);
    signedInAs(COORDINATOR, "EVENT_COORDINATOR");
    await request(app).get(`/api/v1/events/${id}`).set(bearer);
    const approved = await request(app).post(`/api/v1/events/${id}/approve`).set(bearer).send();
    expect(approved.status).toBe(200);

    signedInAs(ORGANISER, "EVENT_ORGANISER");
    const before = await request(app).get(`/api/v1/events/${id}/status-history`).set(bearer);

    // Test-only: removing the projection's rows leaves the stream as the only record.
    await sql`delete from event.event_history where event_id = ${id}`;
    const after = await request(app).get(`/api/v1/events/${id}/status-history`).set(bearer);

    expect(after.status).toBe(200);
    expect(after.body).toStrictEqual(before.body);
    expect(after.body).toMatchObject({ eventId: id, status: "APPROVED", nextCursor: null });
    expect(
      after.body.items.map((e: Record<string, unknown>) => [e.previousStatus, e.newStatus, e.actorRole, e.triggeringAction])
    ).toEqual([
      ["DRAFT", "SUBMITTED", "EVENT_ORGANISER", "SUBMIT"],
      ["SUBMITTED", "UNDER_REVIEW", "EVENT_COORDINATOR", "OPEN_FOR_REVIEW"],
      ["UNDER_REVIEW", "APPROVED", "EVENT_COORDINATOR", "APPROVE"],
    ]);
    for (const item of after.body.items) {
      expect(Object.keys(item).sort()).toEqual([
        "actorRole",
        "actorUserId",
        "id",
        "newStatus",
        "occurredAt",
        "previousStatus",
        "triggeringAction",
      ]);
    }
    const times = after.body.items.map((e: { occurredAt: string }) => Date.parse(e.occurredAt));
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it("EN-03-T13 F5's confirmation takes the time of the latest status change from the stream", async () => {
    const id = await seedEvent(sql, { ownerId: ORGANISER, status: "PLANNING", endsAt: new Date("2030-06-01T12:00:00Z") });
    // Appended to the stream only: no history projection row is written for either.
    for (const [previous, next, at] of [
      ["UNDER_REVIEW", "APPROVED", "2026-10-01T00:00:00Z"],
      ["APPROVED", "PLANNING", "2026-10-02T00:00:00Z"],
    ]) {
      await sql`
        select event.append_to_stream(
          ${id}::uuid, 'STATUS_CHANGE',
          event.history_entry_data('STATUS_CHANGE', ${previous}::text, ${next}::text, null, null, null, 'TEST'),
          ${COORDINATOR}::uuid, 'EVENT_COORDINATOR', ${at}::timestamptz
        )
      `;
    }
    const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from event.event_history where event_id = ${id}`;
    expect(n).toBe(0);

    expect(await sql.begin((tx) => latestStatusChangeAt(tx, id))).toBe("2026-10-02T00:00:00.000Z");
  });
});
