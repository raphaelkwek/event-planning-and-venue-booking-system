import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { InMemoryProvider, OpenFeature } from "@openfeature/server-sdk";
import { FLAG_DOMAIN } from "../../../src/shared/flags/index.js";
import { testDb } from "../../support/testDb.js";
import { actorsWithPrefix } from "../../support/lineFixtures.js";
import { deleteSeededEvents, seedEvent } from "../../support/seedEvent.js";
import { EVENT_END } from "../../support/eventDates.js";

// The EN-15 cards (tests/EN-15, T3 to T6; T6's 401 and rate limit are in featureFlags.unit.test.ts): S2's decision route and the flags route on the real
// Express app and migrated Postgres, with JWT verification and the identity lookup replaced. The
// flag is switched through OpenFeature's in-memory provider, the same SDK the app evaluates with.
vi.mock("../../../src/shared/auth/verifyJwt.js", () => ({
  verifyJwt: (req: { auth?: { supabaseUserId?: string } }, _res: unknown, next: () => void) => {
    req.auth = { supabaseUserId: "en15-card-subject" };
    next();
  },
}));
vi.mock("../../../src/modules/change/auth/identity.js", async () => {
  const actual = await vi.importActual<typeof import("../../../src/modules/change/auth/identity.js")>(
    "../../../src/modules/change/auth/identity.js",
  );
  return { ...actual, resolveCurrentUser: vi.fn() };
});
vi.mock("../../../src/modules/event/auth/identity.js", async () => {
  const actual = await vi.importActual<typeof import("../../../src/modules/event/auth/identity.js")>(
    "../../../src/modules/event/auth/identity.js",
  );
  return { ...actual, resolveCurrentUser: vi.fn() };
});

const { resolveCurrentUser: resolveChangeUser } = await import("../../../src/modules/change/auth/identity.js");
const { resolveCurrentUser: resolveEventUser } = await import("../../../src/modules/event/auth/identity.js");
const { app } = await import("../../../src/app.js");

const sql = testDb();
const A = actorsWithPrefix("0c150000");
const bearer = { Authorization: "Bearer en15-card-token" };

type Role = "EVENT_COORDINATOR" | "EVENT_ORGANISER";
function signedInAs(userId: string, role: Role) {
  const user = { id: userId, email: "en15@connectsphere.test", role };
  vi.mocked(resolveChangeUser).mockResolvedValue(user);
  vi.mocked(resolveEventUser).mockResolvedValue(user);
}
const asOrg = () => signedInAs(A.org, "EVENT_ORGANISER");
const asC1 = () => signedInAs(A.c1, "EVENT_COORDINATOR");

async function setApprovalFlag(on: boolean) {
  await OpenFeature.setProviderAndWait(
    FLAG_DOMAIN,
    new InMemoryProvider({
      "change-approval": { disabled: false, variants: { on: true, off: false }, defaultVariant: on ? "on" : "off" },
    }),
  );
}

async function clean() {
  const events = sql`select id from event.events where owner_id = ${A.org}`;
  const requests = sql`select id from change.change_requests where event_id in (${events})`;
  await sql`delete from change.outbox where message_key in (select id::text from (${events}) e)`;
  await sql`delete from change.change_request_fields where request_id in (${requests})`;
  await sql`delete from change.change_requests where event_id in (${events})`;
  await deleteSeededEvents(sql, [A.org]);
}

const decide = (requestId: string, body: unknown) =>
  request(app).post(`/api/v1/change-requests/${requestId}/decision`).set(bearer).send(body as object);

/** An Approved event assigned to C1 with ORG's pending request to raise attendance from 150 to 180. */
async function fixture() {
  const eventId = await seedEvent(sql, { ownerId: A.org, status: "APPROVED", endsAt: new Date(EVENT_END), name: "EN-15 fixture event" });
  await sql`insert into event.assignments (event_id, coordinator_id, assignment_rule) values (${eventId}, ${A.c1}, 'TEST_FIXTURE')`;
  asOrg();
  const created = await request(app)
    .post(`/api/v1/events/${eventId}/change-requests`)
    .set(bearer)
    .send({ reason: "More people are coming", changes: { expectedAttendance: 180 } });
  expect(created.status).toBe(201);
  asC1();
  return { eventId, requestId: created.body.id as string };
}

async function state(eventId: string, requestId: string) {
  const [event] = await sql<{ version: number; attendance: number }[]>`
    select version, expected_attendance as attendance from event.events where id = ${eventId}
  `;
  const [stored] = await sql<{ status: string; rejection_reason: string | null }[]>`
    select status, rejection_reason from change.change_requests where id = ${requestId}
  `;
  return { ...event!, ...stored! };
}

let f: { eventId: string; requestId: string };

beforeAll(clean);
beforeEach(async () => {
  await clean();
  await setApprovalFlag(true);
  f = await fixture();
});
afterAll(async () => {
  await clean();
  await OpenFeature.clearProviders();
  await sql.end();
});

describe("EN-15 cards: the change-approval flag", () => {
  it("EN-15-T3 refuses an approval on the server while the flag is off, and changes nothing", async () => {
    const before = await state(f.eventId, f.requestId);
    expect(before).toMatchObject({ attendance: 150, status: "PENDING" });
    await setApprovalFlag(false);

    const response = await decide(f.requestId, { decision: "APPROVE" });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FEATURE_DISABLED");
    expect(response.body.error.message).toContain("change-approval");
    expect(response.body.error.details).toEqual({ flag: "change-approval" });
    expect(await state(f.eventId, f.requestId)).toEqual(before);
  });

  it("EN-15-T4 approves as before while the flag is on", async () => {
    const before = await state(f.eventId, f.requestId);

    const response = await decide(f.requestId, { decision: "APPROVE" });

    expect(response.status).toBe(200);
    expect(response.body.changeRequest).toMatchObject({ id: f.requestId, status: "APPROVED", decidedBy: A.c1 });
    expect(await state(f.eventId, f.requestId)).toMatchObject({ attendance: 180, status: "APPROVED", version: before.version + 1 });
  });

  it("EN-15-T5 still rejects, with its reason, while the flag is off", async () => {
    const before = await state(f.eventId, f.requestId);
    await setApprovalFlag(false);

    const response = await decide(f.requestId, { decision: "REJECT", reason: "No larger hall" });

    expect(response.status).toBe(200);
    expect(response.body.changeRequest).toMatchObject({ status: "REJECTED", rejectionReason: "No larger hall" });
    expect(await state(f.eventId, f.requestId)).toEqual({ ...before, status: "REJECTED", rejection_reason: "No larger hall" });
  });

  it("EN-15-T5 reports a malformed body as a validation failure, not as a disabled feature", async () => {
    await setApprovalFlag(false);
    const response = await decide(f.requestId, { decision: "MAYBE" });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_FAILED");
  });

  it("EN-15-T6 serves the evaluated flags to a signed-in user, and only to them", async () => {
    const on = await request(app).get("/api/v1/feature-flags").set(bearer);
    expect(on.status).toBe(200);
    expect(on.body).toEqual({ flags: { "change-approval": true } });

    await setApprovalFlag(false);
    const off = await request(app).get("/api/v1/feature-flags").set(bearer);
    expect(off.body).toEqual({ flags: { "change-approval": false } });
  });
});
