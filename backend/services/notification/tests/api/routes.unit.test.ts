import { afterEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import type { Sql } from "postgres";

/**
 * T2: the refusals the notification API gives before it reaches the database,
 * so CI checks them on every pull request. What needs Postgres is in
 * notifications.test.ts.
 */

vi.mock("../../src/api/identity.js", async () => {
  const actual = await vi.importActual<typeof import("../../src/api/identity.js")>("../../src/api/identity.js");
  return { ...actual, resolveCaller: vi.fn() };
});

const { resolveCaller, CallerRefusedError, IdentityUnavailableError } = await import("../../src/api/identity.js");
const { notificationsRouter } = await import("../../src/api/notifications.js");

/** A database stand-in that fails the test if a refusal reaches it. */
const untouchedDb = (() => {
  throw new Error("the database should not be touched");
}) as unknown as Sql;

const app = express().use(notificationsRouter(untouchedDb));
const bearer = { Authorization: "Bearer test-token" };

afterEach(() => vi.mocked(resolveCaller).mockReset());

function signedIn() {
  vi.mocked(resolveCaller).mockResolvedValue({ id: "00000000-0000-0000-0000-000000000001", email: "a@b.test", role: "EVENT_ORGANISER" });
}

describe("who is calling", () => {
  it("refuses a request without a bearer token, asking nobody", async () => {
    const res = await request(app).get("/api/v1/notifications");
    expect(res.status).toBe(401);
    expect(res.body.error).toMatchObject({ code: "UNAUTHENTICATED", correlationId: null });
    expect(resolveCaller).not.toHaveBeenCalled();
  });

  it("passes on identity's refusal of a user with no role", async () => {
    vi.mocked(resolveCaller).mockRejectedValue(new CallerRefusedError(403, "NO_ROLE_ASSIGNED", "This user has no assigned role."));
    const res = await request(app).post("/api/v1/notifications/read-all").set(bearer);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("NO_ROLE_ASSIGNED");
  });

  it("is unavailable, and does nothing, when identity cannot be reached", async () => {
    vi.mocked(resolveCaller).mockRejectedValue(new IdentityUnavailableError("timeout"));
    const res = await request(app).post("/api/v1/notifications/read-all").set(bearer);
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("IDENTITY_UNAVAILABLE");
  });

  it("hands anything else to Express's error handling", async () => {
    vi.mocked(resolveCaller).mockRejectedValue(new Error("unexpected"));
    const res = await request(app).get("/api/v1/notifications").set(bearer);
    expect(res.status).toBe(500);
  });
});

describe("refusals before the database", () => {
  it.each(["0", "101", "1.5", "ten"])("refuses limit=%s, naming the parameter", async (limit) => {
    signedIn();
    const res = await request(app).get(`/api/v1/notifications?limit=${limit}`).set(bearer);
    expect(res.status).toBe(400);
    expect(res.body.error.fields).toEqual([{ field: "limit", message: "Give a whole number from 1 to 100." }]);
  });

  it.each(["nonsense", Buffer.from('{"createdAt":"never","id":"x"}').toString("base64url")])(
    "refuses a cursor it did not issue (%s)",
    async (cursor) => {
      signedIn();
      const res = await request(app).get(`/api/v1/notifications?cursor=${cursor}`).set(bearer);
      expect(res.status).toBe(400);
      expect(res.body.error.fields[0].field).toBe("cursor");
    },
  );

  it("answers 404 for an id that is not a notification id", async () => {
    signedIn();
    const res = await request(app).post("/api/v1/notifications/not-a-uuid/read").set(bearer);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOTIFICATION_NOT_FOUND");
  });
});
