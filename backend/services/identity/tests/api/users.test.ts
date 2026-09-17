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

/**
 * Other people are shown by name wherever the app refers to them — the
 * submitting organiser, the reviewing coordinator (B1, D1) — so internal staff
 * can look users up by id. Attendees have no screen that names staff.
 */

const CALLER = { id: "ffffffff-0000-0000-0000-000000000011", supabase: "eeeeeeee-0000-0000-0000-000000000011" };
const NAMED = { id: "ffffffff-0000-0000-0000-000000000012", supabase: "eeeeeeee-0000-0000-0000-000000000012" };
const UNNAMED = { id: "ffffffff-0000-0000-0000-000000000013", supabase: "eeeeeeee-0000-0000-0000-000000000013" };
const ATTENDEE = { id: "ffffffff-0000-0000-0000-000000000014", supabase: "eeeeeeee-0000-0000-0000-000000000014" };
const IDS = [CALLER.id, NAMED.id, UNNAMED.id, ATTENDEE.id];

async function cleanUp() {
  await sql`delete from identity.user_roles where user_id in ${sql(IDS)}`;
  await sql`delete from identity.users where id in ${sql(IDS)}`;
}

beforeEach(async () => {
  await cleanUp();
  await sql`
    insert into identity.users (id, supabase_user_id, email, is_active, display_name) values
      (${CALLER.id}, ${CALLER.supabase}, 'users-caller@connectsphere.test', true, 'Calling Coordinator'),
      (${NAMED.id}, ${NAMED.supabase}, 'users-named@connectsphere.test', true, 'Named Organiser'),
      (${UNNAMED.id}, ${UNNAMED.supabase}, 'users-unnamed@connectsphere.test', true, null),
      (${ATTENDEE.id}, ${ATTENDEE.supabase}, 'users-attendee@connectsphere.test', true, 'An Attendee')
  `;
  await sql`
    insert into identity.user_roles (user_id, role) values
      (${CALLER.id}, 'EVENT_COORDINATOR'),
      (${NAMED.id}, 'EVENT_ORGANISER'),
      (${UNNAMED.id}, 'EVENT_ORGANISER'),
      (${ATTENDEE.id}, 'ATTENDEE')
  `;
});

afterAll(async () => {
  await cleanUp();
  await sql.end();
});

describe("GET /api/v1/users", () => {
  it("resolves ids to each user's display name and email", async () => {
    const res = await request(app)
      .get(`/api/v1/users?ids=${NAMED.id},${UNNAMED.id}`)
      .set("x-test-supabase-id", CALLER.supabase);

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual(
      expect.arrayContaining([
        { id: NAMED.id, displayName: "Named Organiser", email: "users-named@connectsphere.test" },
        { id: UNNAMED.id, displayName: null, email: "users-unnamed@connectsphere.test" },
      ])
    );
    expect(res.body.items).toHaveLength(2);
  });

  it("returns only id, display name and email — nothing else about the user", async () => {
    const res = await request(app).get(`/api/v1/users?ids=${NAMED.id}`).set("x-test-supabase-id", CALLER.supabase);

    expect(Object.keys(res.body.items[0]).sort()).toEqual(["displayName", "email", "id"]);
  });

  it("leaves out ids that match no user", async () => {
    const res = await request(app)
      .get(`/api/v1/users?ids=${NAMED.id},00000000-0000-0000-0000-00000000dead`)
      .set("x-test-supabase-id", CALLER.supabase);

    expect(res.status).toBe(200);
    expect(res.body.items.map((item: { id: string }) => item.id)).toEqual([NAMED.id]);
  });

  it("returns an empty list when no ids are given", async () => {
    const res = await request(app).get("/api/v1/users").set("x-test-supabase-id", CALLER.supabase);

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
  });

  it("refuses an id that is not a uuid", async () => {
    const res = await request(app).get("/api/v1/users?ids=not-a-uuid").set("x-test-supabase-id", CALLER.supabase);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_FAILED");
  });

  it("refuses more than 100 ids at once", async () => {
    const many = Array.from({ length: 101 }, (_, i) => `00000000-0000-0000-0000-${String(i).padStart(12, "0")}`);

    const res = await request(app).get(`/api/v1/users?ids=${many.join(",")}`).set("x-test-supabase-id", CALLER.supabase);

    expect(res.status).toBe(400);
  });

  it("refuses an attendee (A2)", async () => {
    const res = await request(app).get(`/api/v1/users?ids=${NAMED.id}`).set("x-test-supabase-id", ATTENDEE.supabase);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("ROLE_NOT_AUTHORISED");
  });

  it("refuses a token with no matching active identity", async () => {
    const res = await request(app)
      .get(`/api/v1/users?ids=${NAMED.id}`)
      .set("x-test-supabase-id", "00000000-0000-0000-0000-000000000000");

    expect(res.status).toBe(401);
  });
});
