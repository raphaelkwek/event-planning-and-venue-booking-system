import { afterEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

/**
 * EN-07 (EN-07-T5): POST /api/v1/permissions/check answers for the verified
 * caller only, refuses what it can't answer, and never exposes the policy
 * decision point. Identity's tables are stood in for; the unit run asks the
 * policy double and the integration run the real Cerbos PDP, with the same
 * expectations.
 */

const callers: Record<string, { id: string; role: string | null }> = {
  "organiser-subject": { id: "b1000000-0000-4000-8000-000000000001", role: "EVENT_ORGANISER" },
  "no-role-subject": { id: "b1000000-0000-4000-8000-000000000002", role: null },
};

vi.mock("../../../src/shared/auth/verifyJwt.js", () => ({
  verifyJwt: (
    req: { auth?: { supabaseUserId?: string }; header(name: string): string | undefined },
    res: { status(code: number): { json(body: unknown): void } },
    next: () => void
  ) => {
    const subject = req.header("authorization")?.replace(/^Bearer /, "");
    if (!subject) return res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "A valid bearer token is required.", correlationId: null } });
    req.auth = { supabaseUserId: subject };
    next();
  },
}));
vi.mock("../../../src/modules/identity/repo/users.js", async () => {
  const actual = await vi.importActual<typeof import("../../../src/modules/identity/repo/users.js")>("../../../src/modules/identity/repo/users.js");
  return {
    ...actual,
    findUserBySupabaseId: vi.fn(async (_sql: unknown, subject: string) =>
      callers[subject] ? { id: callers[subject]!.id, email: "caller@connectsphere.test", isActive: true } : null
    ),
    findRoleForUser: vi.fn(async (_sql: unknown, id: string) => Object.values(callers).find((caller) => caller.id === id)?.role ?? null),
  };
});

const { app } = await import("../../../src/app.js");
const pdpModule = await import("../../../src/shared/authz/pdp.js");

const PATH = "/api/v1/permissions/check";
const as = (subject: string) => ({ Authorization: `Bearer ${subject}` });
const checks = (n: number) => Array.from({ length: n }, () => ({ kind: "event", action: "view" }));

afterEach(() => vi.restoreAllMocks());

describe("POST /api/v1/permissions/check (EN-07-T5)", () => {
  it("EN-07-T5 refuses a request without a token, with no decision in it", async () => {
    const response = await request(app).post(PATH).send({ checks: [{ kind: "event", action: "approve" }] });
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHENTICATED");
    expect(response.body.results).toBeUndefined();
  });

  it("EN-07-T5 answers for the signed-in caller, whatever principal the body names", async () => {
    const response = await request(app)
      .post(PATH)
      .set(as("organiser-subject"))
      .send({
        principal: { id: "someone-else", roles: ["EVENT_COORDINATOR"] },
        checks: [
          { kind: "event", action: "approve" },
          { kind: "event", action: "create" },
          { kind: "event", action: "update_details" },
          { kind: "user", action: "view" },
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body.results).toEqual([
      { kind: "event", action: "approve", allowed: false, reach: "NEVER" },
      { kind: "event", action: "create", allowed: true, reach: "ALWAYS" },
      { kind: "event", action: "update_details", allowed: true, reach: "CONDITIONAL" },
      { kind: "user", action: "view", allowed: true, reach: "ALWAYS" },
    ]);
  });

  it("EN-07-T5 refuses a caller with no role", async () => {
    const response = await request(app).post(PATH).set(as("no-role-subject")).send({ checks: checks(1) });
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("NO_ROLE_ASSIGNED");
  });

  it.each([
    ["no checks", { checks: [] }, "checks"],
    ["51 checks, one over the limit", { checks: checks(51) }, "checks"],
    ["a kind that is not a policy resource", { checks: [{ kind: "registration_desk", action: "view" }] }, "checks.0.kind"],
    ["an action that is not an action name", { checks: [{ kind: "event", action: "View Everything" }] }, "checks.0.action"],
    ["no body at all", undefined, "checks"],
  ])("EN-07-T5 refuses %s with 400 VALIDATION_FAILED naming the field", async (_name, body, field) => {
    const response = await request(app).post(PATH).set(as("organiser-subject")).send(body as object);
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_FAILED");
    expect(response.body.error.fields.map((entry: { field: string }) => entry.field)).toContain(field);
  });

  it("EN-07-T5 answers exactly 50 checks, the most it takes", async () => {
    const response = await request(app).post(PATH).set(as("organiser-subject")).send({ checks: checks(50) });
    expect(response.status).toBe(200);
    expect(response.body.results).toHaveLength(50);
  });

  it("EN-07-T3 refuses with 503 POLICY_UNAVAILABLE when the PDP can't be asked, and never names it", async () => {
    vi.spyOn(pdpModule.pdp, "reach").mockRejectedValue(new pdpModule.PolicyUnavailableError("connect ECONNREFUSED 127.0.0.1:3592"));
    const response = await request(app).post(PATH).set(as("organiser-subject")).send({ checks: checks(2) });
    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe("POLICY_UNAVAILABLE");
    expect(JSON.stringify(response.body)).not.toMatch(/3592|cerbos|ECONNREFUSED/i);
  });
});
