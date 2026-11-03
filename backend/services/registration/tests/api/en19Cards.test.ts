import { afterAll, afterEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import request from "supertest";
import { signAdmission } from "../../src/domain/admissionToken.js";
import { slotIntervalMs } from "../../src/domain/waitingRoom.js";
import { joinWaitingRoom, type PlaceView } from "../../src/service/waitingRoom.js";
import { DURING, ROOM, anEvent, appAt, asAttendee, cleanUp, outboxOf, placesOf } from "../support/fixtures.js";

/**
 * EN-19 — the virtual waiting room, against the real registration schema. One
 * test per card in tests/EN-19 that needs the database; the pure rules are
 * in tests/domain/waitingRoom.test.ts and admissionToken.test.ts.
 */

const sql = postgres(process.env.DATABASE_URL!, { max: 50, prepare: false });
const clock = { now: DURING };
const app = appAt(sql, clock);

afterEach(async () => {
  clock.now = DURING;
  await cleanUp(sql);
});
afterAll(() => sql.end());

const join = (attendeeId: string, eventId: string, to = app) =>
  request(to).post("/api/v1/waiting-room/entries").set(asAttendee(attendeeId)).send({ eventId });
const place = (attendeeId: string, entryId: string, to = app) =>
  request(to).get(`/api/v1/waiting-room/entries/${entryId}`).set(asAttendee(attendeeId));
const registerAs = (attendeeId: string, eventId: string, token?: string | null, to = app) => {
  const req = request(to).post("/api/v1/registrations").set(asAttendee(attendeeId));
  if (token !== undefined && token !== null) req.set("X-Admission-Token", token);
  return req.send({ eventId });
};

/** Joins, lets the clock reach the attendee's slot (and stay there), and returns the admitted place. */
async function admitted(attendeeId: string, eventId: string, to = app): Promise<PlaceView> {
  const joined = await join(attendeeId, eventId, to);
  expect(joined.status).toBe(201);
  clock.now = new Date(Math.max(clock.now.getTime(), Date.parse(joined.body.admitAt)));
  const polled = await place(attendeeId, joined.body.entryId, to);
  expect(polled.body.status).toBe("ADMITTED");
  return polled.body as PlaceView;
}

async function registrationsOf(eventId: string) {
  return sql<{ attendee_id: string; status: string }[]>`select attendee_id, status from registration.registrations where event_id = ${eventId}`;
}

async function entriesOf(eventId: string) {
  return sql<{ id: string; attendee_id: string; admit_at: Date; consumed_at: Date | null }[]>`
    select id, attendee_id, admit_at, consumed_at from registration.waiting_room_entries where event_id = ${eventId} order by seq`;
}

/** What a refusal must leave as it was: no registration, no message, the same places. */
async function nothingChanged(eventId: string, places: number) {
  expect(await registrationsOf(eventId)).toHaveLength(0);
  expect(await placesOf(sql, eventId)).toBe(places);
  expect(await outboxOf(sql, eventId)).toHaveLength(0);
}

describe("registering for a high-demand event (EN-19)", () => {
  it("EN-19-T4 refuses a register without an admission token for a high-demand event, storing nothing", async () => {
    const event = await anEvent(sql, { seats: 3, highDemand: true });
    const me = randomUUID();

    for (const token of [undefined, ""]) {
      const res = await registerAs(me, event.eventId, token);

      expect(res.status).toBe(403);
      expect(res.body.error).toMatchObject({
        code: "ADMISSION_REQUIRED",
        message: expect.stringContaining("waiting room"),
        details: { eventId: event.eventId, waitingRoom: true },
      });
      expect(res.body.error.message).toContain(event.reference);
      await nothingChanged(event.eventId, 3);
    }
  });

  it("EN-19-T4 (no signing key) refuses a flagged event and its waiting room with WAITING_ROOM_UNAVAILABLE rather than take registrations unchecked", async () => {
    const event = await anEvent(sql, { seats: 3, highDemand: true });
    const keyless = appAt(sql, clock, { ...ROOM, signingKey: "" });

    const registering = await registerAs(randomUUID(), event.eventId, "anything", keyless);
    const joining = await join(randomUUID(), event.eventId, keyless);

    expect(registering.status).toBe(503);
    expect(registering.body.error.code).toBe("WAITING_ROOM_UNAVAILABLE");
    expect(joining.status).toBe(503);
    expect(joining.body.error.code).toBe("WAITING_ROOM_UNAVAILABLE");
    await nothingChanged(event.eventId, 3);
    expect(await entriesOf(event.eventId)).toEqual([]);
  });

  it("EN-19-T5 refuses a forged, altered, wrong-event or borrowed token and accepts the attendee's own", async () => {
    const [a, b] = [await anEvent(sql, { seats: 3, highDemand: true }), await anEvent(sql, { seats: 3, highDemand: true })];
    const [x, y] = [randomUUID(), randomUUID()];
    const token = (await admitted(x, a.eventId)).admissionToken!;
    expect(token).toMatch(/^v1\./);
    const [prefix, payload, signature] = token.split(".") as [string, string, string];
    const toY = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(payload, "base64url").toString("utf8")), att: y })).toString("base64url");
    const flipped = signature.startsWith("A") ? `B${signature.slice(1)}` : `A${signature.slice(1)}`;
    const entryId = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")).ent as string;
    const foreign = signAdmission({ entryId, eventId: a.eventId, attendeeId: x, expiresAtMs: DURING.getTime() + 60_000 }, "another-key-that-is-long-enough-123456");

    const attempts: Array<[string, string, string]> = [
      ["another attendee's", y, token],
      ["another event's", x, token],
      ["a changed signature", x, `${prefix}.${payload}.${flipped}`],
      ["a payload altered to name Y", y, `${prefix}.${toY}.${signature}`],
      ["a token signed with another key", x, foreign],
      ["a string that is not a token", x, "not-a-token"],
    ];
    for (const [what, who, presented] of attempts) {
      const eventId = what === "another event's" ? b.eventId : a.eventId;
      const res = await registerAs(who, eventId, presented);
      expect(res.status, what).toBe(403);
      expect(res.body.error.code, what).toBe("ADMISSION_REQUIRED");
    }
    await nothingChanged(a.eventId, 3);
    await nothingChanged(b.eventId, 3);

    const own = await registerAs(x, a.eventId, token);
    expect(own.status).toBe(201);
    expect(await placesOf(sql, a.eventId)).toBe(2);
  });

  it("EN-19-T8 accepts a token until it expires, then refuses it with ADMISSION_EXPIRED and lets the attendee join again", async () => {
    const event = await anEvent(sql, { seats: 5, highDemand: true });
    const [early, onTime, late] = [randomUUID(), randomUUID(), randomUUID()];
    const places = [await admitted(early, event.eventId), await admitted(onTime, event.eventId), await admitted(late, event.eventId)];

    const [first, second, third] = places as [PlaceView, PlaceView, PlaceView];
    clock.now = new Date(Date.parse(first.expiresAt) - 1);
    const justInTime = await registerAs(early, event.eventId, first.admissionToken);
    expect(justInTime.status).toBe(201);

    clock.now = new Date(Date.parse(second.expiresAt));
    const atExpiry = await registerAs(onTime, event.eventId, second.admissionToken);
    expect(atExpiry.status).toBe(403);
    expect(atExpiry.body.error).toMatchObject({ code: "ADMISSION_EXPIRED", message: expect.stringContaining("Join the waiting room again") });

    clock.now = new Date(Date.parse(third.expiresAt) + 1000);
    const after = await registerAs(late, event.eventId, third.admissionToken);
    expect(after.status).toBe(403);
    expect(after.body.error.code).toBe("ADMISSION_EXPIRED");
    expect((await registrationsOf(event.eventId)).map((r) => r.attendee_id)).toEqual([early]);
    expect(await placesOf(sql, event.eventId)).toBe(4);

    const polled = await place(late, third.entryId);
    expect(polled.body).toMatchObject({ status: "EXPIRED", position: 0, estimatedWaitSeconds: 0, admissionToken: null });

    const again = await join(late, event.eventId);
    expect(again.status).toBe(201);
    expect(again.body.entryId).not.toBe(third.entryId);
    expect(Date.parse(again.body.admitAt)).toBeGreaterThanOrEqual(clock.now.getTime());
    expect((await entriesOf(event.eventId)).filter((e) => e.attendee_id === late)).toHaveLength(2);
  });

  it("EN-19-T9 spends a token on the registration it admits, and not on a refusal", async () => {
    const event = await anEvent(sql, { seats: 1, highDemand: true });
    const [first, second] = [randomUUID(), randomUUID()];
    const firstPlace = await admitted(first, event.eventId);
    const secondPlace = await admitted(second, event.eventId);

    const registered = await registerAs(first, event.eventId, firstPlace.admissionToken);
    expect(registered.status).toBe(201);

    // The event is full: the second attendee's token is not used up by the refusal.
    const full = await registerAs(second, event.eventId, secondPlace.admissionToken);
    expect(full.status).toBe(409);
    expect(full.body.error.code).toBe("REGISTRATION_FULL");
    expect((await place(second, secondPlace.entryId)).body).toMatchObject({ status: "ADMITTED", admissionToken: secondPlace.admissionToken });

    // The first attendee's token is spent, even after they withdraw.
    expect((await place(first, firstPlace.entryId)).body).toMatchObject({ status: "USED", position: 0, admissionToken: null });
    const withdrawn = await request(app).post(`/api/v1/registrations/${registered.body.id}/withdrawal`).set(asAttendee(first));
    expect(withdrawn.status).toBe(200);
    const reused = await registerAs(first, event.eventId, firstPlace.admissionToken);
    expect(reused.status).toBe(403);
    expect(reused.body.error.code).toBe("ADMISSION_REQUIRED");
    expect((await registrationsOf(event.eventId)).filter((r) => r.status === "REGISTERED")).toEqual([]);

    // The seat is free again and the second attendee's unspent token takes it.
    const taken = await registerAs(second, event.eventId, secondPlace.admissionToken);
    expect(taken.status).toBe(201);
    expect((await entriesOf(event.eventId)).map((e) => e.consumed_at !== null)).toEqual([true, true]);
  });

  it("EN-19-T10 needs no token for an unflagged event and queues nobody for it", async () => {
    const plain = await anEvent(sql, { seats: 3 });
    const flagged = await anEvent(sql, { seats: 3, highDemand: true, opensAt: "2026-12-08T01:00:00.000Z" });
    const me = randomUUID();

    expect((await registerAs(me, plain.eventId)).status).toBe(201);

    const notNeeded = await join(randomUUID(), plain.eventId);
    expect(notNeeded.status).toBe(409);
    expect(notNeeded.body.error).toMatchObject({ code: "WAITING_ROOM_NOT_REQUIRED", message: expect.stringContaining("not a high-demand event") });

    const unknown = await join(randomUUID(), randomUUID());
    expect(unknown.status).toBe(404);
    expect(unknown.body.error.code).toBe("EVENT_NOT_FOUND");

    const early = await join(randomUUID(), flagged.eventId);
    expect(early.status).toBe(422);
    expect(early.body.error.code).toBe("REGISTRATION_OUTSIDE_WINDOW");

    const noEvent = await join(randomUUID(), "not-an-id");
    expect(noEvent.status).toBe(400);
    expect(noEvent.body.error.fields).toEqual([{ field: "eventId", message: expect.any(String) }]);

    for (const eventId of [plain.eventId, flagged.eventId]) expect(await entriesOf(eventId)).toEqual([]);
  });
});

describe("the waiting room (EN-19)", () => {
  it("EN-19-T6 admits at most N per second per event when 500 attendees join at once", async () => {
    const [busy, quiet] = [await anEvent(sql, { seats: 3, highDemand: true }), await anEvent(sql, { seats: 3, highDemand: true })];
    const room = { ...ROOM, admitPerSecond: 50 };

    const joined = await Promise.all(Array.from({ length: 500 }, () => joinWaitingRoom(sql, { eventId: busy.eventId, attendeeId: randomUUID(), now: DURING }, room)));
    const beside = await joinWaitingRoom(sql, { eventId: quiet.eventId, attendeeId: randomUUID(), now: DURING }, room);

    expect(joined.every((j) => j.ok && j.created)).toBe(true);
    const slots = (await entriesOf(busy.eventId)).map((e) => e.admit_at.getTime()).sort((p, q) => p - q);
    expect(slots).toHaveLength(500);
    const interval = slotIntervalMs(50);
    expect(interval).toBe(20);
    for (let i = 1; i < slots.length; i++) expect(slots[i]! - slots[i - 1]!).toBeGreaterThanOrEqual(interval);
    const busiestSecond = Math.max(...slots.map((start) => slots.filter((s) => s >= start && s < start + 1000).length));
    expect(busiestSecond).toBeLessThanOrEqual(50);
    expect(slots[0]).toBe(DURING.getTime());
    expect(slots.at(-1)! - slots[0]!).toBe(499 * interval);
    // Another event has a queue of its own.
    expect(beside.ok && beside.place.status).toBe("ADMITTED");
    expect(beside.ok && Date.parse(beside.place.admitAt)).toBe(DURING.getTime());
  }, 60_000);

  it("EN-19-T7 reports position and estimated wait, falling as time passes", async () => {
    const event = await anEvent(sql, { seats: 3, highDemand: true });
    const slow = { ...ROOM, admitPerSecond: 1 };
    const slowApp = appAt(sql, clock, slow);
    const people = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
    const ids: string[] = [];
    for (const person of people) {
      const joined = await join(person, event.eventId, slowApp);
      expect(joined.status).toBe(201);
      ids.push(joined.body.entryId);
    }
    const view = async (i: number) => (await place(people[i]!, ids[i]!, slowApp)).body as PlaceView;
    const summary = async () => Promise.all(people.map(async (_p, i) => {
      const v = await view(i);
      return [v.status, v.position, v.estimatedWaitSeconds, v.admissionToken !== null] as const;
    }));

    expect(await summary()).toEqual([
      ["ADMITTED", 0, 0, true],
      ["WAITING", 1, 1, false],
      ["WAITING", 2, 2, false],
      ["WAITING", 3, 3, false],
    ]);

    clock.now = new Date(DURING.getTime() + 2000);
    expect(await summary()).toEqual([
      ["ADMITTED", 0, 0, true],
      ["ADMITTED", 0, 0, true],
      ["ADMITTED", 0, 0, true],
      ["WAITING", 1, 1, false],
    ]);

    clock.now = new Date(DURING.getTime() + 10_000);
    expect((await summary()).map((row) => row[0])).toEqual(["ADMITTED", "ADMITTED", "ADMITTED", "ADMITTED"]);

    const unknown = await place(people[0]!, randomUUID(), slowApp);
    expect(unknown.status).toBe(404);
    expect(unknown.body.error.code).toBe("WAITING_ROOM_ENTRY_NOT_FOUND");
    expect((await place(people[0]!, "not-an-id", slowApp)).status).toBe(404);
  });

  it("EN-19-T12 keeps one place for an attendee who joins repeatedly or concurrently", async () => {
    const event = await anEvent(sql, { seats: 3, highDemand: true });
    const [steady, eager] = [randomUUID(), randomUUID()];
    const slowApp = appAt(sql, clock, { ...ROOM, admitPerSecond: 1 });
    await join(randomUUID(), event.eventId, slowApp); // someone ahead, so the place is a waiting one

    const first = await join(steady, event.eventId, slowApp);
    const second = await join(steady, event.eventId, slowApp);
    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body.entryId).toBe(first.body.entryId);
    expect(second.body).toMatchObject({ position: first.body.position, status: "WAITING" });

    const many = await Promise.all(Array.from({ length: 20 }, () => join(eager, event.eventId, slowApp)));
    expect(many.filter((r) => r.status === 201)).toHaveLength(1);
    expect(many.filter((r) => r.status === 200)).toHaveLength(19);
    expect(new Set(many.map((r) => r.body.entryId)).size).toBe(1);
    expect((await entriesOf(event.eventId)).filter((e) => e.attendee_id === eager)).toHaveLength(1);
  });
});
