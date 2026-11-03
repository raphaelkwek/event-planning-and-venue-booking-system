import { randomUUID } from "node:crypto";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import postgres, { type Sql, type TransactionSql } from "postgres";
import type { AccessScope } from "@connectsphere/contracts";
import { asCaller } from "../../../src/modules/event/repo/requestRole.js";
import { findEventInScope, listEventsInScope } from "../../../src/modules/event/repo/events.js";
import { assignForTest } from "../../support/assignment.js";
import { deleteSeededEvents, seedEvent } from "../../support/seedEvent.js";
import { testDb } from "../../support/testDb.js";

/**
 * EN-07.2 (EN-07-T6 to EN-07-T10): A3 and A4 enforced by row-level security
 * (migration event/0025). Each query below runs as the request role with a
 * caller's claims and deliberately has no WHERE clause, so whatever it returns
 * is what RLS lets through. Throwaway database only (CI).
 */

const sql = testDb();
const FUTURE = new Date("2030-06-01T10:00:00Z");
const owners: string[] = [];

function organiser(): string {
  const id = randomUUID();
  owners.push(id);
  return id;
}

afterEach(async () => {
  await deleteSeededEvents(sql, owners.splice(0));
});
afterAll(() => sql.end());

const scopes = {
  owner: (userId: string): AccessScope => ({ scopeType: "OWNED_BY_USER", userId }),
  assigned: (userId: string): AccessScope => ({ scopeType: "ASSIGNED_TO_USER", userId }),
  all: (): AccessScope => ({ scopeType: "ALL" }),
  none: (): AccessScope => ({ scopeType: "NONE" }),
};

/** Every event id the caller's claims let through, out of `ours` (other tests' rows are ignored). */
async function visibleEvents(scope: AccessScope, callerId: string, ours: string[]): Promise<string[]> {
  const rows = await asCaller(sql, scope, callerId, (tx) => tx<{ id: string }[]>`select id from event.events`);
  return rows.map((row) => row.id).filter((id) => ours.includes(id)).sort();
}

async function visibleAssignments(scope: AccessScope, callerId: string, ours: string[]): Promise<string[]> {
  const rows = await asCaller(sql, scope, callerId, (tx) => tx<{ event_id: string }[]>`select event_id from event.assignments`);
  return rows.map((row) => row.event_id).filter((id) => ours.includes(id)).sort();
}

async function reassign(eventId: string, to: string): Promise<void> {
  await sql`update event.assignments set is_active = false, ended_at = now() where event_id = ${eventId} and is_active`;
  await assignForTest(sql, { id: eventId }, to);
}

describe("row-level security on event.events and event.assignments (EN-07.2)", () => {
  it("EN-07-T6 an organiser's claims see only that organiser's events and drafts, with no WHERE clause", async () => {
    const a = organiser();
    const b = organiser();
    const aEvent = await seedEvent(sql, { ownerId: a, status: "SUBMITTED", endsAt: FUTURE });
    const aDraft = await seedEvent(sql, { ownerId: a, status: "DRAFT", endsAt: FUTURE });
    const bEvent = await seedEvent(sql, { ownerId: b, status: "SUBMITTED", endsAt: FUTURE });
    const ours = [aEvent, aDraft, bEvent];

    expect(await visibleEvents(scopes.owner(a), a, ours)).toEqual([aEvent, aDraft].sort());
    expect(await visibleEvents(scopes.owner(b), b, ours)).toEqual([bEvent]);
  });

  it("EN-07-T7 a coordinator's claims see only the events assigned to them, and a reassignment moves them at once (A4)", async () => {
    const owner = organiser();
    const c1 = randomUUID();
    const c2 = randomUUID();
    const x = await seedEvent(sql, { ownerId: owner, status: "UNDER_REVIEW", endsAt: FUTURE });
    const y = await seedEvent(sql, { ownerId: owner, status: "UNDER_REVIEW", endsAt: FUTURE });
    const z = await seedEvent(sql, { ownerId: owner, status: "SUBMITTED", endsAt: FUTURE });
    await assignForTest(sql, { id: x }, c1);
    await assignForTest(sql, { id: y }, c2);
    const ours = [x, y, z];

    expect(await visibleEvents(scopes.assigned(c1), c1, ours)).toEqual([x]);
    expect(await visibleAssignments(scopes.assigned(c1), c1, ours)).toEqual([x]);

    await reassign(x, c2);

    expect(await visibleEvents(scopes.assigned(c1), c1, ours)).toEqual([]);
    expect(await visibleAssignments(scopes.assigned(c1), c1, ours)).toEqual([]);
    expect(await visibleEvents(scopes.assigned(c2), c2, ours)).toEqual([x, y].sort());
  });

  it("EN-07-T8 the Lead's claims see every event but other people's drafts; no scope, or no claims, see nothing", async () => {
    const owner = organiser();
    const lead = randomUUID();
    const submitted = await seedEvent(sql, { ownerId: owner, status: "SUBMITTED", endsAt: FUTURE });
    const draft = await seedEvent(sql, { ownerId: owner, status: "DRAFT", endsAt: FUTURE });
    const ours = [submitted, draft];

    expect(await visibleEvents(scopes.all(), lead, ours)).toEqual([submitted]);
    // ALL is also what a module passes on purpose (Venue Staff reading the event behind their booking).
    expect(await visibleEvents(scopes.all(), owner, ours)).toEqual(ours.slice().sort());
    expect(await visibleEvents(scopes.none(), randomUUID(), ours)).toEqual([]);

    const noClaims = await sql.begin(async (tx) => {
      await tx`set local role connectsphere_request`;
      return tx<{ id: string }[]>`select id from event.events`;
    });
    expect(noClaims.map((row) => row.id).filter((id) => ours.includes(id))).toEqual([]);
  });

  it("EN-07-T8 the request role can lock an event in scope but never change one", async () => {
    const owner = organiser();
    const id = await seedEvent(sql, { ownerId: owner, status: "SUBMITTED", endsAt: FUTURE });

    const locked = await findEventInScope(sql, id, scopes.owner(owner), owner, { lock: "update" }).catch(() => "threw");
    // Outside a transaction findEventInScope opens its own, so the lock is taken and released.
    expect(locked).not.toBe("threw");
    expect(locked && typeof locked === "object" ? locked.id : null).toBe(id);

    await expect(
      asCaller(sql, scopes.owner(owner), owner, (tx) => tx`update event.events set name = 'changed' where id = ${id}`)
    ).rejects.toThrow(/row-level security/);
    const [row] = await sql<{ name: string }[]>`select name from event.events where id = ${id}`;
    expect(row!.name).toBe("Seeded event");
  });

  it("EN-07-T6 the repo's scoped reads give the same rows under RLS as before", async () => {
    const a = organiser();
    const b = organiser();
    const coordinator = randomUUID();
    const mine = await seedEvent(sql, { ownerId: a, status: "UNDER_REVIEW", endsAt: FUTURE });
    const theirs = await seedEvent(sql, { ownerId: b, status: "UNDER_REVIEW", endsAt: FUTURE });
    await assignForTest(sql, { id: mine }, coordinator);

    expect((await listEventsInScope(sql, scopes.owner(a), a)).map((event) => event.id)).toEqual([mine]);
    expect(await findEventInScope(sql, theirs, scopes.owner(a), a)).toBeNull();
    const asCoordinator = await findEventInScope(sql, mine, scopes.assigned(coordinator), coordinator);
    expect(asCoordinator?.assignedCoordinatorId).toBe(coordinator);
    expect(await findEventInScope(sql, theirs, scopes.assigned(coordinator), coordinator)).toBeNull();
  });

  it("EN-07-T9 the role and claims last only for their transaction, after a commit and after a rollback", async () => {
    const owner = organiser();
    const id = await seedEvent(sql, { ownerId: owner, status: "SUBMITTED", endsAt: FUTURE });
    // One connection, as a transaction-mode pooler hands one server connection to client after client.
    const single = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
    const settings = (tx: Sql | TransactionSql) => tx<{ role: string; user_id: string | null; scope: string | null }[]>`
      select current_user as role,
             nullif(current_setting('app.user_id', true), '') as user_id,
             nullif(current_setting('app.access_scope', true), '') as scope
    `;
    try {
      const [{ role: login }] = await settings(single);

      const inside = await asCaller(single, scopes.owner(owner), owner, async (tx) => {
        await tx`select id from event.events where id = ${id}`;
        return (await settings(tx))[0];
      });
      expect(inside).toEqual({ role: "connectsphere_request", user_id: owner, scope: "OWNED_BY_USER" });
      expect((await settings(single))[0]).toEqual({ role: login, user_id: null, scope: null });

      // Inside a caller's transaction: back to the service role for the rest of it.
      const after = await single.begin(async (tx) => {
        await asCaller(tx, scopes.owner(owner), owner, (scoped) => scoped`select id from event.events where id = ${id}`);
        return (await settings(tx))[0];
      });
      expect(after!.role).toBe(login);

      await single
        .begin(async (tx) => {
          await asCaller(tx, scopes.owner(owner), owner, async () => {
            throw new Error("the read failed");
          });
        })
        .catch(() => undefined);
      expect((await settings(single))[0]).toEqual({ role: login, user_id: null, scope: null });
    } finally {
      await single.end();
    }
  });

  it("EN-07-T10 the login role the migrator, relay and worker use sees every row without claims; the request role sees none", async () => {
    const owner = organiser();
    const coordinator = randomUUID();
    const id = await seedEvent(sql, { ownerId: owner, status: "UNDER_REVIEW", endsAt: FUTURE });
    await assignForTest(sql, { id }, coordinator);

    const [asService] = await sql<{ events: number; assignments: number }[]>`
      select (select count(*)::int from event.events where id = ${id}) as events,
             (select count(*)::int from event.assignments where event_id = ${id}) as assignments
    `;
    expect(asService).toEqual({ events: 1, assignments: 1 });

    const [rls] = await sql<{ rls_on: boolean; forced: boolean }[]>`
      select bool_and(relrowsecurity) as rls_on, bool_or(relforcerowsecurity) as forced
      from pg_catalog.pg_class where oid in ('event.events'::regclass, 'event.assignments'::regclass)
    `;
    expect(rls).toEqual({ rls_on: true, forced: false });

    const asRequest = await sql.begin(async (tx) => {
      await tx`set local role connectsphere_request`;
      return tx<{ events: number }[]>`select count(*)::int as events from event.events where id = ${id}`;
    });
    expect(asRequest[0]!.events).toBe(0);
  });
});
