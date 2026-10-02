import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { testDb } from "../support/testDb.js";
import { lookUpCaller, resolveAccessScope } from "../../src/modules/identity/index.js";

/**
 * The identity module's public interface (ADR-0004): what the event module
 * calls in place of the HTTP hop it made before EN-01. Same rules as
 * GET /api/v1/users/me.
 */

const sql = testDb();

const ACTIVE = { supabaseId: "e1e1e1e1-0000-0000-0000-000000000001", userId: "f1f1f1f1-0000-0000-0000-000000000001" };
const INACTIVE = { supabaseId: "e1e1e1e1-0000-0000-0000-000000000002", userId: "f1f1f1f1-0000-0000-0000-000000000002" };
const ROLELESS = { supabaseId: "e1e1e1e1-0000-0000-0000-000000000003", userId: "f1f1f1f1-0000-0000-0000-000000000003" };
const USER_IDS = [ACTIVE.userId, INACTIVE.userId, ROLELESS.userId];

async function removeFixtures() {
  await sql`delete from identity.user_roles where user_id in ${sql(USER_IDS)}`;
  await sql`delete from identity.users where id in ${sql(USER_IDS)}`;
}

beforeEach(async () => {
  await removeFixtures();
  await sql`
    insert into identity.users (id, supabase_user_id, email, is_active) values
      (${ACTIVE.userId}, ${ACTIVE.supabaseId}, 'core-active@connectsphere.test', true),
      (${INACTIVE.userId}, ${INACTIVE.supabaseId}, 'core-inactive@connectsphere.test', false),
      (${ROLELESS.userId}, ${ROLELESS.supabaseId}, 'core-roleless@connectsphere.test', true)
  `;
  await sql`
    insert into identity.user_roles (user_id, role) values
      (${ACTIVE.userId}, 'EVENT_COORDINATOR'),
      (${INACTIVE.userId}, 'EVENT_ORGANISER')
  `;
});

afterAll(async () => {
  await removeFixtures();
  await sql.end();
});

describe("lookUpCaller", () => {
  it("resolves an active user with a role to their id, email and role", async () => {
    await expect(lookUpCaller(sql, ACTIVE.supabaseId)).resolves.toEqual({
      outcome: "FOUND",
      user: { id: ACTIVE.userId, email: "core-active@connectsphere.test", role: "EVENT_COORDINATOR" },
    });
  });

  it("finds no active session for an unknown token subject", async () => {
    await expect(lookUpCaller(sql, "e1e1e1e1-0000-0000-0000-0000000000ff")).resolves.toEqual({
      outcome: "NO_ACTIVE_USER",
    });
  });

  it("finds no active session for a deactivated user, even one with a role", async () => {
    await expect(lookUpCaller(sql, INACTIVE.supabaseId)).resolves.toEqual({ outcome: "NO_ACTIVE_USER" });
  });

  it("refuses an active user who has no role assigned", async () => {
    await expect(lookUpCaller(sql, ROLELESS.supabaseId)).resolves.toEqual({ outcome: "NO_ROLE" });
  });
});

describe("resolveAccessScope (re-exported)", () => {
  it("is the same A3 rule the access-scope endpoint applies", () => {
    expect(resolveAccessScope("EVENT_ORGANISER", ACTIVE.userId, "events")).toEqual({
      scopeType: "OWNED_BY_USER",
      userId: ACTIVE.userId,
    });
  });
});
