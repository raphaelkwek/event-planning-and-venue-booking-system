import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import postgres from "postgres";

vi.mock("../../src/auth/verifyJwt.js", () => ({
  verifyJwt: (req: any, _res: any, next: any) => {
    req.auth = { supabaseUserId: req.header("x-test-supabase-id") };
    next();
  },
}));

const { app } = await import("../../src/index.js");

const sql = postgres(
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
);

const SUPABASE_ID = "eeeeeeee-0000-0000-0000-000000000001";
const USER_ID = "ffffffff-0000-0000-0000-000000000001";

beforeEach(async () => {
  await sql`delete from identity.user_roles where user_id = ${USER_ID}`;
  await sql`delete from identity.users where id = ${USER_ID}`;
  await sql`
    insert into identity.users (id, supabase_user_id, email, is_active)
    values (${USER_ID}, ${SUPABASE_ID}, 'scope-test@connectsphere.test', true)
  `;
  await sql`insert into identity.user_roles (user_id, role) values (${USER_ID}, 'EVENT_ORGANISER')`;
});

afterAll(async () => {
  await sql`delete from identity.user_roles where user_id = ${USER_ID}`;
  await sql`delete from identity.users where id = ${USER_ID}`;
  await sql.end();
});

describe("GET /api/v1/access-scope/:resource", () => {
  it("resolves an Organiser's events scope to their own events", async () => {
    const res = await request(app).get("/api/v1/access-scope/events").set("x-test-supabase-id", SUPABASE_ID);

    expect(res.status).toBe(200);
    expect(res.body.scope).toEqual({ scopeType: "OWNED_BY_USER", userId: USER_ID });
  });

  it("rejects a resource it does not know how to scope", async () => {
    const res = await request(app)
      .get("/api/v1/access-scope/not-a-real-resource")
      .set("x-test-supabase-id", SUPABASE_ID);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("UNKNOWN_RESOURCE");
  });

  it("refuses a token with no matching active identity", async () => {
    const res = await request(app)
      .get("/api/v1/access-scope/events")
      .set("x-test-supabase-id", "00000000-0000-0000-0000-000000000000");

    expect(res.status).toBe(401);
  });
});
