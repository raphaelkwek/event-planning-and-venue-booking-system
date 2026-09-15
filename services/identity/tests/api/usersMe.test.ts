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

const SUPABASE_ID = "eeeeeeee-0000-0000-0000-000000000002";
const USER_ID = "ffffffff-0000-0000-0000-000000000002";
const NO_ROLE_SUPABASE_ID = "eeeeeeee-0000-0000-0000-000000000003";
const NO_ROLE_USER_ID = "ffffffff-0000-0000-0000-000000000003";

beforeEach(async () => {
  await sql`delete from identity.user_roles where user_id in (${USER_ID}, ${NO_ROLE_USER_ID})`;
  await sql`delete from identity.users where id in (${USER_ID}, ${NO_ROLE_USER_ID})`;
  await sql`
    insert into identity.users (id, supabase_user_id, email, is_active) values
      (${USER_ID}, ${SUPABASE_ID}, 'me-test@connectsphere.test', true),
      (${NO_ROLE_USER_ID}, ${NO_ROLE_SUPABASE_ID}, 'me-no-role@connectsphere.test', true)
  `;
  await sql`insert into identity.user_roles (user_id, role) values (${USER_ID}, 'EVENT_COORDINATOR')`;
});

afterAll(async () => {
  await sql`delete from identity.user_roles where user_id in (${USER_ID}, ${NO_ROLE_USER_ID})`;
  await sql`delete from identity.users where id in (${USER_ID}, ${NO_ROLE_USER_ID})`;
  await sql.end();
});

describe("GET /api/v1/users/me", () => {
  it("resolves a token to the caller's internal user id and role", async () => {
    const res = await request(app).get("/api/v1/users/me").set("x-test-supabase-id", SUPABASE_ID);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: USER_ID,
      email: "me-test@connectsphere.test",
      role: "EVENT_COORDINATOR",
    });
  });

  it("refuses a token with no matching active identity", async () => {
    const res = await request(app)
      .get("/api/v1/users/me")
      .set("x-test-supabase-id", "00000000-0000-0000-0000-000000000000");

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("refuses a user who holds no role", async () => {
    const res = await request(app).get("/api/v1/users/me").set("x-test-supabase-id", NO_ROLE_SUPABASE_ID);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("NO_ROLE_ASSIGNED");
  });
});
