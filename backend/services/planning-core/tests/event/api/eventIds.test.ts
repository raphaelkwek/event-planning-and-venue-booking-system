import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { testDb } from "../../support/testDb.js";

/**
 * Every event route answers 404 for an id that isn't a UUID. Before, the id
 * reached Postgres, which refused it (22P02); Express 4 doesn't catch an async
 * handler's rejection, so the request never got a response and the rejection
 * went unhandled, which stops the process.
 */

const ORGANISER = randomUUID();
const COORDINATOR = randomUUID();

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

function signedInAs(userId: string, role: "EVENT_ORGANISER" | "EVENT_COORDINATOR") {
  vi.mocked(resolveCurrentUser).mockResolvedValue({ id: userId, email: "user@connectsphere.test", role });
  vi.mocked(resolveEventsScope).mockResolvedValue(
    role === "EVENT_COORDINATOR" ? { scopeType: "ALL" } : { scopeType: "OWNED_BY_USER", userId }
  );
}

beforeEach(() => {
  vi.mocked(resolveCurrentUser).mockReset();
  vi.mocked(resolveEventsScope).mockReset();
});

afterAll(async () => {
  await sql.end();
});

describe("an event id that isn't a UUID", () => {
  it.each([
    ["GET", "/api/v1/events/not-a-uuid", "EVENT_NOT_FOUND"],
    ["POST", "/api/v1/events/not-a-uuid/approve", "EVENT_NOT_FOUND"],
    ["GET", "/api/v1/events/not-a-uuid/clarifications", "EVENT_NOT_FOUND"],
    ["GET", "/api/v1/events/not-a-uuid/reassignment-proposals", "EVENT_NOT_FOUND"],
  ] as const)("a coordinator's %s %s gets 404 %s", async (method, path, code) => {
    signedInAs(COORDINATOR, "EVENT_COORDINATOR");

    const res = await (method === "GET" ? request(app).get(path) : request(app).post(path).send({})).set(bearer);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe(code);
  });

  it.each([
    ["GET", "/api/v1/event-drafts/not-a-uuid"],
    ["PUT", "/api/v1/event-drafts/not-a-uuid"],
    ["POST", "/api/v1/event-drafts/not-a-uuid/submit"],
  ] as const)("an organiser's %s %s gets 404 DRAFT_NOT_FOUND", async (method, path) => {
    signedInAs(ORGANISER, "EVENT_ORGANISER");
    const draft = { name: "Annual Research Symposium" };

    const res =
      method === "GET"
        ? await request(app).get(path).set(bearer)
        : method === "PUT"
          ? await request(app).put(path).set(bearer).send(draft)
          : await request(app).post(path).set(bearer).send(draft);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("DRAFT_NOT_FOUND");
  });
});
