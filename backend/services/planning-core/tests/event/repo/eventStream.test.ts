import { createHash, randomUUID } from "node:crypto";
import postgres from "postgres";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { testDb } from "../../support/testDb.js";
import { deleteSeededEvents, seedEvent } from "../../support/seedEvent.js";
import {
  backfill,
  historyOf,
  inRolledBackTransaction,
  streamOf,
  writeHistoryBeforeTheStream,
  type StreamRow,
} from "../../support/eventStream.js";

/**
 * EN-03 (SPM-121, ADR-0007) — the event stream: the append, the projections
 * and outbox written with it, the guards, and the backfill of the history that
 * existed before it. Each test is named after its card in tests/EN-03/.
 */

vi.mock("../../../src/shared/auth/verifyJwt.js", () => ({
  verifyJwt: (req: { auth?: { supabaseUserId?: string } }, _res: unknown, next: () => void) => {
    req.auth = { supabaseUserId: "test-subject" };
    next();
  },
}));

vi.mock("../../../src/modules/event/auth/identity.js", async () => {
  const actual = await vi.importActual<typeof import("../../../src/modules/event/auth/identity.js")>(
    "../../../src/modules/event/auth/identity.js"
  );
  return { ...actual, resolveCurrentUser: vi.fn(), resolveEventsScope: vi.fn() };
});

const { resolveCurrentUser, resolveEventsScope } = await import("../../../src/modules/event/auth/identity.js");
const { app } = await import("../../../src/app.js");
const { appendToStream, StreamVersionTakenError } = await import("../../../src/modules/event/repo/eventStream.js");
const { recordFieldChanges, recordStatusChange } = await import("../../../src/modules/event/repo/eventHistory.js");
const { transitionEvent } = await import("../../../src/modules/event/api/transitionEvent.js");
const { applyApprovedChange, findEventForChange } = await import("../../../src/modules/event/index.js");
const { statusChangeEntry, GENESIS_HASH } = await import("../../../src/modules/event/domain/eventStream.js");
const { verifyEventStore } = await import("../../../src/modules/event/repo/eventStreamVerification.js");

const sql = testDb();
const OWNER = randomUUID();
const COORDINATOR = randomUUID();
const bearer = { Authorization: "Bearer test-token" };
const FUTURE = new Date("2030-06-01T12:00:00.000Z");

function signedInAs(userId: string, role: "EVENT_ORGANISER" | "EVENT_COORDINATOR") {
  vi.mocked(resolveCurrentUser).mockResolvedValue({ id: userId, email: "user@connectsphere.test", role });
  vi.mocked(resolveEventsScope).mockResolvedValue(
    role === "EVENT_COORDINATOR" ? { scopeType: "ALL" } : { scopeType: "OWNED_BY_USER", userId }
  );
}

const seed = (status: Parameters<typeof seedEvent>[1]["status"]) => seedEvent(sql, { ownerId: OWNER, status, endsAt: FUTURE });

const sha256 = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");

/** Each entry's hash recomputed outside the database, from its prev_hash and canonical text. */
function expectIntactChain(rows: StreamRow[]) {
  rows.forEach((row, index) => {
    expect(row.version).toBe(index + 1);
    expect(row.prevHash).toBe(index === 0 ? GENESIS_HASH : rows[index - 1]!.hash);
    expect(row.hash).toBe(sha256(row.prevHash + row.canonical));
  });
}

async function expectVerified(eventId: string) {
  const result = await verifyEventStore(sql, { aggregateId: eventId });
  expect(result.brokenLink).toBeNull();
  expect(result.projectionMismatch).toBeNull();
}

const count = async (query: Promise<{ n: number }[]>) => (await query)[0]!.n;

beforeEach(async () => {
  vi.mocked(resolveCurrentUser).mockReset();
  vi.mocked(resolveEventsScope).mockReset();
  await deleteSeededEvents(sql, [OWNER]);
});

afterAll(async () => {
  await deleteSeededEvents(sql, [OWNER]);
  await sql.end();
});

describe("the stream (EN-03 criterion 1)", () => {
  it("EN-03-T1 each append takes the next version and links to the previous entry's hash", async () => {
    const id = await seed("SUBMITTED");

    await sql.begin((tx) =>
      recordStatusChange(tx, id, {
        previousStatus: "SUBMITTED",
        newStatus: "UNDER_REVIEW",
        actorUserId: COORDINATOR,
        actorRole: "EVENT_COORDINATOR",
        triggeringAction: "OPEN_FOR_REVIEW",
      })
    );
    await sql.begin((tx) =>
      recordFieldChanges(
        tx,
        id,
        [{ fieldName: "purpose", previousValue: "Seeded for a test", newValue: "Revised" }],
        { userId: OWNER, role: "EVENT_ORGANISER" },
        "RESPOND_TO_CLARIFICATION"
      )
    );
    await sql.begin((tx) =>
      recordStatusChange(tx, id, {
        previousStatus: "UNDER_REVIEW",
        newStatus: "APPROVED",
        actorUserId: COORDINATOR,
        actorRole: "EVENT_COORDINATOR",
        triggeringAction: "APPROVE",
      })
    );

    const rows = await streamOf(sql, id);
    expect(rows.map((r) => [r.version, r.type, r.newStatus ?? r.fieldName])).toEqual([
      [1, "STATUS_CHANGE", "UNDER_REVIEW"],
      [2, "FIELD_CHANGE", "purpose"],
      [3, "STATUS_CHANGE", "APPROVED"],
    ]);
    expect(rows[0]!.prevHash).toBe("0".repeat(64));
    expectIntactChain(rows);
    await expectVerified(id);
  });

  it("EN-03-T2 the canonical form an entry is hashed over is fixed and documented", async () => {
    const [row] = await sql<{ canonical: string; hash: string }[]>`
      select canonical, event.stream_entry_hash(repeat('0', 64), canonical) as hash
      from (
        select event.stream_entry_canonical(
          '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 1, 'FIELD_CHANGE',
          event.history_entry_data('FIELD_CHANGE', null, null, 'description', 'Line one', ${'Café "quoted"\n'}, 'UPDATE_DETAILS'),
          null, 'SYSTEM', '2026-11-03T01:02:03.456789Z'
        ) as canonical
      ) c
    `;

    expect(row!.canonical).toBe(
      '{"id": "00000000-0000-4000-8000-000000000001", "data": {"newValue": "Café \\"quoted\\"\\n", ' +
        '"fieldName": "description", "previousValue": "Line one", "triggeringAction": "UPDATE_DETAILS"}, ' +
        '"type": "FIELD_CHANGE", "version": 1, "actorRole": "SYSTEM", ' +
        '"occurredAt": "2026-11-03T01:02:03.456789Z", "actorUserId": null, ' +
        '"aggregateId": "00000000-0000-4000-8000-000000000002"}'
    );
    expect(row!.hash).toBe(sha256("0".repeat(64) + row!.canonical));
  });

  it("EN-03-T3 two appends racing for the same version store exactly one", async () => {
    const id = await seed("SUBMITTED");
    const url = process.env.DATABASE_URL!;
    const first = postgres(url, { max: 1, prepare: false });
    const second = postgres(url, { max: 1, prepare: false });
    const entry = statusChangeEntry({
      previousStatus: "SUBMITTED",
      newStatus: "UNDER_REVIEW",
      actorUserId: COORDINATOR,
      actorRole: "EVENT_COORDINATOR",
      triggeringAction: "OPEN_FOR_REVIEW",
    });

    try {
      let appended!: () => void;
      let release!: () => void;
      const firstAppended = new Promise<void>((resolve) => (appended = resolve));
      const held = new Promise<void>((resolve) => (release = resolve));

      // Neither takes the event's row lock, so only the unique version guard stands between them.
      const winner = first.begin(async (tx) => {
        await appendToStream(tx, id, [entry]);
        appended();
        await held;
      });
      await firstAppended;
      const loser = second.begin((tx) => appendToStream(tx, id, [{ ...entry, actorRole: "SYSTEM" }]));
      const settledLoser = loser.then(
        () => "stored",
        (error: unknown) => error
      );

      // The second computed version 1 too, and now waits on the first's uncommitted entry.
      for (let tries = 0; tries < 100; tries++) {
        const waiting = await count(sql<{ n: number }[]>`
          select count(*)::int as n from pg_stat_activity
          where wait_event_type = 'Lock' and query like '%append_to_stream%'
        `);
        if (waiting > 0) break;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      release();
      await winner;

      const outcome = await settledLoser;
      expect(outcome).toBeInstanceOf(StreamVersionTakenError);
      expect((outcome as Error).message).toBe(
        `Another change to event ${id} was recorded first, so this one was not stored.`
      );
    } finally {
      await first.end();
      await second.end();
    }

    const rows = await streamOf(sql, id);
    expect(rows).toHaveLength(1);
    expect(rows[0]!).toMatchObject({ version: 1, actorRole: "EVENT_COORDINATOR" });
    expect(await historyOf(sql, id)).toHaveLength(1);
    await expectVerified(id);
  });

  it("EN-03-T4 the stream refuses updates, deletes and truncation, and the app role may only insert and read", async () => {
    const id = await seed("SUBMITTED");
    await sql.begin((tx) =>
      recordStatusChange(tx, id, {
        previousStatus: "SUBMITTED",
        newStatus: "UNDER_REVIEW",
        actorUserId: COORDINATOR,
        actorRole: "EVENT_COORDINATOR",
        triggeringAction: "OPEN_FOR_REVIEW",
      })
    );
    const [before] = await streamOf(sql, id);

    await expect(
      inRolledBackTransaction(sql, (tx) => tx`update event.event_stream set data = '{}'::jsonb where id = ${before!.id}`)
    ).rejects.toThrow("event.event_stream is append-only: UPDATE is not allowed (ADR-0007)");
    await expect(
      inRolledBackTransaction(sql, (tx) => tx`delete from event.event_stream where id = ${before!.id}`)
    ).rejects.toThrow("event.event_stream is append-only: DELETE is not allowed (ADR-0007)");
    await expect(inRolledBackTransaction(sql, (tx) => tx`truncate event.event_stream`)).rejects.toThrow(
      "event.event_stream is append-only: TRUNCATE is not allowed (ADR-0007)"
    );
    expect(await streamOf(sql, id)).toStrictEqual([before]);

    const [{ current_user: role }] = await sql<{ current_user: string }[]>`select current_user`;
    const grants = await sql<{ grantee: string; privilege_type: string }[]>`
      select coalesce(r.rolname, 'PUBLIC') as grantee, a.privilege_type
      from pg_class c
      cross join lateral aclexplode(c.relacl) a
      left join pg_roles r on r.oid = a.grantee
      where c.oid = 'event.event_stream'::regclass
      order by 1, 2
    `;
    expect(grants.map((g) => ({ ...g }))).toStrictEqual([
      { grantee: role, privilege_type: "INSERT" },
      { grantee: role, privilege_type: "SELECT" },
    ]);
  });
});

describe("the projections and the outbox (EN-03 criterion 2)", () => {
  it("EN-03-T5 a status change writes the stream entry, the projections and the outbox message in one transaction", async () => {
    const id = await seed("UNDER_REVIEW");

    const outcome = await sql.begin((tx) =>
      transitionEvent(tx, id, "APPROVE", { userId: COORDINATOR, role: "EVENT_COORDINATOR" })
    );
    expect(outcome.ok).toBe(true);

    const [entry] = await streamOf(sql, id);
    expect(entry).toMatchObject({
      version: 1,
      type: "STATUS_CHANGE",
      previousStatus: "UNDER_REVIEW",
      newStatus: "APPROVED",
      triggeringAction: "APPROVE",
      actorUserId: COORDINATOR,
      actorRole: "EVENT_COORDINATOR",
    });
    const history = await historyOf(sql, id);
    expect(history).toHaveLength(1);
    expect({ ...history[0]! }).toStrictEqual({
      id: entry!.id,
      entry_type: "STATUS_CHANGE",
      previous_status: "UNDER_REVIEW",
      new_status: "APPROVED",
      field_name: null,
      previous_value: null,
      new_value: null,
      triggering_action: "APPROVE",
      actor_user_id: COORDINATOR,
      actor_role: "EVENT_COORDINATOR",
      occurred_at: entry!.occurredAt,
    });

    // xmin is the id of the transaction that wrote each row: one transaction wrote all four.
    const [writers] = await sql<{ events: string; stream: string; history: string; outbox: string[] }[]>`
      select
        (select xmin::text from event.events where id = ${id}) as events,
        (select xmin::text from event.event_stream where id = ${entry!.id}) as stream,
        (select xmin::text from event.event_history where id = ${entry!.id}) as history,
        (select array_agg(xmin::text) from event.outbox
          where message_key = ${id} and envelope ->> 'type' = 'event.status-changed') as outbox
    `;
    expect(writers!.outbox).toHaveLength(1);
    expect(new Set([writers!.events, writers!.stream, writers!.history, writers!.outbox[0]]).size).toBe(1);
    const [status] = await sql`select status from event.events where id = ${id}`;
    expect(status!.status).toBe("APPROVED");
  });

  it("EN-03-T6 a transaction that fails after the append stores nothing", async () => {
    const id = await seed("UNDER_REVIEW");

    await expect(
      sql.begin(async (tx) => {
        const outcome = await transitionEvent(tx, id, "APPROVE", { userId: COORDINATOR, role: "EVENT_COORDINATOR" });
        expect(outcome.ok).toBe(true);
        throw new Error("a later step of the action failed");
      })
    ).rejects.toThrow("a later step of the action failed");

    const [status] = await sql`select status from event.events where id = ${id}`;
    expect(status!.status).toBe("UNDER_REVIEW");
    expect(await streamOf(sql, id)).toHaveLength(0);
    expect(await historyOf(sql, id)).toHaveLength(0);
    expect(await count(sql<{ n: number }[]>`select count(*)::int as n from event.outbox where message_key = ${id}`)).toBe(0);
  });

  it("EN-03-T7 every writer of an event's history appends to the stream", async () => {
    // D3: the organiser answers a clarification and amends two fields.
    const d3 = await seed("AWAITING_CLARIFICATION");
    await sql`
      insert into event.clarifications (event_id, message, requested_by, status, created_by, updated_by)
      values (${d3}, 'Please confirm the purpose.', ${COORDINATOR}, 'OPEN', ${COORDINATOR}, ${COORDINATOR})
    `;
    signedInAs(OWNER, "EVENT_ORGANISER");
    const responded = await request(app)
      .post(`/api/v1/events/${d3}/clarifications/respond`)
      .set(bearer)
      .send({ message: "Updated.", amendments: { purpose: "Revised purpose", description: "Revised description" } });
    expect(responded.status).toBe(200);

    // G1: the owner edits one descriptive field.
    const g1 = await seed("APPROVED");
    const edited = await request(app)
      .patch(`/api/v1/events/${g1}`)
      .set(bearer)
      .set("If-Match", '"1"')
      .send({ description: "A new description" });
    expect(edited.status).toBe(200);

    // S2: an approved change to the expected attendance.
    const s2 = await seed("PLANNING");
    const event = await findEventForChange(sql, s2, { scopeType: "ALL" }, COORDINATOR);
    await sql.begin((tx) =>
      applyApprovedChange(tx, event!, { expectedAttendance: 200 }, { userId: COORDINATOR, role: "EVENT_COORDINATOR" })
    );

    for (const [eventId, written] of [
      [d3, 3],
      [g1, 1],
      [s2, 1],
    ] as const) {
      const history = await historyOf(sql, eventId);
      const stream = await streamOf(sql, eventId);
      expect(history).toHaveLength(written);
      expect(stream).toHaveLength(written);
      const byId = new Map(stream.map((entry) => [entry.id, entry]));
      for (const row of history) {
        const entry = byId.get(row.id);
        expect(entry, `history row ${row.id} of event ${eventId} has a stream entry`).toBeDefined();
        expect({
          type: entry!.type,
          previous_status: entry!.previousStatus,
          new_status: entry!.newStatus,
          field_name: entry!.fieldName,
          previous_value: entry!.previousValue,
          new_value: entry!.newValue,
          triggering_action: entry!.triggeringAction,
          actor_user_id: entry!.actorUserId,
          actor_role: entry!.actorRole,
          occurred_at: entry!.occurredAt,
        }).toStrictEqual({
          type: row.entry_type,
          previous_status: row.previous_status,
          new_status: row.new_status,
          field_name: row.field_name,
          previous_value: row.previous_value,
          new_value: row.new_value,
          triggering_action: row.triggering_action,
          actor_user_id: row.actor_user_id,
          actor_role: row.actor_role,
          occurred_at: row.occurred_at,
        });
      }
      expectIntactChain(stream);
      await expectVerified(eventId);
    }

    expect((await streamOf(sql, d3)).map((e) => e.fieldName ?? e.newStatus).sort()).toEqual([
      "UNDER_REVIEW",
      "description",
      "purpose",
    ]);
    expect((await streamOf(sql, g1))[0]).toMatchObject({ fieldName: "description", newValue: "A new description", actorRole: "EVENT_ORGANISER", triggeringAction: "UPDATE_DETAILS" });
    expect((await streamOf(sql, s2))[0]).toMatchObject({
      fieldName: "expectedAttendance",
      previousValue: "150",
      newValue: "200",
      triggeringAction: "CHANGE_REQUEST_APPROVED",
    });
  });

  it("EN-03-T8 a history row written without the append function still reaches the stream", async () => {
    const id = await seed("SUBMITTED");
    await sql.begin((tx) =>
      recordStatusChange(tx, id, {
        previousStatus: "DRAFT",
        newStatus: "SUBMITTED",
        actorUserId: OWNER,
        actorRole: "EVENT_ORGANISER",
        triggeringAction: "SUBMIT",
      })
    );

    const [direct] = await sql<{ id: string }[]>`
      insert into event.event_history (event_id, entry_type, previous_status, new_status, actor_role, triggering_action, occurred_at)
      values (${id}, 'STATUS_CHANGE', 'SUBMITTED', 'UNDER_REVIEW', 'EVENT_COORDINATOR', 'OPEN_FOR_REVIEW', '2030-01-02T03:04:05.678901Z')
      returning id
    `;

    const stream = await streamOf(sql, id);
    expect(stream).toHaveLength(2);
    expect(stream[1]).toMatchObject({
      id: direct!.id,
      version: 2,
      previousStatus: "SUBMITTED",
      newStatus: "UNDER_REVIEW",
      actorUserId: null,
      actorRole: "EVENT_COORDINATOR",
      triggeringAction: "OPEN_FOR_REVIEW",
    });
    expect(stream[1]!.prevHash).toBe(stream[0]!.hash);
    expectIntactChain(stream);

    await expect(
      sql`
        insert into event.event_history (event_id, entry_type, actor_role, triggering_action)
        values (${id}, 'STATUS_CHANGE', 'EVENT_COORDINATOR', 'APPROVE')
      `
    ).rejects.toThrow();
    // The same entry through the append is refused by the stream itself, and is not mistaken for a lost race.
    const refused = await sql
      .begin((tx) => appendToStream(tx, id, [{ ...statusChangeEntry({ previousStatus: "SUBMITTED", newStatus: "APPROVED", actorUserId: null, actorRole: "SYSTEM", triggeringAction: "APPROVE" }), newStatus: null }]))
      .catch((error: unknown) => error);
    expect(refused).toBeInstanceOf(Error);
    expect(refused).not.toBeInstanceOf(StreamVersionTakenError);
    expect((refused as Error).message).toContain("event_stream_status_change_names_its_status");
    expect(await streamOf(sql, id)).toHaveLength(2);
    expect(await historyOf(sql, id)).toHaveLength(2);
    await expectVerified(id);
  });
});

describe("the backfill of the history written before the stream (EN-03 criterion 3)", () => {
  it("EN-03-T9 the backfill copies an event's existing history into the stream in time order", async () => {
    const id = await seed("PLANNING");
    const [oct3, oct1, oct2, oct2Field] = await writeHistoryBeforeTheStream(sql, [
      { eventId: id, entryType: "STATUS_CHANGE", previousStatus: "APPROVED", newStatus: "PLANNING", actorUserId: COORDINATOR, actorRole: "EVENT_COORDINATOR", triggeringAction: "START_PLANNING", occurredAt: "2026-10-03T00:00:00Z" },
      { eventId: id, entryType: "STATUS_CHANGE", previousStatus: "DRAFT", newStatus: "SUBMITTED", actorUserId: OWNER, actorRole: "EVENT_ORGANISER", triggeringAction: "SUBMIT", occurredAt: "2026-10-01T00:00:00Z" },
      { eventId: id, entryType: "STATUS_CHANGE", previousStatus: "SUBMITTED", newStatus: "APPROVED", actorUserId: COORDINATOR, actorRole: "EVENT_COORDINATOR", triggeringAction: "APPROVE", occurredAt: "2026-10-02T00:00:00Z" },
      { eventId: id, entryType: "FIELD_CHANGE", fieldName: "purpose", previousValue: "Before", newValue: "After", actorUserId: OWNER, actorRole: "EVENT_ORGANISER", triggeringAction: "RESPOND_TO_CLARIFICATION", occurredAt: "2026-10-02T12:00:00Z" },
    ]);
    expect(await streamOf(sql, id)).toHaveLength(0);

    expect(await backfill(sql)).toBe(4);

    const stream = await streamOf(sql, id);
    expect(stream.map((e) => [e.version, e.id, e.occurredAt.toISOString()])).toEqual([
      [1, oct1, "2026-10-01T00:00:00.000Z"],
      [2, oct2, "2026-10-02T00:00:00.000Z"],
      [3, oct2Field, "2026-10-02T12:00:00.000Z"],
      [4, oct3, "2026-10-03T00:00:00.000Z"],
    ]);
    expect(stream[2]).toMatchObject({ type: "FIELD_CHANGE", fieldName: "purpose", previousValue: "Before", newValue: "After", actorUserId: OWNER });
    expect(stream[3]).toMatchObject({ previousStatus: "APPROVED", newStatus: "PLANNING", triggeringAction: "START_PLANNING" });
    expectIntactChain(stream);
    await expectVerified(id);
  });

  it("EN-03-T10 running the backfill again adds nothing", async () => {
    const id = await seed("APPROVED");
    await writeHistoryBeforeTheStream(sql, [
      { eventId: id, entryType: "STATUS_CHANGE", previousStatus: "DRAFT", newStatus: "SUBMITTED", actorRole: "EVENT_ORGANISER", triggeringAction: "SUBMIT", occurredAt: "2026-10-01T00:00:00Z" },
      { eventId: id, entryType: "STATUS_CHANGE", previousStatus: "SUBMITTED", newStatus: "UNDER_REVIEW", actorRole: "EVENT_COORDINATOR", triggeringAction: "OPEN_FOR_REVIEW", occurredAt: "2026-10-01T01:00:00Z" },
      { eventId: id, entryType: "STATUS_CHANGE", previousStatus: "UNDER_REVIEW", newStatus: "APPROVED", actorRole: "EVENT_COORDINATOR", triggeringAction: "APPROVE", occurredAt: "2026-10-01T02:00:00Z" },
      { eventId: id, entryType: "FIELD_CHANGE", fieldName: "name", previousValue: "A", newValue: "B", actorRole: "EVENT_ORGANISER", triggeringAction: "UPDATE_DETAILS", occurredAt: "2026-10-01T03:00:00Z" },
    ]);
    expect(await backfill(sql)).toBe(4);
    const once = await streamOf(sql, id);

    expect(await backfill(sql)).toBe(0);

    expect(await streamOf(sql, id)).toStrictEqual(once);
    expect(once).toHaveLength(4);
    expectIntactChain(once);
    await expectVerified(id);
  });

  it("EN-03-T11 the backfill handles an event with one entry and entries recorded at the same time", async () => {
    const single = await seed("SUBMITTED");
    const tied = await seed("APPROVED");
    const none = await seed("SUBMITTED");
    const at = "2026-10-05T09:00:00Z";
    const [only, third, first, second] = await writeHistoryBeforeTheStream(sql, [
      { eventId: single, entryType: "STATUS_CHANGE", previousStatus: "DRAFT", newStatus: "SUBMITTED", actorRole: "EVENT_ORGANISER", triggeringAction: "SUBMIT", occurredAt: at },
      { eventId: tied, entryType: "STATUS_CHANGE", previousStatus: "UNDER_REVIEW", newStatus: "APPROVED", actorRole: "EVENT_COORDINATOR", triggeringAction: "APPROVE", occurredAt: at, createdAt: "2026-10-05T09:00:03Z" },
      { eventId: tied, entryType: "STATUS_CHANGE", previousStatus: "DRAFT", newStatus: "SUBMITTED", actorRole: "EVENT_ORGANISER", triggeringAction: "SUBMIT", occurredAt: at, createdAt: "2026-10-05T09:00:01Z" },
      { eventId: tied, entryType: "STATUS_CHANGE", previousStatus: "SUBMITTED", newStatus: "UNDER_REVIEW", actorRole: "EVENT_COORDINATOR", triggeringAction: "OPEN_FOR_REVIEW", occurredAt: at, createdAt: "2026-10-05T09:00:02Z" },
    ]);

    expect(await backfill(sql)).toBe(4);

    const singleStream = await streamOf(sql, single);
    expect(singleStream.map((e) => [e.id, e.version, e.prevHash])).toEqual([[only, 1, GENESIS_HASH]]);
    const tiedStream = await streamOf(sql, tied);
    expect(tiedStream.map((e) => [e.id, e.version, e.newStatus])).toEqual([
      [first, 1, "SUBMITTED"],
      [second, 2, "UNDER_REVIEW"],
      [third, 3, "APPROVED"],
    ]);
    expect(await streamOf(sql, none)).toHaveLength(0);
    for (const eventId of [single, tied]) {
      expectIntactChain(await streamOf(sql, eventId));
      await expectVerified(eventId);
    }
  });
});
