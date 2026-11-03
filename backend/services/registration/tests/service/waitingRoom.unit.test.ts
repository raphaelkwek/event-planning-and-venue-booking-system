import { describe, expect, it } from "vitest";
import type { Sql } from "postgres";
import { verifyAdmission } from "../../src/domain/admissionToken.js";
import { joinWaitingRoom, placeById, type WaitingRoomConfig } from "../../src/service/waitingRoom.js";

/**
 * EN-19 — joining the waiting room and reading a place, with a scripted
 * database in place of Postgres: which queries the service runs, in what
 * order, and what it makes of the answers. The queries themselves, the gate's
 * lock and the spacing of slots under load run against Postgres in
 * tests/api/en19Cards.test.ts.
 */

type Row = Record<string, unknown>;
type Step = { match: RegExp; rows: Row[] };

function scriptedDatabase(steps: Step[]) {
  const log: string[] = [];
  const run = (strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.join("?").replace(/\s+/g, " ").trim();
    const step = steps.find((candidate) => candidate.match.test(text));
    if (!step) throw new Error(`unscripted query: ${text}`);
    log.push(`${text.split(" ")[0]} ${text.match(/waiting_room_\w+|event_listings/)?.[0] ?? ""}`.trim());
    void values;
    return Promise.resolve(step.rows);
  };
  const sql = Object.assign(run, { begin: <T>(work: (tx: typeof run) => Promise<T>) => work(run) });
  return { sql: sql as unknown as Sql, log };
}

const NOW = new Date("2026-12-05T02:00:00.000Z");
const EVENT = "11111111-1111-4111-8111-111111111111";
const ATTENDEE = "22222222-2222-4222-8222-222222222222";
const ENTRY = "33333333-3333-4333-8333-333333333333";
const CONFIG: WaitingRoomConfig = { admitPerSecond: 50, tokenTtlSeconds: 60, signingKey: "unit-test-signing-key-of-32-chars!!" };

const listing = (over: Row = {}): Row => ({
  event_id: EVENT,
  event_reference: "EVT-000123",
  name: "R Test Symposium",
  description: null,
  owner_id: ATTENDEE,
  status: "CONFIRMED",
  starts_at: new Date("2026-12-16T06:00:00.000Z"),
  ends_at: new Date("2026-12-16T10:00:00.000Z"),
  registration_required: true,
  registration_opens_at: new Date("2026-12-01T01:00:00.000Z"),
  registration_closes_at: new Date("2026-12-10T10:00:00.000Z"),
  withdrawal_deadline_at: null,
  high_demand: true,
  ...over,
});

const entry = (admitAt: Date, over: Row = {}): Row => ({
  id: ENTRY,
  event_id: EVENT,
  attendee_id: ATTENDEE,
  joined_at: NOW,
  admit_at: admitAt,
  consumed_at: null,
  ...over,
});

const at = (ms: number) => new Date(NOW.getTime() + ms);
const FIND_LISTING = /from registration\.event_listings where event_id/;
const NEW_GATE = /insert into registration\.waiting_room_gates/;
const LOCK_GATE = /select next_slot_at from registration\.waiting_room_gates/;
const LATEST = /from registration\.waiting_room_entries where event_id = \? and attendee_id/;
const MOVE_GATE = /update registration\.waiting_room_gates/;
const NEW_ENTRY = /insert into registration\.waiting_room_entries/;
const COUNT_AHEAD = /select count\(\*\)::int as n/;
const BY_ID = /from registration\.waiting_room_entries where id =/;

const join = (steps: Step[], config = CONFIG) => {
  const db = scriptedDatabase(steps);
  return joinWaitingRoom(db.sql, { eventId: EVENT, attendeeId: ATTENDEE, now: NOW }, config).then((outcome) => ({ outcome, log: db.log }));
};

describe("joinWaitingRoom", () => {
  it("EN-19-T10 answers not found for an event it does not know, or one that takes no registrations", async () => {
    expect((await join([{ match: FIND_LISTING, rows: [] }])).outcome).toEqual({ ok: false, code: "EVENT_NOT_FOUND" });
    expect((await join([{ match: FIND_LISTING, rows: [listing({ status: "PLANNING" })] }])).outcome).toEqual({ ok: false, code: "EVENT_NOT_FOUND" });
  });

  it("EN-19-T10 has no queue for an event that is not high-demand, and writes nothing", async () => {
    const { outcome, log } = await join([{ match: FIND_LISTING, rows: [listing({ high_demand: false })] }]);
    expect(outcome).toMatchObject({ ok: false, code: "NOT_REQUIRED" });
    expect(log).toEqual(["select event_listings"]);
  });

  it("EN-19-T4 will not queue anyone when there is no key to sign admission tokens with", async () => {
    const { outcome } = await join([{ match: FIND_LISTING, rows: [listing()] }], { ...CONFIG, signingKey: "" });
    expect(outcome).toEqual({ ok: false, code: "UNAVAILABLE" });
  });

  it("EN-19-T10 will not queue anyone before registration opens or after it closes, naming the state", async () => {
    const early = await join([{ match: FIND_LISTING, rows: [listing({ registration_opens_at: at(1000) })] }]);
    const late = await join([{ match: FIND_LISTING, rows: [listing({ registration_closes_at: at(-1) })] }]);
    expect(early.outcome).toMatchObject({ ok: false, code: "OUTSIDE_WINDOW", state: "NOT_YET_OPEN" });
    expect(late.outcome).toMatchObject({ ok: false, code: "OUTSIDE_WINDOW", state: "CLOSED" });
  });

  it("EN-19-T7 gives a new joiner the gate's slot, moves the gate on, and reports position and wait", async () => {
    const { outcome, log } = await join([
      { match: FIND_LISTING, rows: [listing()] },
      { match: NEW_GATE, rows: [] },
      { match: LOCK_GATE, rows: [{ next_slot_at: at(3000) }] },
      { match: LATEST, rows: [] },
      { match: MOVE_GATE, rows: [] },
      { match: NEW_ENTRY, rows: [entry(at(3000))] },
      { match: COUNT_AHEAD, rows: [{ n: 2 }] },
    ]);

    expect(log).toEqual([
      "select event_listings",
      "insert waiting_room_gates",
      "select waiting_room_gates",
      "select waiting_room_entries",
      "update waiting_room_gates",
      "insert waiting_room_entries",
      "select waiting_room_entries",
    ]);
    expect(outcome).toMatchObject({ ok: true, created: true, place: { entryId: ENTRY, status: "WAITING", position: 3, estimatedWaitSeconds: 3, admissionToken: null } });
  });

  it("EN-19-T12 keeps the place of an attendee who is already waiting, taking no new slot", async () => {
    const { outcome, log } = await join([
      { match: FIND_LISTING, rows: [listing()] },
      { match: NEW_GATE, rows: [] },
      { match: LOCK_GATE, rows: [{ next_slot_at: at(9000) }] },
      { match: LATEST, rows: [entry(at(2000))] },
      { match: COUNT_AHEAD, rows: [{ n: 0 }] },
    ]);

    expect(outcome).toMatchObject({ ok: true, created: false, place: { status: "WAITING", position: 1, estimatedWaitSeconds: 2 } });
    expect(log.some((line) => line.startsWith("update"))).toBe(false);
    expect(log).not.toContain("insert waiting_room_entries");
  });

  it("EN-19-T8 gives an attendee whose turn expired, or who used it, a new place", async () => {
    for (const latest of [entry(at(-120_000)), entry(at(-1000), { consumed_at: at(-500) })]) {
      const { outcome } = await join([
        { match: FIND_LISTING, rows: [listing()] },
        { match: NEW_GATE, rows: [] },
        { match: LOCK_GATE, rows: [{ next_slot_at: at(-50_000) }] },
        { match: LATEST, rows: [latest] },
        { match: MOVE_GATE, rows: [] },
        { match: NEW_ENTRY, rows: [entry(NOW, { id: "44444444-4444-4444-8444-444444444444" })] },
      ]);
      expect(outcome).toMatchObject({ ok: true, created: true, place: { entryId: "44444444-4444-4444-8444-444444444444", status: "ADMITTED" } });
    }
  });

  it("EN-19-T5 admits with a token that names the event, the attendee and the moment it expires", async () => {
    const { outcome } = await join([
      { match: FIND_LISTING, rows: [listing()] },
      { match: NEW_GATE, rows: [] },
      { match: LOCK_GATE, rows: [{ next_slot_at: at(-10) }] },
      { match: LATEST, rows: [] },
      { match: MOVE_GATE, rows: [] },
      { match: NEW_ENTRY, rows: [entry(NOW)] },
    ]);

    expect(outcome.ok && outcome.place.status).toBe("ADMITTED");
    const place = (outcome as { place: { admissionToken: string; expiresAt: string } }).place;
    expect(place.expiresAt).toBe(at(60_000).toISOString());
    expect(verifyAdmission(place.admissionToken, CONFIG.signingKey, { eventId: EVENT, attendeeId: ATTENDEE }, NOW)).toMatchObject({
      ok: true,
      claims: { entryId: ENTRY, expiresAtMs: at(60_000).getTime() },
    });
  });
});

describe("placeById", () => {
  it("EN-19-T7 is null for an id that has no place", async () => {
    const db = scriptedDatabase([{ match: BY_ID, rows: [] }]);
    expect(await placeById(db.sql, ENTRY, NOW, CONFIG)).toBeNull();
  });

  it("EN-19-T9 shows a spent place as used, with no token", async () => {
    const db = scriptedDatabase([{ match: BY_ID, rows: [entry(at(-1000), { consumed_at: at(-500) })] }]);
    expect(await placeById(db.sql, ENTRY, NOW, CONFIG)).toMatchObject({ status: "USED", position: 0, admissionToken: null });
  });

  it("EN-19-T4 never mints a token without a key", async () => {
    const db = scriptedDatabase([{ match: BY_ID, rows: [entry(at(-1000))] }]);
    expect(await placeById(db.sql, ENTRY, NOW, { ...CONFIG, signingKey: "" })).toMatchObject({ status: "ADMITTED", admissionToken: null });
  });
});
