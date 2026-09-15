import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import postgres from "postgres";

vi.mock("../../src/auth/supabaseAuthClient.js", () => ({
  signInWithPassword: vi.fn(),
  revokeSession: vi.fn(async () => {}),
}));

const { signInWithPassword, revokeSession } = await import("../../src/auth/supabaseAuthClient.js");
const { app } = await import("../../src/index.js");

const sql = postgres(
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
);

const ACTIVE_SUPABASE_ID = "cccccccc-0000-0000-0000-000000000001";
const ACTIVE_USER_ID = "dddddddd-0000-0000-0000-000000000001";
const DEACTIVATED_SUPABASE_ID = "cccccccc-0000-0000-0000-000000000002";
const DEACTIVATED_USER_ID = "dddddddd-0000-0000-0000-000000000002";

beforeEach(async () => {
  vi.mocked(signInWithPassword).mockReset();
  vi.mocked(revokeSession).mockClear();

  await sql`delete from identity.login_audit where email_tried like '%auth-test%'`;
  await sql`delete from identity.user_roles where user_id in (${ACTIVE_USER_ID}, ${DEACTIVATED_USER_ID})`;
  await sql`delete from identity.users where id in (${ACTIVE_USER_ID}, ${DEACTIVATED_USER_ID})`;

  await sql`
    insert into identity.users (id, supabase_user_id, email, is_active) values
      (${ACTIVE_USER_ID}, ${ACTIVE_SUPABASE_ID}, 'active-auth-test@connectsphere.test', true),
      (${DEACTIVATED_USER_ID}, ${DEACTIVATED_SUPABASE_ID}, 'deactivated-auth-test@connectsphere.test', false)
  `;
  await sql`
    insert into identity.user_roles (user_id, role) values (${ACTIVE_USER_ID}, 'EVENT_ORGANISER')
  `;
});

afterAll(async () => {
  await sql`delete from identity.login_audit where email_tried like '%auth-test%'`;
  await sql`delete from identity.user_roles where user_id in (${ACTIVE_USER_ID}, ${DEACTIVATED_USER_ID})`;
  await sql`delete from identity.users where id in (${ACTIVE_USER_ID}, ${DEACTIVATED_USER_ID})`;
  await sql.end();
});

describe("POST /api/v1/auth/login", () => {
  it("returns the user and role on success, and records last-login", async () => {
    vi.mocked(signInWithPassword).mockResolvedValue({ ok: true, supabaseUserId: ACTIVE_SUPABASE_ID });

    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "active-auth-test@connectsphere.test", password: "whatever" });

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ id: ACTIVE_USER_ID, role: "EVENT_ORGANISER" });
    expect(res.body.lastLoginAt).toBeTruthy();

    const audit = await sql`
      select outcome from identity.login_audit
      where user_id = ${ACTIVE_USER_ID} order by occurred_at desc limit 1
    `;
    expect(audit[0].outcome).toBe("SUCCESS");
  });

  it("rejects bad credentials with a field-neutral message and no session", async () => {
    vi.mocked(signInWithPassword).mockResolvedValue({ ok: false });

    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "active-auth-test@connectsphere.test", password: "wrong" });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
    expect(res.body.error.message).toBe("email or password is incorrect");
  });

  it("gives the same message for a wrong email as for a wrong password", async () => {
    vi.mocked(signInWithPassword).mockResolvedValue({ ok: false });

    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "no-such-user@connectsphere.test", password: "whatever" });

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe("email or password is incorrect");
  });

  it("distinguishes a deactivated account from bad credentials", async () => {
    vi.mocked(signInWithPassword).mockResolvedValue({ ok: true, supabaseUserId: DEACTIVATED_SUPABASE_ID });

    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "deactivated-auth-test@connectsphere.test", password: "whatever" });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("ACCOUNT_DEACTIVATED");

    const audit = await sql`
      select outcome from identity.login_audit
      where user_id = ${DEACTIVATED_USER_ID} order by occurred_at desc limit 1
    `;
    expect(audit[0].outcome).toBe("DEACTIVATED_ACCOUNT");
  });

  it("records no last-login timestamp on a failed attempt", async () => {
    vi.mocked(signInWithPassword).mockResolvedValue({ ok: false });

    await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "active-auth-test@connectsphere.test", password: "wrong" });

    const rows = await sql`select last_login_at from identity.users where id = ${ACTIVE_USER_ID}`;
    expect(rows[0].last_login_at).toBeNull();
  });
});

describe("POST /api/v1/auth/logout", () => {
  it("revokes the session and returns 204", async () => {
    const res = await request(app).post("/api/v1/auth/logout").set("Authorization", "Bearer some-token");
    expect(res.status).toBe(204);
    expect(revokeSession).toHaveBeenCalledWith("some-token");
  });

  it("refuses logout with no bearer token", async () => {
    const res = await request(app).post("/api/v1/auth/logout");
    expect(res.status).toBe(401);
  });
});
