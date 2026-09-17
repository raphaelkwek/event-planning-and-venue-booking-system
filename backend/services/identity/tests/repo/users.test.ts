import { afterAll, beforeEach, describe, expect, it } from "vitest";
import postgres from "postgres";
import { findUserBySupabaseId, findRoleForUser, recordSuccessfulLogin } from "../../src/repo/users.js";

const sql = postgres(
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
);

const TEST_SUPABASE_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const TEST_USER_ID = "bbbbbbbb-0000-0000-0000-000000000001";

beforeEach(async () => {
  await sql`delete from identity.user_roles where user_id = ${TEST_USER_ID}`;
  await sql`delete from identity.users where id = ${TEST_USER_ID}`;
  await sql`
    insert into identity.users (id, supabase_user_id, email, is_active)
    values (${TEST_USER_ID}, ${TEST_SUPABASE_ID}, 'repo-test@connectsphere.test', true)
  `;
  await sql`
    insert into identity.user_roles (user_id, role) values (${TEST_USER_ID}, 'EVENT_ORGANISER')
  `;
});

afterAll(async () => {
  await sql`delete from identity.user_roles where user_id = ${TEST_USER_ID}`;
  await sql`delete from identity.users where id = ${TEST_USER_ID}`;
  await sql.end();
});

describe("users repo", () => {
  it("finds a user by their Supabase user id", async () => {
    const user = await findUserBySupabaseId(sql, TEST_SUPABASE_ID);
    expect(user).toMatchObject({ id: TEST_USER_ID, isActive: true });
  });

  it("returns null for an unknown Supabase user id", async () => {
    const user = await findUserBySupabaseId(sql, "00000000-0000-0000-0000-000000000000");
    expect(user).toBeNull();
  });

  it("finds the role for a user", async () => {
    const role = await findRoleForUser(sql, TEST_USER_ID);
    expect(role).toBe("EVENT_ORGANISER");
  });

  it("records the last-login timestamp on success", async () => {
    const before = await sql`select last_login_at from identity.users where id = ${TEST_USER_ID}`;
    expect(before[0].last_login_at).toBeNull();

    const loginTime = new Date();
    await recordSuccessfulLogin(sql, TEST_USER_ID, loginTime);

    const after = await sql`select last_login_at from identity.users where id = ${TEST_USER_ID}`;
    expect(new Date(after[0].last_login_at).getTime()).toBe(loginTime.getTime());
  });
});
