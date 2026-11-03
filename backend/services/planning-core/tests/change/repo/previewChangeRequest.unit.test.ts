import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import type { Sql } from "postgres";

// G2 — a role that cannot see change requests is refused before anything is read; no database
// needed. Every other case is in the API cards (tests/change/api/g2Cards.test.ts).
//
// EN-07: which roles may preview is the policies' (event preview_change_impact), asked by the route
// before its transaction opens, so this is checked through the route rather than the repo.

vi.mock("../../../src/shared/auth/verifyJwt.js", () => ({
  verifyJwt: (req: { auth?: { supabaseUserId?: string }; header(name: string): string | undefined }, _res: unknown, next: () => void) => {
    req.auth = { supabaseUserId: req.header("x-test-role") };
    next();
  },
}));
vi.mock("../../../src/modules/change/auth/identity.js", async () => {
  const actual = await vi.importActual<typeof import("../../../src/modules/change/auth/identity.js")>(
    "../../../src/modules/change/auth/identity.js"
  );
  return { ...actual, resolveCurrentUser: async (role: string) => ({ id: "6b3c1f6e-0000-4000-8000-0000000000aa", email: "u@connectsphere.test", role }) };
});

const { changeImpactRouter } = await import("../../../src/modules/change/api/changeImpact.js");

const untouchable = new Proxy(() => undefined, {
  apply: () => {
    throw new Error("the database was read");
  },
  get: () => {
    throw new Error("the database was read");
  },
}) as unknown as Sql;

const noLimit = (_req: unknown, _res: unknown, next: () => void) => next();

describe("previewChangeRequest (G2)", () => {
  it.each(["VENUE_STAFF", "TECH_SUPPORT_STAFF", "ATTENDEE", "EVENT_COORDINATOR_LEAD"] as const)(
    "answers NOT_FOUND to %s without reading anything",
    async (role) => {
      const app = express();
      app.use(changeImpactRouter(untouchable, noLimit));

      const response = await request(app)
        .get("/api/v1/change-requests/6b3c1f6e-0000-4000-8000-000000000001/impact")
        .set("x-test-role", role);

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("CHANGE_REQUEST_NOT_FOUND");
    }
  );
});
