import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import postgres from "postgres";

vi.mock("../../../src/shared/auth/verifyJwt.js", () => ({
  verifyJwt: (
    req: { auth?: { supabaseUserId?: string }; header(name: string): string | undefined },
    _res: unknown,
    next: () => void
  ) => {
    req.auth = { supabaseUserId: req.header("x-test-supabase-id") };
    next();
  },
}));

const { app } = await import("../../../src/app.js");

const sql = postgres(process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres");

/**
 * R7 — the registration service finds the attendee an organiser or coordinator
 * adds by hand from the email they give. Staff only; only an active attendee
 * is found; nothing but the fields that name them.
 */

const ORGANISER = { id: "ffffffff-0000-0000-0000-0000000000a1", supabase: "eeeeeeee-0000-0000-0000-0000000000a1" };
const ATTENDEE = { id: "ffffffff-0000-0000-0000-0000000000a2", supabase: "eeeeeeee-0000-0000-0000-0000000000a2" };
const RETIRED = { id: "ffffffff-0000-0000-0000-0000000000a3", supabase: "eeeeeeee-0000-0000-0000-0000000000a3" };
const IDS = [ORGANISER.id, ATTENDEE.id, RETIRED.id];
const lookUp = (email: string, as = ORGANISER.supabase) =>
  request(app).get(`/api/v1/attendees?email=${encodeURIComponent(email)}`).set("x-test-supabase-id", as);

async function cleanUp() {
  await sql`delete from identity.user_roles where user_id in ${sql(IDS)}`;
  await sql`delete from identity.users where id in ${sql(IDS)}`;
}

beforeEach(async () => {
  await cleanUp();
  await sql`
    insert into identity.users (id, supabase_user_id, email, is_active, display_name) values
      (${ORGANISER.id}, ${ORGANISER.supabase}, 'r7-organiser@connectsphere.test', true, 'R7 Organiser'),
      (${ATTENDEE.id}, ${ATTENDEE.supabase}, 'r7-attendee@connectsphere.test', true, 'R7 Attendee'),
      (${RETIRED.id}, ${RETIRED.supabase}, 'r7-retired@connectsphere.test', false, 'R7 Retired')
  `;
  await sql`
    insert into identity.user_roles (user_id, role) values
      (${ORGANISER.id}, 'EVENT_ORGANISER'), (${ATTENDEE.id}, 'ATTENDEE'), (${RETIRED.id}, 'ATTENDEE')
  `;
});

afterAll(async () => {
  await cleanUp();
  await sql.end();
});

describe("GET /api/v1/attendees?email= (R7)", () => {
  it("finds the active attendee with that email, ignoring case, with only their id, name and email", async () => {
    const res = await lookUp("R7-Attendee@ConnectSphere.test");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: [{ id: ATTENDEE.id, displayName: "R7 Attendee", email: "r7-attendee@connectsphere.test" }] });
  });

  it("finds nobody for staff, a deactivated attendee or an unknown email (R7-T13)", async () => {
    for (const email of ["r7-organiser@connectsphere.test", "r7-retired@connectsphere.test", "nobody@connectsphere.test"]) {
      const res = await lookUp(email);
      expect([res.status, res.body], email).toEqual([200, { items: [] }]);
    }
  });

  it("refuses an attendee and a malformed email", async () => {
    const asAttendee = await lookUp("r7-attendee@connectsphere.test", ATTENDEE.supabase);
    const malformed = await lookUp("not-an-email");

    expect([asAttendee.status, asAttendee.body.error.code]).toEqual([403, "ROLE_NOT_AUTHORISED"]);
    expect([malformed.status, malformed.body.error.code, malformed.body.error.fields[0].field]).toEqual([400, "VALIDATION_FAILED", "email"]);
  });

  it("refuses a token with no active user", async () => {
    const res = await lookUp("r7-attendee@connectsphere.test", RETIRED.supabase);
    expect([res.status, res.body.error.code]).toEqual([401, "UNAUTHENTICATED"]);
  });
});
