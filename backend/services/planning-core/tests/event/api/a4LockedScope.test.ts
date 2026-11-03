import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import postgres, { type Sql, type TransactionSql } from "postgres";
import type { AccessScope } from "@connectsphere/contracts";
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
 * A4 (CR-05): a reassigned event leaves the outgoing coordinator at once, even when their action
 * was already waiting for the event's row lock while the Lead reassigned it (E4). Under READ
 * COMMITTED the waiting statement re-checks only the locked row, so the coordinator scope's
 * assignment test would still see the outgoing coordinator; findEventInScope checks it again once
 * the lock is held. Each test queues one action behind an uncommitted reassignment, lets the Lead
 * commit, and expects the action to find nothing and store nothing.
 */

vi.mock("../../../src/shared/auth/verifyJwt.js", () => ({
  verifyJwt: (req: { auth?: { supabaseUserId?: string } }, _res: unknown, next: () => void) => {
    req.auth = { supabaseUserId: "a4-lock-subject" };
    next();
  },
}));
vi.mock("../../../src/modules/event/auth/identity.js", async () => ({
  ...(await vi.importActual<object>("../../../src/modules/event/auth/identity.js")),
  resolveCurrentUser: vi.fn(),
}));

const { resolveCurrentUser } = await import("../../../src/modules/event/auth/identity.js");
const { app } = await import("../../../src/app.js");

const sql = testDb();
const OWNER = "0a4c0000-0000-4000-8000-000000000001";
const LEAD = "0a4c0000-0000-4000-8000-000000000002";
const OUTGOING = "0a4c0000-0000-4000-8000-000000000003";
const INCOMING = "0a4c0000-0000-4000-8000-000000000004";
const bearer = { Authorization: "Bearer a4-lock-token" };
const NOT_ASSIGNED = "No event with that reference is assigned to you.";
const outgoingScope: AccessScope = { scopeType: "ASSIGNED_TO_USER", userId: OUTGOING };
const outgoingActor = { userId: OUTGOING, role: "EVENT_COORDINATOR" as const };

function signedInAsOutgoing() {
  vi.mocked(resolveCurrentUser).mockResolvedValue({ id: OUTGOING, email: "a4-lock@connectsphere.test", role: "EVENT_COORDINATOR" });
}

async function cleanUp() {
  const owned = sql`select id from event.events where owner_id = ${OWNER}`;
  await sql`delete from change.outbox where message_key in (select id::text from (${owned}) e)`;
  await sql`delete from change.change_request_fields where request_id in (select id from change.change_requests where event_id in (${owned}))`;
  await sql`delete from change.change_requests where event_id in (${owned})`;
  await deleteSeededEvents(sql, [OWNER]);
}

beforeEach(async () => {
  vi.mocked(resolveCurrentUser).mockReset();
  await cleanUp();
});

afterAll(async () => {
  await cleanUp();
  await sql.end();
});

async function eventAssignedToOutgoing(status: "PLANNING" | "SUBMITTED" | "UNDER_REVIEW"): Promise<string> {
  const id = await seedEvent(sql, { ownerId: OWNER, status, endsAt: new Date(EVENT_END), name: "A4 Locked Scope" });
  await assignForTest(sql, { id }, OUTGOING);
  return id;
}

/** Waits until another backend is blocked on a lock whose statement mentions `fragment`. */
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

/** One more connection, with a transaction of its own, to act as a second user of the database. */
const connection = (): Sql => postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });

/**
 * The Lead reassigns the event from OUTGOING to INCOMING as E4's route does (row lock, close the
 * active assignment, insert the new one) and holds the commit. `act` starts, queues behind the
 * lock, and is let go when the Lead commits.
 */
async function whileTheLeadReassigns<T>(eventId: string, act: () => Promise<T>): Promise<T> {
  const leadConnection = connection();
  let commit!: () => void;
  const mayCommit = new Promise<void>((resolve) => (commit = resolve));
  let held!: () => void;
  const lockHeld = new Promise<void>((resolve) => (held = resolve));
  try {
    const lead = leadConnection.begin(async (tx) => {
      await lockEventForAssignment(tx, eventId);
      const current = (await findActiveAssignment(tx, eventId))!;
      await closeActiveAssignment(tx, current.id, LEAD);
      await insertAssignment(tx, eventId, INCOMING, "LEAD", LEAD);
      held();
      await mayCommit;
    });
    await lockHeld;
    const acting = act();
    await waitUntilBlocked("event.events");
    commit();
    await lead;
    return await acting;
  } finally {
    commit();
    await leadConnection.end();
  }
}

/** Runs `reader` in a transaction on a connection of its own. */
async function onItsOwnConnection<T>(reader: (tx: TransactionSql) => Promise<T>): Promise<T> {
  const readerConnection = connection();
  try {
    return await readerConnection.begin((tx) => reader(tx));
  } finally {
    await readerConnection.end();
  }
}

describe.runIf(isThrowawayDatabase())("A4: a reassignment that commits while a coordinator's action waits for the lock", () => {
  it("findEventForChange under an update lock finds nothing for the outgoing coordinator, as it would a moment later", async () => {
    const eventId = await eventAssignedToOutgoing("PLANNING");

    const seen = await whileTheLeadReassigns(eventId, () =>
      onItsOwnConnection((tx) => findEventForChange(tx, eventId, outgoingScope, OUTGOING, { lock: "update" })),
    );

    expect(seen).toBeNull();
    expect(await findEventForChange(sql, eventId, outgoingScope, OUTGOING)).toBeNull();
    const incoming = await findEventForChange(sql, eventId, { scopeType: "ASSIGNED_TO_USER", userId: INCOMING }, INCOMING);
    expect(incoming?.assignedCoordinatorId).toBe(INCOMING);
  });

  it("findEventForChange under a share lock does too", async () => {
    const eventId = await eventAssignedToOutgoing("PLANNING");

    const seen = await whileTheLeadReassigns(eventId, () =>
      onItsOwnConnection((tx) => findEventForChange(tx, eventId, outgoingScope, OUTGOING, { lock: "share" })),
    );

    expect(seen).toBeNull();
  });

  it("F5: the outgoing coordinator's confirmation is not found, and the event stays in Planning", async () => {
    const eventId = await eventAssignedToOutgoing("PLANNING");

    const outcome = await whileTheLeadReassigns(eventId, () =>
      onItsOwnConnection((tx) => confirmArrangements(tx, eventId, outgoingActor)),
    );

    expect(outcome).toEqual({ ok: false, code: "NOT_FOUND" });
    const [stored] = await sql<{ status: string }[]>`select status from event.events where id = ${eventId}`;
    expect(stored!.status).toBe("PLANNING");
  });

  it("S2: the outgoing coordinator's approval of a change is not found, and the request stays Pending", async () => {
    const eventId = await eventAssignedToOutgoing("PLANNING");
    const [row] = await sql<{ reference: string }[]>`select reference from event.events where id = ${eventId}`;
    const pending = await sql.begin((tx) =>
      insertChangeRequest(tx, {
        event: { id: eventId, reference: row!.reference },
        reason: "A4 locked scope",
        changes: { expectedAttendance: 160 },
        current: { expectedAttendance: 150 },
        actorId: OWNER,
      }),
    );

    const outcome = await whileTheLeadReassigns(eventId, () =>
      onItsOwnConnection((tx) => decideChangeRequest(tx, pending.id, { decision: "APPROVE" }, outgoingActor)),
    );

    expect(outcome).toEqual({ ok: false, code: "NOT_FOUND" });
    const [stored] = await sql<{ status: string }[]>`select status from change.change_requests where id = ${pending.id}`;
    expect(stored!.status).toBe("PENDING");
  });

  it("D4: the outgoing coordinator's approval is refused as not assigned to them, and the event stays Under Review", async () => {
    const eventId = await eventAssignedToOutgoing("UNDER_REVIEW");
    signedInAsOutgoing();

    const res = await whileTheLeadReassigns(eventId, async () =>
      request(app).post(`/api/v1/events/${eventId}/approve`).set(bearer).send(),
    );

    expect(res.status, res.text).toBe(404);
    expect(res.body.error).toMatchObject({ code: "EVENT_NOT_FOUND", message: NOT_ASSIGNED });
    const [stored] = await sql<{ status: string; decided_at: Date | null }[]>`select status, decided_at from event.events where id = ${eventId}`;
    expect(stored).toEqual({ status: "UNDER_REVIEW", decided_at: null });
    expect((await sql`select 1 from event.outbox where message_key = ${eventId}`).length).toBe(0);
  });

  it("D5: the outgoing coordinator's rejection is refused the same way", async () => {
    const eventId = await eventAssignedToOutgoing("UNDER_REVIEW");
    signedInAsOutgoing();

    const res = await whileTheLeadReassigns(eventId, async () =>
      request(app).post(`/api/v1/events/${eventId}/reject`).set(bearer).send({ reason: "No suitable venue." }),
    );

    expect(res.status, res.text).toBe(404);
    expect(res.body.error).toMatchObject({ code: "EVENT_NOT_FOUND", message: NOT_ASSIGNED });
    const [stored] = await sql<{ status: string }[]>`select status from event.events where id = ${eventId}`;
    expect(stored!.status).toBe("UNDER_REVIEW");
  });

  it("D1: opening a Submitted request while the Lead reassigns it neither claims nor shows it", async () => {
    const eventId = await eventAssignedToOutgoing("SUBMITTED");
    signedInAsOutgoing();

    const res = await whileTheLeadReassigns(eventId, async () => request(app).get(`/api/v1/events/${eventId}`).set(bearer));

    expect(res.status, res.text).toBe(404);
    expect(res.body).toEqual({ error: { code: "EVENT_NOT_FOUND", message: NOT_ASSIGNED, correlationId: expect.any(String) } });
    const [stored] = await sql<{ status: string; reviewing_coordinator_id: string | null }[]>`
      select status, reviewing_coordinator_id from event.events where id = ${eventId}`;
    expect(stored).toEqual({ status: "SUBMITTED", reviewing_coordinator_id: null });
  });
});
