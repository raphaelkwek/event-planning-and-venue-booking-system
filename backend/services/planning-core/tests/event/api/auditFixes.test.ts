import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { readFileSync } from "node:fs";
import postgres, { type Sql } from "postgres";
import { testDb } from "../../support/testDb.js";
import { isThrowawayDatabase } from "../../support/race.js";
import { deleteSeededEvents, seedEvent } from "../../support/seedEvent.js";
import { assignForTest } from "../../support/assignment.js";
import { EVENT_END } from "../../support/eventDates.js";
import { closeActiveAssignment, findActiveAssignment, insertAssignment, lockEventForAssignment } from "../../../src/modules/event/repo/assignments.js";
import { findEventForChange } from "../../../src/modules/event/index.js";
import { confirmArrangements } from "../../../src/modules/change/repo/confirmArrangements.js";
import { decideChangeRequest } from "../../../src/modules/change/repo/decisions.js";
import { insertChangeRequest } from "../../../src/modules/change/repo/changeRequests.js";

/**
 * The event audit of 3 Nov 2026, one describe per finding (M8, M7, and the active-coordinator check
 * of E3/E4). L4 is in tests/venue/api/m1EventStatus.test.ts and L11 in frontend/tests/detailLoading.test.tsx.
 * Each test names the story criterion it holds the code to.
 */

vi.mock("../../../src/shared/auth/verifyJwt.js", () => ({
  verifyJwt: (req: { auth?: { supabaseUserId?: string } }, _res: unknown, next: () => void) => {
    req.auth = { supabaseUserId: "test-subject" };
    next();
  },
}));

vi.mock("../../../src/modules/event/auth/identity.js", async () => {
  const actual = await vi.importActual<typeof import("../../../src/modules/event/auth/identity.js")>(
    "../../../src/modules/event/auth/identity.js",
  );
  return { ...actual, resolveCurrentUser: vi.fn(), resolveEventsScope: vi.fn() };
});

const { resolveCurrentUser, resolveEventsScope } = await import("../../../src/modules/event/auth/identity.js");
const { app } = await import("../../../src/app.js");

const sql = testDb();
const OWNER = "ae200000-0000-0000-0000-000000000001";
const LEAD = "ae200000-0000-0000-0000-000000000002";
const COORDINATOR_A = "ae200000-0000-0000-0000-000000000003";
const COORDINATOR_B = "ae200000-0000-0000-0000-000000000004";
const bearer = { Authorization: "Bearer test-token" };
const USERS: [string, string, string][] = [
  [OWNER, "EVENT_ORGANISER", "audit-owner"],
  [LEAD, "EVENT_COORDINATOR_LEAD", "audit-lead"],
  [COORDINATOR_A, "EVENT_COORDINATOR", "audit-coordinator-a"],
  [COORDINATOR_B, "EVENT_COORDINATOR", "audit-coordinator-b"],
];

function signedInAs(userId: string, role: string) {
  vi.mocked(resolveCurrentUser).mockResolvedValue({ id: userId, email: "user@connectsphere.test", role: role as never });
  vi.mocked(resolveEventsScope).mockResolvedValue(
    role === "EVENT_ORGANISER" ? { scopeType: "OWNED_BY_USER", userId } : { scopeType: "ALL" },
  );
}

async function cleanUp() {
  const owned = sql`select id from event.events where owner_id = ${OWNER}`;
  await sql`delete from change.outbox where message_key in (select id::text from (${owned}) e)`;
  await sql`delete from change.change_request_fields where request_id in (select id from change.change_requests where event_id in (${owned}))`;
  await sql`delete from change.change_requests where event_id in (${owned})`;
  await deleteSeededEvents(sql, [OWNER]);
  const ids = USERS.map(([id]) => id);
  await sql`delete from identity.user_roles where user_id in ${sql(ids)}`;
  await sql`delete from identity.users where id in ${sql(ids)}`;
}

beforeEach(async () => {
  vi.mocked(resolveCurrentUser).mockReset();
  vi.mocked(resolveEventsScope).mockReset();
  await cleanUp();
  for (const [id, role, name] of USERS) {
    await sql`
      insert into identity.users (id, supabase_user_id, email, is_active, display_name)
      values (${id}, gen_random_uuid(), ${`${name}@connectsphere.test`}, true, ${name})
    `;
    await sql`insert into identity.user_roles (user_id, role) values (${id}, ${role})`;
  }
});

afterAll(async () => {
  await cleanUp();
  await sql.end();
});

const newEvent = async (status: "PLANNING" | "SUBMITTED" = "PLANNING") => ({
  id: await seedEvent(sql, { ownerId: OWNER, status, endsAt: new Date(EVENT_END) }),
  assignedCoordinatorId: null as string | null,
});

/** Waits until some backend is blocked on a lock whose statement mentions `fragment`. */
async function waitUntilBlocked(fragment: string): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const rows = await sql`
      select 1 from pg_stat_activity where wait_event_type = 'Lock' and query ilike ${`%${fragment}%`} and pid <> pg_backend_pid()
    `;
    if (rows.length > 0) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`nothing became blocked on "${fragment}"`);
}

/** One more connection with a transaction of its own, to act as a second user of the database. */
const connection = (): Sql => postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });

describe("M8: E2 can no longer reassign an event without the Lead (E4, W9-FX-5)", () => {
  const migration = readFileSync(
    new URL("../../../migrations/event/0020_close_pending_reassignment_proposals.sql", import.meta.url),
    "utf8",
  );

  async function proposal(eventId: string, status: string) {
    const [row] = await sql<{ id: string }[]>`
      insert into event.reassignment_proposals (event_id, outgoing_coordinator_id, nominee_coordinator_id, status, resolved_at, created_by, updated_by)
      values (${eventId}, ${COORDINATOR_A}, ${COORDINATOR_B}, ${status}, ${status === "PENDING" ? null : sql`now()`}, ${COORDINATOR_A}, ${COORDINATOR_A})
      returning id
    `;
    return row!.id;
  }

  it("migration event/0020 closes each pending proposal, unaccepted, and leaves resolved ones as they were (M8)", async () => {
    const first = await newEvent();
    const second = await newEvent();
    const pending = await proposal(first.id, "PENDING");
    const declined = await proposal(second.id, "DECLINED");

    await sql.unsafe(migration);

    const rows = await sql<{ id: string; status: string; resolved_at: Date | null }[]>`
      select id, status, resolved_at from event.reassignment_proposals where id in ${sql([pending, declined])}
    `;
    const byId = new Map(rows.map((row) => [row.id, row]));
    expect(byId.get(pending)).toMatchObject({ status: "CLOSED" });
    expect(byId.get(pending)!.resolved_at).toBeInstanceOf(Date);
    expect(byId.get(declined)).toMatchObject({ status: "DECLINED" });
    expect(rows).toHaveLength(2);
  });

  it("migration event/0020 is idempotent: a second run changes nothing", async () => {
    const event = await newEvent();
    const id = await proposal(event.id, "PENDING");
    await sql.unsafe(migration);
    const [first] = await sql<{ resolved_at: Date }[]>`select resolved_at from event.reassignment_proposals where id = ${id}`;

    await sql.unsafe(migration);

    const [second] = await sql<{ resolved_at: Date; status: string }[]>`select resolved_at, status from event.reassignment_proposals where id = ${id}`;
    expect(second).toEqual({ status: "CLOSED", resolved_at: first!.resolved_at });
  });

  it("a pending proposal's accept is refused with 410 and leaves the assignment with its coordinator (M8)", async () => {
    const event = await newEvent();
    await assignForTest(sql, event, COORDINATOR_A);
    await proposal(event.id, "PENDING");
    signedInAs(COORDINATOR_B, "EVENT_COORDINATOR");

    const res = await request(app).post(`/api/v1/events/${event.id}/reassignment-proposals/accept`).set(bearer).send();

    expect(res.status).toBe(410);
    expect((await findActiveAssignment(sql, event.id))?.coordinatorId).toBe(COORDINATOR_A);
  });

  it("closeActiveAssignment closes an assignment once: a second call reports false and changes nothing", async () => {
    const event = await newEvent();
    await assignForTest(sql, event, COORDINATOR_A);
    const active = (await findActiveAssignment(sql, event.id))!;

    const outcomes = await sql.begin(async (tx) => [
      await closeActiveAssignment(tx, active.id, LEAD),
      await closeActiveAssignment(tx, active.id, LEAD),
    ]);

    expect(outcomes).toEqual([true, false]);
    expect(await findActiveAssignment(sql, event.id)).toBeNull();
  });
});

describe.runIf(isThrowawayDatabase())("M7: the assignment is read again once the event row is locked", () => {
  /**
   * A Lead's reassignment holds the event row and has moved the event from A to B but not yet
   * committed; the reader begins, queues behind the lock, and is let go when the Lead commits. It
   * must see B as assigned, not the A it joined before it waited.
   */
  async function whileTheLeadReassigns<T>(eventId: string, reader: (tx: Parameters<Parameters<Sql["begin"]>[1]>[0]) => Promise<T>): Promise<T> {
    const leadConnection = connection();
    const readerConnection = connection();
    let commit!: () => void;
    const mayCommit = new Promise<void>((resolve) => (commit = resolve));
    let held!: () => void;
    const lockHeld = new Promise<void>((resolve) => (held = resolve));
    try {
      const lead = leadConnection.begin(async (tx) => {
        await lockEventForAssignment(tx, eventId);
        const current = (await findActiveAssignment(tx, eventId))!;
        await closeActiveAssignment(tx, current.id, LEAD);
        await insertAssignment(tx, eventId, COORDINATOR_B, "LEAD", LEAD);
        held();
        await mayCommit;
      });
      await lockHeld;
      const reading = readerConnection.begin((tx) => reader(tx));
      await waitUntilBlocked("event.events");
      commit();
      await lead;
      return await reading;
    } finally {
      commit();
      await Promise.all([leadConnection.end(), readerConnection.end()]);
    }
  }

  it("findEventForChange with an update lock names the new coordinator, not the outgoing one (S2, F5)", async () => {
    const event = await newEvent();
    await assignForTest(sql, event, COORDINATOR_A);

    const seen = await whileTheLeadReassigns(event.id, (tx) =>
      findEventForChange(tx, event.id, { scopeType: "ALL" }, COORDINATOR_A, { lock: "update" }),
    );

    expect(seen?.assignedCoordinatorId).toBe(COORDINATOR_B);
  });

  it("findEventForChange with a share lock does too (S2 rejection, S1)", async () => {
    const event = await newEvent();
    await assignForTest(sql, event, COORDINATOR_A);

    const seen = await whileTheLeadReassigns(event.id, (tx) =>
      findEventForChange(tx, event.id, { scopeType: "ALL" }, COORDINATOR_A, { lock: "share" }),
    );

    expect(seen?.assignedCoordinatorId).toBe(COORDINATOR_B);
  });

  it("F5: the outgoing coordinator's confirmation, queued behind the reassignment, is refused as not assigned", async () => {
    const event = await newEvent();
    await assignForTest(sql, event, COORDINATOR_A);

    const outcome = await whileTheLeadReassigns(event.id, (tx) =>
      confirmArrangements(tx, event.id, { userId: COORDINATOR_A, role: "EVENT_COORDINATOR" }),
    );

    expect(outcome).toMatchObject({ ok: false, code: "NOT_ASSIGNED" });
    const [stored] = await sql<{ status: string }[]>`select status from event.events where id = ${event.id}`;
    expect(stored!.status).toBe("PLANNING");
  });

  it("S2: the outgoing coordinator's approval, queued behind the reassignment, is refused as not assigned", async () => {
    const event = await newEvent();
    await assignForTest(sql, event, COORDINATOR_A);
    const [row] = await sql<{ reference: string }[]>`select reference from event.events where id = ${event.id}`;
    const pending = await sql.begin((tx) =>
      insertChangeRequest(tx, {
        event: { id: event.id, reference: row!.reference },
        reason: "Audit M7",
        changes: { expectedAttendance: 160 },
        current: { expectedAttendance: 150 },
        actorId: OWNER,
      }),
    );

    const outcome = await whileTheLeadReassigns(event.id, (tx) =>
      decideChangeRequest(tx, pending.id, { decision: "APPROVE" }, { userId: COORDINATOR_A, role: "EVENT_COORDINATOR" }),
    );

    expect(outcome).toMatchObject({ ok: false, code: "NOT_ASSIGNED" });
    const [stored] = await sql<{ status: string }[]>`select status from change.change_requests where id = ${pending.id}`;
    expect(stored!.status).toBe("PENDING");
  });

  it("without a lock the assignment is read as before, and the new coordinator is the one a later reader sees", async () => {
    const event = await newEvent();
    await assignForTest(sql, event, COORDINATOR_A);

    const before = await findEventForChange(sql, event.id, { scopeType: "ALL" }, COORDINATOR_A);
    expect(before?.assignedCoordinatorId).toBe(COORDINATOR_A);
    const missing = await findEventForChange(sql, "00000000-0000-0000-0000-0000000000ff", { scopeType: "ALL" }, COORDINATOR_A, { lock: "update" });
    expect(missing).toBeNull();
    const unassigned = await newEvent();
    const none = await sql.begin((tx) => findEventForChange(tx, unassigned.id, { scopeType: "ALL" }, COORDINATOR_A, { lock: "update" }));
    expect(none?.assignedCoordinatorId).toBeNull();
  });
});

describe.runIf(isThrowawayDatabase())("E3, E4: the coordinator is checked as active inside the assignment's transaction", () => {
  const assign = (eventId: string, coordinatorId: string) =>
    request(app).post(`/api/v1/events/${eventId}/assignment`).set(bearer).send({ coordinatorId });
  const reassign = (eventId: string, coordinatorId: string) =>
    request(app).post(`/api/v1/events/${eventId}/reassignment`).set(bearer).send({ coordinatorId });
  const activeAssignments = (eventId: string) =>
    sql<{ coordinator_id: string }[]>`select coordinator_id from event.assignments where event_id = ${eventId} and is_active`;

  /** An administrator deactivates the coordinator and has not yet committed; `act` queues behind that. */
  async function whileDeactivating(coordinatorId: string, act: () => Promise<request.Response>): Promise<request.Response> {
    const admin = connection();
    let commit!: () => void;
    const mayCommit = new Promise<void>((resolve) => (commit = resolve));
    let held!: () => void;
    const deactivationHeld = new Promise<void>((resolve) => (held = resolve));
    try {
      const deactivating = admin.begin(async (tx) => {
        await tx`update identity.users set is_active = false where id = ${coordinatorId}`;
        held();
        await mayCommit;
      });
      await deactivationHeld;
      const acting = act().then((res) => res);
      await waitUntilBlocked("identity.users");
      commit();
      await deactivating;
      return await acting;
    } finally {
      commit();
      await admin.end();
    }
  }

  it("E3: a coordinator deactivated while the Lead assigns is refused, and nothing is stored", async () => {
    const event = await newEvent("SUBMITTED");
    signedInAs(LEAD, "EVENT_COORDINATOR_LEAD");

    const res = await whileDeactivating(COORDINATOR_A, () => assign(event.id, COORDINATOR_A));

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("NOT_AN_ACTIVE_COORDINATOR");
    expect(await activeAssignments(event.id)).toEqual([]);
    expect(await sql`select 1 from event.outbox where message_key = ${event.id} and envelope->>'type' = 'event.coordinator-assigned'`).toEqual([]);
  });

  it("E4: a coordinator deactivated while the Lead reassigns is refused, and the event keeps its coordinator", async () => {
    const event = await newEvent();
    await assignForTest(sql, event, COORDINATOR_A);
    signedInAs(LEAD, "EVENT_COORDINATOR_LEAD");

    const res = await whileDeactivating(COORDINATOR_B, () => reassign(event.id, COORDINATOR_B));

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("NOT_AN_ACTIVE_COORDINATOR");
    expect((await activeAssignments(event.id)).map((row) => row.coordinator_id)).toEqual([COORDINATOR_A]);
  });

  it("E3, E4: an event that is not there is a 404 even when the coordinator chosen is not active", async () => {
    signedInAs(LEAD, "EVENT_COORDINATOR_LEAD");
    await sql`update identity.users set is_active = false where id = ${COORDINATOR_B}`;
    const missing = "00000000-0000-0000-0000-0000000000fe";

    expect((await assign(missing, COORDINATOR_B)).status).toBe(404);
    expect((await reassign(missing, COORDINATOR_B)).status).toBe(404);
  });

  it("E3, E4: a user who is not an Event Coordinator is refused the same way", async () => {
    const event = await newEvent("SUBMITTED");
    signedInAs(LEAD, "EVENT_COORDINATOR_LEAD");

    const res = await assign(event.id, OWNER);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("NOT_AN_ACTIVE_COORDINATOR");
  });
});

describe("L7: GET /api/v1/events is paged (implementation.md section 5)", () => {
  const list = (query = "") => request(app).get(`/api/v1/events${query}`).set(bearer);
  const ids = (res: request.Response) => res.body.items.map((item: { id: string }) => item.id);

  /** `count` submitted events, one minute apart, newest last created; returns their ids newest first. */
  async function submittedEvents(count: number): Promise<string[]> {
    const created: string[] = [];
    for (let n = 0; n < count; n += 1) {
      const id = await seedEvent(sql, { ownerId: OWNER, status: "SUBMITTED", endsAt: new Date(EVENT_END), name: `L7 event ${n}` });
      await sql`update event.events set submitted_at = now() - ${(count - n) * 60} * interval '1 second' where id = ${id}`;
      created.push(id);
    }
    return created.reverse();
  }

  async function draft(name: string, savedSecondsAgo: number): Promise<string> {
    const [row] = await sql<{ id: string }[]>`
      insert into event.events (owner_id, name, status, last_saved_at, created_by, updated_by)
      values (${OWNER}, ${name}, 'DRAFT', now() - ${savedSecondsAgo} * interval '1 second', ${OWNER}, ${OWNER})
      returning id
    `;
    return row!.id;
  }

  /** Follows nextCursor to the end, returning each page's ids. */
  async function allPages(query: string): Promise<string[][]> {
    const pages: string[][] = [];
    let cursor: string | null = null;
    do {
      const res = await list(`${query}${cursor ? `&cursor=${cursor}` : ""}`);
      expect(res.status).toBe(200);
      pages.push(ids(res));
      cursor = res.body.nextCursor;
    } while (cursor && pages.length < 20);
    return pages;
  }

  beforeEach(() => signedInAs(OWNER, "EVENT_ORGANISER"));

  it("returns 25 by default with a cursor, and the same shape as before: items and nextCursor", async () => {
    const created = await submittedEvents(30);

    const res = await list();

    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual(["items", "nextCursor"]);
    expect(ids(res)).toEqual(created.slice(0, 25));
    expect(typeof res.body.nextCursor).toBe("string");
    expect(res.body.items[0]).toMatchObject({ kind: "EVENT", status: "SUBMITTED", name: "L7 event 29" });
  });

  it("returns everything with no cursor when the list fits in one page", async () => {
    const created = await submittedEvents(3);

    const res = await list();

    expect(ids(res)).toEqual(created);
    expect(res.body.nextCursor).toBeNull();
  });

  it("pages through 30 events ten at a time with none repeated and none skipped, newest first", async () => {
    const created = await submittedEvents(30);

    const pages = await allPages("?limit=10");

    expect(pages.map((page) => page.length)).toEqual([10, 10, 10]);
    expect(pages.flat()).toEqual(created);
  });

  it("ends exactly at a page boundary without a phantom empty page", async () => {
    await submittedEvents(20);

    const pages = await allPages("?limit=10");

    expect(pages.map((page) => page.length)).toEqual([10, 10]);
  });

  it("neither repeats nor skips events listed at the same instant", async () => {
    const created = await submittedEvents(7);
    await sql`update event.events set submitted_at = '2026-11-02T09:00:00Z' where id in ${sql(created)}`;

    const pages = await allPages("?limit=3");

    expect([...pages.flat()].sort()).toEqual([...created].sort());
    expect(new Set(pages.flat()).size).toBe(7);
  });

  it("is not thrown by an event submitted while someone is paging: the next page carries on from where it was", async () => {
    const created = await submittedEvents(6);
    const first = await list("?limit=3");
    const newcomer = await seedEvent(sql, { ownerId: OWNER, status: "SUBMITTED", endsAt: new Date(EVENT_END), name: "L7 newcomer" });

    const second = await list(`?limit=3&cursor=${first.body.nextCursor}`);

    expect(ids(first)).toEqual(created.slice(0, 3));
    expect(ids(second)).toEqual(created.slice(3));
    expect(ids(second)).not.toContain(newcomer);
  });

  it("filters by kind in the query, so a page of drafts holds drafts only", async () => {
    await submittedEvents(4);
    const older = await draft("L7 older draft", 600);
    const newer = await draft("L7 newer draft", 300);

    expect((await allPages("?kind=drafts&limit=1")).flat()).toEqual([newer, older]);
    const submitted = (await allPages("?kind=submitted&limit=3")).flat();
    expect(submitted).toHaveLength(4);
    expect(submitted).not.toContain(newer);
    const everything = (await allPages("?limit=4")).flat();
    expect(everything).toHaveLength(6);
  });

  it("lists nobody else's requests on any page (A3)", async () => {
    await submittedEvents(5);
    const theirs = await seedEvent(sql, { ownerId: COORDINATOR_A, status: "SUBMITTED", endsAt: new Date(EVENT_END), name: "L7 theirs" });
    try {
      const pages = await allPages("?limit=2");
      expect(pages.flat()).toHaveLength(5);
      expect(pages.flat()).not.toContain(theirs);
    } finally {
      await deleteSeededEvents(sql, [COORDINATOR_A]);
    }
  });

  it.each(["0", "101", "-3", "ten", "2.5", ""])("refuses limit=%j with 400 and names the field", async (limit) => {
    const res = await list(`?limit=${limit}`);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({ code: "VALIDATION_FAILED", fields: [{ field: "limit" }] });
  });

  it("accepts the largest page of 100", async () => {
    expect((await list("?limit=100")).status).toBe(200);
  });

  it.each(["garbage", "e30", "bm90LWpzb24"])("refuses cursor=%s, which this service did not issue", async (cursor) => {
    const res = await list(`?cursor=${cursor}`);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({ code: "VALIDATION_FAILED", fields: [{ field: "cursor" }] });
  });
});
