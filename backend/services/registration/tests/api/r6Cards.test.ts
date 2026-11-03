import { afterAll, afterEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import request from "supertest";
import { handleMessage } from "../../src/consumer/handleApproval.js";
import { handleListingMessage } from "../../src/consumer/handleListing.js";
import {
  CLOSES,
  COORDINATOR,
  DURING,
  OWNER,
  anEvent,
  appAt,
  approvalMessage,
  asAttendee,
  asCoordinator,
  asOrganiser,
  cancelledMessage,
  cleanUp,
  placesOf,
  waitlistOutboxOf,
} from "../support/fixtures.js";

/**
 * R6 — join and be invited from the waitlist, against the real registration
 * schema. One test per card in tests/R6. R4-T9 (a withdrawal tells the
 * waitlist) is proven with R6-T6.
 */

const sql = postgres(process.env.DATABASE_URL!, { max: 8, prepare: false });
const clock = { now: DURING };
const app = appAt(sql, clock);

afterEach(async () => {
  clock.now = DURING;
  await cleanUp(sql);
});
afterAll(() => sql.end());

const registerAs = (attendeeId: string, eventId: string) =>
  request(app).post("/api/v1/registrations").set(asAttendee(attendeeId)).send({ eventId });
const withdrawAs = (attendeeId: string, registrationId: string) =>
  request(app).post(`/api/v1/registrations/${registrationId}/withdrawal`).set(asAttendee(attendeeId));
const joinAs = (attendeeId: string, eventId: string) => request(app).post(`/api/v1/events/${eventId}/waitlist`).set(asAttendee(attendeeId));
const leaveAs = (attendeeId: string, entryId: string) => request(app).post(`/api/v1/waitlist-entries/${entryId}/withdrawal`).set(asAttendee(attendeeId));
const minutes = (n: number) => new Date(DURING.getTime() + n * 60_000);

async function entryRow(id: string) {
  const [row] = await sql<{ event_id: string; attendee_id: string; status: string; joined_at: Date; last_notified_at: Date | null; registration_id: string | null }[]>`
    select event_id, attendee_id, status, joined_at, last_notified_at, registration_id from registration.waitlist_entries where id = ${id}`;
  return row!;
}

const entriesOf = (eventId: string) => sql`select id from registration.waitlist_entries where event_id = ${eventId}`;
const registrationsOf = (eventId: string, attendeeId: string) =>
  sql<{ status: string }[]>`select status from registration.registrations where event_id = ${eventId} and attendee_id = ${attendeeId}`;

/** A full one-seat event: its seat held by `holder`, whose registration is returned. */
async function fullEvent() {
  const event = await anEvent(sql, { seats: 1 });
  const holder = randomUUID();
  const held = await registerAs(holder, event.eventId);
  expect(held.status).toBe(201);
  return { event, holder, held: held.body as { id: string; reference: string } };
}

/** Joins the attendee to the event's waitlist at `at`, expecting success. */
async function joined(attendeeId: string, eventId: string, at = DURING) {
  clock.now = at;
  const res = await joinAs(attendeeId, eventId);
  expect(res.status).toBe(201);
  return res.body as { id: string; reference: string; position: number };
}

describe("the waitlist (R6)", () => {
  it("R6-T1 joins the waitlist after a capacity refusal: the attendee, the event, Waitlisted and the time", async () => {
    const { event } = await fullEvent();
    const me = randomUUID();
    const refused = await registerAs(me, event.eventId);
    expect(refused.body.error).toMatchObject({ code: "REGISTRATION_FULL", details: { waitlistOffered: true } });

    const res = await joinAs(me, event.eventId);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      reference: expect.stringMatching(/^WL-\d{6}$/),
      status: "WAITLISTED",
      position: 1,
      joinedAt: DURING.toISOString(),
      lastNotifiedAt: null,
      event: { eventId: event.eventId, reference: event.reference, name: "R Test Symposium" },
    });
    expect(await entryRow(res.body.id)).toMatchObject({ event_id: event.eventId, attendee_id: me, status: "WAITLISTED", joined_at: DURING });
    expect(await registrationsOf(event.eventId, me)).toEqual([]);
    const mine = await request(app).get("/api/v1/waitlist-entries").set(asAttendee(me));
    expect(mine.body.items.map((e: { id: string }) => e.id)).toEqual([res.body.id]);
  });

  it("R6-T2 refuses to waitlist while places remain, storing nothing", async () => {
    const event = await anEvent(sql, { seats: 3 });

    const res = await joinAs(randomUUID(), event.eventId);

    expect([res.status, res.body.error.code, res.body.error.details]).toEqual([409, "WAITLIST_PLACES_AVAILABLE", { placesRemaining: 3 }]);
    expect(res.body.error.message).toContain("still has 3 places remaining");
    expect(await entriesOf(event.eventId)).toHaveLength(0);
  });

  it("R6-T3 refuses to waitlist an attendee who holds a registration, naming it", async () => {
    const { event, holder, held } = await fullEvent();

    const res = await joinAs(holder, event.eventId);

    expect([res.status, res.body.error.code, res.body.error.details.registrationReference]).toEqual([409, "REGISTRATION_DUPLICATE", held.reference]);
    expect(res.body.error.message).toContain(held.reference);
    expect(await entriesOf(event.eventId)).toHaveLength(0);
  });

  it("R6-T4 refuses a second waitlist entry, naming the first, even when two arrive at once", async () => {
    const { event } = await fullEvent();
    const me = randomUUID();
    const first = await joined(me, event.eventId);

    const again = await joinAs(me, event.eventId);
    const other = randomUUID();
    const racing = await Promise.all([joinAs(other, event.eventId), joinAs(other, event.eventId)]);

    expect([again.status, again.body.error.code, again.body.error.details.waitlistReference]).toEqual([409, "WAITLIST_DUPLICATE", first.reference]);
    expect(again.body.error.message).toBe(`You are already on the waitlist for ${event.reference} “R Test Symposium” (${first.reference}), so no second entry was made.`);
    expect(racing.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await sql`select id from registration.waitlist_entries where event_id = ${event.eventId} and attendee_id = ${me}`).toHaveLength(1);
    expect(await entriesOf(event.eventId)).toHaveLength(2);
  });

  it("R6-T5 shows the owning organiser and the assigned coordinator the waitlist in the order it was joined, and nobody else", async () => {
    const { event } = await fullEvent();
    const waiting = [randomUUID(), randomUUID(), randomUUID()];
    for (const [i, id] of waiting.entries()) await joined(id, event.eventId, minutes(i + 1));

    const organiser = await request(app).get(`/api/v1/events/${event.eventId}/waitlist`).set(asOrganiser(OWNER));
    const coordinator = await request(app).get(`/api/v1/events/${event.eventId}/waitlist`).set(asCoordinator(COORDINATOR));
    const other = await request(app).get(`/api/v1/events/${event.eventId}/waitlist`).set(asOrganiser(randomUUID()));

    expect(organiser.status).toBe(200);
    expect(organiser.body.items.map((e: { attendee: { id: string }; position: number; status: string; joinedAt: string }) => [e.attendee.id, e.position, e.status, e.joinedAt])).toEqual(
      waiting.map((id, i) => [id, i + 1, "WAITLISTED", minutes(i + 1).toISOString()]),
    );
    expect(organiser.body.waiting).toBe(3);
    expect(coordinator.body).toEqual(organiser.body);
    expect([other.status, other.body.error.code, Object.keys(other.body)]).toEqual([404, "EVENT_NOT_FOUND", ["error"]]);
  });

  it("R6-T6 tells every waitlisted attendee a place opened when someone withdraws, and registers nobody (R4-T9)", async () => {
    const { event, holder, held } = await fullEvent();
    const [first, second] = [randomUUID(), randomUUID()];
    const a = await joined(first, event.eventId, minutes(1));
    const b = await joined(second, event.eventId, minutes(2));

    clock.now = minutes(10);
    expect((await withdrawAs(holder, held.id)).status).toBe(200);

    const told = await waitlistOutboxOf(sql, event.eventId);
    expect(told.map((m) => [m.type, m.data.attendeeId, m.data.placesRemaining, m.actor])).toEqual([
      ["waitlist.place-opened", first, 1, `ATTENDEE:${holder}`],
      ["waitlist.place-opened", second, 1, `ATTENDEE:${holder}`],
    ]);
    expect(told[0]!.data).toMatchObject({ waitlistReference: a.reference, eventId: event.eventId, eventReference: event.reference, openedAt: minutes(10).toISOString() });
    for (const entry of [a, b]) expect(await entryRow(entry.id)).toMatchObject({ status: "WAITLISTED", last_notified_at: minutes(10), registration_id: null });
    expect([...(await registrationsOf(event.eventId, first)), ...(await registrationsOf(event.eventId, second))]).toEqual([]);
    expect(await placesOf(sql, event.eventId)).toBe(1);
  });

  it("R6-T7 lets whoever registers first take the open place, ending their waitlist entry, and refuses the next for capacity", async () => {
    const { event, holder, held } = await fullEvent();
    const firstInLine = randomUUID();
    const me = randomUUID();
    const theirs = await joined(firstInLine, event.eventId, minutes(1));
    const mine = await joined(me, event.eventId, minutes(2));
    clock.now = minutes(10);
    await withdrawAs(holder, held.id);

    clock.now = minutes(11);
    const registered = await registerAs(me, event.eventId);
    const holderAgain = await registerAs(holder, event.eventId);
    const firstAfter = await registerAs(firstInLine, event.eventId);

    expect(registered.status).toBe(201);
    expect(await entryRow(mine.id)).toMatchObject({ status: "REGISTERED", registration_id: registered.body.id });
    const myEntries = await request(app).get("/api/v1/waitlist-entries").set(asAttendee(me));
    expect(myEntries.body.items[0]).toMatchObject({ status: "REGISTERED", position: null, registeredAt: minutes(11).toISOString() });
    expect([holderAgain.status, holderAgain.body.error.code, holderAgain.body.error.details.waitlistOffered]).toEqual([409, "REGISTRATION_FULL", true]);
    expect(firstAfter.body.error.code).toBe("REGISTRATION_FULL");
    expect(await entryRow(theirs.id)).toMatchObject({ status: "WAITLISTED" });
  });

  it("R6-T8 leaves the waitlist: the entry is kept as Withdrawn, and a later opening does not tell them", async () => {
    const { event, holder, held } = await fullEvent();
    const me = randomUUID();
    const mine = await joined(me, event.eventId);

    clock.now = minutes(5);
    const left = await leaveAs(me, mine.id);
    const again = await leaveAs(me, mine.id);
    const notMine = await leaveAs(randomUUID(), mine.id);
    await withdrawAs(holder, held.id);

    expect(left.status).toBe(200);
    expect(left.body).toMatchObject({ id: mine.id, status: "WITHDRAWN", withdrawnAt: minutes(5).toISOString(), position: null });
    expect([again.status, again.body.error.code, again.body.error.details.status]).toEqual([409, "WAITLIST_ENTRY_NOT_ACTIVE", "WITHDRAWN"]);
    expect([notMine.status, notMine.body.error.code]).toEqual([404, "WAITLIST_ENTRY_NOT_FOUND"]);
    expect(await waitlistOutboxOf(sql, event.eventId)).toEqual([]);
    expect(await entryRow(mine.id)).toMatchObject({ status: "WITHDRAWN", last_notified_at: null });
  });

  it("R6-T9 never counts waitlist entries as registrations or places", async () => {
    const { event } = await fullEvent();
    for (const n of [1, 2, 3]) await joined(randomUUID(), event.eventId, minutes(n));

    const list = await request(app).get(`/api/v1/events/${event.eventId}/registrations`).set(asOrganiser(OWNER));
    const open = await request(app).get(`/api/v1/open-events/${event.eventId}`).set(asAttendee(randomUUID()));

    expect(list.body.totals).toMatchObject({ registered: 1, placesRemaining: 0 });
    expect(list.body.items).toHaveLength(1);
    expect(list.body.waitlist).toEqual({ waiting: 3 });
    expect(open.body).toMatchObject({ placesRemaining: 0, isFull: true });
  });

  it("R6-T10 cancels the active waitlist entries with the event and tells each attendee", async () => {
    const { event } = await fullEvent();
    const me = randomUUID();
    const leaver = randomUUID();
    const mine = await joined(me, event.eventId, minutes(1));
    const theirs = await joined(leaver, event.eventId, minutes(2));
    await leaveAs(leaver, theirs.id);

    const cancelled = await handleListingMessage(cancelledMessage(event.eventId, event.reference, "2026-12-06T02:00:00.000Z"), { sql });

    expect(cancelled.outcome).toBe("applied");
    expect(await entryRow(mine.id)).toMatchObject({ status: "CANCELLED" });
    expect(await entryRow(theirs.id)).toMatchObject({ status: "WITHDRAWN" });
    const told = await waitlistOutboxOf(sql, event.eventId);
    expect(told.map((m) => [m.type, m.data.attendeeId, m.data.cancelledAt, m.actor])).toEqual([["waitlist.cancelled", me, "2026-12-06T02:00:00.000Z", "SYSTEM"]]);
    const myEntries = await request(app).get("/api/v1/waitlist-entries").set(asAttendee(me));
    expect(myEntries.body.items[0]).toMatchObject({ status: "CANCELLED", cancelledAt: "2026-12-06T02:00:00.000Z" });
  });

  it("R6-T11 tells the waitlist when a further confirmed booking adds places", async () => {
    const { event } = await fullEvent();
    const me = randomUUID();
    await joined(me, event.eventId);

    const built = await handleMessage(approvalMessage(event.eventId, { seats: 2, venueName: "Seminar Room 2-1" }).value, { sql });

    expect(built).toMatchObject({ outcome: "built", seats: 2, told: 1 });
    const told = await waitlistOutboxOf(sql, event.eventId);
    expect(told.map((m) => [m.type, m.data.attendeeId, m.data.placesRemaining, m.actor])).toEqual([["waitlist.place-opened", me, 2, "SYSTEM"]]);
    expect(await registrationsOf(event.eventId, me)).toEqual([]);
    expect(await placesOf(sql, event.eventId)).toBe(2);
  });

  it("R6-T12 holds an invited attendee to the window: one millisecond after closing they are refused", async () => {
    const { event, holder, held } = await fullEvent();
    const me = randomUUID();
    const mine = await joined(me, event.eventId);
    await withdrawAs(holder, held.id);

    clock.now = new Date(Date.parse(CLOSES) + 1);
    const late = await registerAs(me, event.eventId);

    expect([late.status, late.body.error.code]).toEqual([422, "REGISTRATION_OUTSIDE_WINDOW"]);
    expect(late.body.error.message).toContain("closed on Thursday 10 December 2026, 18:00");
    expect(await entryRow(mine.id)).toMatchObject({ status: "WAITLISTED", registration_id: null });

    clock.now = new Date(CLOSES);
    const atClosing = await registerAs(me, event.eventId);
    expect(atClosing.status).toBe(201);
    expect(await entryRow(mine.id)).toMatchObject({ status: "REGISTERED" });
  });

  it("refuses to waitlist for an event that takes no registrations, or whose window has closed", async () => {
    const planning = await anEvent(sql, { seats: 1, status: "PLANNING" });
    const { event } = await fullEvent();

    const notListed = await joinAs(randomUUID(), planning.eventId);
    clock.now = new Date(Date.parse(CLOSES) + 1);
    const closed = await joinAs(randomUUID(), event.eventId);
    const unknown = await joinAs(randomUUID(), randomUUID());

    expect([notListed.status, notListed.body.error.code]).toEqual([404, "EVENT_NOT_FOUND"]);
    expect([closed.status, closed.body.error.code]).toEqual([422, "REGISTRATION_OUTSIDE_WINDOW"]);
    expect([unknown.status, unknown.body.error.code]).toEqual([404, "EVENT_NOT_FOUND"]);
  });

  it("never leaves an attendee both registered and waiting when they join and register at once", async () => {
    const { event, holder, held } = await fullEvent();
    await withdrawAs(holder, held.id);
    const me = randomUUID();

    await Promise.all([joinAs(me, event.eventId), registerAs(me, event.eventId)]);

    const [registered] = await sql<{ n: number }[]>`
      select count(*)::int as n from registration.registrations where event_id = ${event.eventId} and attendee_id = ${me} and status = 'REGISTERED'`;
    const [waiting] = await sql<{ n: number }[]>`
      select count(*)::int as n from registration.waitlist_entries where event_id = ${event.eventId} and attendee_id = ${me} and status = 'WAITLISTED'`;
    expect(registered!.n + waiting!.n).toBe(1);
  });
});
