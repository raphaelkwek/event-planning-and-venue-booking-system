import { afterAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { insertLoginAudit } from "../../src/repo/loginAudit.js";

const sql = postgres(
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
);

afterAll(async () => {
  await sql.end();
});

describe("login audit repo", () => {
  it("records a failed attempt with no user id", async () => {
    await insertLoginAudit(sql, {
      userId: null,
      emailTried: "unknown@connectsphere.test",
      outcome: "INVALID_CREDENTIALS",
    });

    const rows = await sql`
      select outcome, user_id from identity.login_audit
      where email_tried = 'unknown@connectsphere.test'
      order by occurred_at desc
      limit 1
    `;
    expect(rows[0]).toMatchObject({ outcome: "INVALID_CREDENTIALS", user_id: null });
  });
});
