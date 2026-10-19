import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import request from "supertest";

/**
 * T2 — reading and managing my notifications, against the notification schema.
 * Who the caller is comes from identity (planning-core's GET /users/me); here
 * that lookup is replaced, so each test says who is signed in.
 */

vi.mock("../../src/api/identity.js", async () => {
  const actual = await vi.importActual<typeof import("../../src/api/identity.js")>("../../src/api/identity.js");
  return { ...actual, resolveCaller: vi.fn() };
});

const { resolveCaller, CallerRefusedError, IdentityUnavailableError } = await import("../../src/api/identity.js");
const { app } = await import("../../src/app.js");

const sql = postgres(process.env.DATABASE_URL!, { max: 2, prepare: false });
const ME = randomUUID();
const SOMEONE_ELSE = randomUUID();
const bearer = { Authorization: "Bearer test-token" };

function signedInAs(id: string, role = "EVENT_ORGANISER") {
  vi.mocked(resolveCaller).mockResolvedValue({ id, email: "user@connectsphere.test", role: role as never });
}

/** Stores a notification as the consumer would, `minutesAgo` before now. */
async function notify(recipient: string, minutesAgo: number, message = `Message ${minutesAgo}`) {
  const messageId = randomUUID();
  await sql`insert into notification.consumed_messages (message_id, consumer) values (${messageId}, 'test')`;
  const [row] = await sql`
    insert into notification.notifications
      (recipient_user_id, notification_type, event_id, event_reference, message, source_message_id, occurred_at, created_at)
    values
      (${recipient}, 'event.approved', ${randomUUID()}, 'EVT-TEST', ${message}, ${messageId},
       now() - make_interval(mins => ${minutesAgo}), now() - make_interval(mins => ${minutesAgo}))
    returning id
  `;
  return row!.id as string;
}

async function cleanUp() {
  const ours = sql`select source_message_id from notification.notifications where recipient_user_id in ${sql([ME, SOMEONE_ELSE])}`;
  const ids = (await ours).map((r) => r.source_message_id);
  await sql`delete from notification.notifications where recipient_user_id in ${sql([ME, SOMEONE_ELSE])}`;
  if (ids.length) await sql`delete from notification.consumed_messages where message_id in ${sql(ids)}`;
}

beforeEach(async () => {
  await cleanUp();
  signedInAs(ME);
});
afterAll(async () => {
  await cleanUp();
  await sql.end();
});

describe("GET /api/v1/notifications (T2)", () => {
  it("lists only my own notifications, newest first, with my unread count", async () => {
    await notify(ME, 30, "Older");
    await notify(ME, 5, "Newer");
    await notify(SOMEONE_ELSE, 1, "Not mine");

    const res = await request(app).get("/api/v1/notifications").set(bearer);

    expect(res.status).toBe(200);
    expect(res.body.items.map((n: { message: string }) => n.message)).toEqual(["Newer", "Older"]);
    expect(res.body.unreadCount).toBe(2);
    expect(res.body.items[0]).toMatchObject({
      notificationType: "event.approved",
      eventReference: "EVT-TEST",
      relatedReference: null,
      readAt: null,
    });
    expect(res.body.items[0].eventId).toMatch(/^[0-9a-f-]{36}$/);
    expect(new Date(res.body.items[0].createdAt).getTime()).toBeGreaterThan(new Date(res.body.items[1].createdAt).getTime());
  });

  it("pages through older notifications with a cursor", async () => {
    await notify(ME, 30, "Third");
    await notify(ME, 20, "Second");
    await notify(ME, 10, "First");

    const first = await request(app).get("/api/v1/notifications?limit=2").set(bearer);
    expect(first.body.items.map((n: { message: string }) => n.message)).toEqual(["First", "Second"]);
    expect(first.body.nextCursor).toEqual(expect.any(String));

    const next = await request(app).get(`/api/v1/notifications?limit=2&cursor=${first.body.nextCursor}`).set(bearer);
    expect(next.body.items.map((n: { message: string }) => n.message)).toEqual(["Third"]);
    expect(next.body.nextCursor).toBeNull();
    expect(next.body.unreadCount).toBe(3);
  });

  it("refuses a limit outside 1 to 100, and a cursor it did not issue", async () => {
    for (const query of ["limit=0", "limit=101", "limit=ten", "cursor=nonsense"]) {
      const res = await request(app).get(`/api/v1/notifications?${query}`).set(bearer);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_FAILED");
    }
  });

  it("refuses a request with no token", async () => {
    const res = await request(app).get("/api/v1/notifications");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("passes identity's refusal on: an unknown or deactivated user is not signed in", async () => {
    vi.mocked(resolveCaller).mockRejectedValue(new CallerRefusedError(401, "UNAUTHENTICATED", "No active session for this token."));
    const res = await request(app).get("/api/v1/notifications").set(bearer);
    expect(res.status).toBe(401);
    expect(res.body.error).toMatchObject({ code: "UNAUTHENTICATED", message: "No active session for this token." });
  });

  it("refuses rather than guesses when identity cannot be reached (CP)", async () => {
    vi.mocked(resolveCaller).mockRejectedValue(new IdentityUnavailableError("connect ECONNREFUSED"));
    const res = await request(app).get("/api/v1/notifications").set(bearer);
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("IDENTITY_UNAVAILABLE");
  });
});

describe("POST /api/v1/notifications/:id/read (T2)", () => {
  it("marks one of my notifications read, leaving the others unread", async () => {
    const one = await notify(ME, 10);
    await notify(ME, 5);

    const res = await request(app).post(`/api/v1/notifications/${one}/read`).set(bearer);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: one, readAt: expect.any(String), unreadCount: 1 });
    const [row] = await sql`select read_at, updated_by from notification.notifications where id = ${one}`;
    expect(row!.read_at).toBeInstanceOf(Date);
    expect(row!.updated_by).toBe(ME);
  });

  it("keeps the first time it was read when marked read again", async () => {
    const one = await notify(ME, 10);
    const first = await request(app).post(`/api/v1/notifications/${one}/read`).set(bearer);
    const again = await request(app).post(`/api/v1/notifications/${one}/read`).set(bearer);
    expect(again.status).toBe(200);
    expect(again.body.readAt).toBe(first.body.readAt);
  });

  it("answers 404 for someone else's notification, and leaves it unread", async () => {
    const theirs = await notify(SOMEONE_ELSE, 10);
    const res = await request(app).post(`/api/v1/notifications/${theirs}/read`).set(bearer);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOTIFICATION_NOT_FOUND");
    const [row] = await sql`select read_at from notification.notifications where id = ${theirs}`;
    expect(row!.read_at).toBeNull();
  });

  it("answers 404 for an id that is not a notification", async () => {
    for (const id of [randomUUID(), "not-a-uuid"]) {
      const res = await request(app).post(`/api/v1/notifications/${id}/read`).set(bearer);
      expect(res.status).toBe(404);
    }
  });
});

describe("POST /api/v1/notifications/read-all (T2)", () => {
  it("marks all of my notifications read in one action, and nobody else's", async () => {
    await notify(ME, 10);
    await notify(ME, 5);
    const theirs = await notify(SOMEONE_ELSE, 1);

    const res = await request(app).post("/api/v1/notifications/read-all").set(bearer);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ updated: 2, unreadCount: 0 });
    const [their] = await sql`select read_at from notification.notifications where id = ${theirs}`;
    expect(their!.read_at).toBeNull();
  });
});
