import { afterAll, afterEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import request from "supertest";
import { handleListingMessage } from "../../src/consumer/handleListing.js";
import {
  ATTENDEE_ONE,
  COORDINATOR,
  DURING,
  OWNER,
  anEvent,
  appAt,
  asAttendee,
  asCoordinator,
  asOrganiser,
  cancelledMessage,
  cleanUp,
  directoryPeople,
  outboxOf,
  placesOf,
} from "../support/fixtures.js";

/**
 * R7 — add an attendee manually (POST /api/v1/events/:eventId/manual-registrations),
 * against the real registration schema. One test per card in tests/R7. R2-T13
 * (D-01: places remaining stays at zero above capacity, and registration is
 * refused until withdrawals bring the total below capacity) is proven with R7-T12.
 */

const sql = postgres(process.env.DATABASE_URL!, { max: 10, prepare: false });
const clock = { now: DURING };
const app = appAt(sql, clock);

afterEach(async () => {
  clock.now = DURING;
  directoryPeople.attendees.clear();
  await cleanUp(sql);
});
afterAll(() => sql.end());

const ATTENDEE_EMAIL = "attendee@connectsphere.test";
const registerAs = (attendeeId: string, eventId: string) =>
  request(app).post("/api/v1/registrations").set(asAttendee(attendeeId)).send({ eventId });
const withdrawAs = (attendeeId: string, registrationId: string) =>
  request(app).post(`/api/v1/registrations/${registrationId}/withdrawal`).set(asAttendee(attendeeId));
const addAs = (headers: Record<string, string>, eventId: string, body: Record<string, unknown> = { attendeeEmail: ATTENDEE_EMAIL }) =>
  request(app).post(`/api/v1/events/${eventId}/manual-registrations`).set(headers).send(body);
const listOf = (eventId: string) => request(app).get(`/api/v1/events/${eventId}/registrations`).set(asOrganiser(OWNER));
const openEvent = (eventId: string) => request(app).get(`/api/v1/open-events/${eventId}`).set(asAttendee(randomUUID()));
const minutes = (n: number) => new Date(DURING.getTime() + n * 60_000);

async function storedFor(eventId: string, attendeeId: string) {
  return sql<{ status: string; added_by: string | null; addition_reason: string | null; added_over_capacity: boolean; seat_id: string | null; registered_at: Date }[]>`
    select status, added_by, addition_reason, added_over_capacity, seat_id, registered_at
    from registration.registrations where event_id = ${eventId} and attendee_id = ${attendeeId}`;
}

/** `n` self-registrations for the event, each by a new attendee; their ids and registrations. */
async function taken(eventId: string, n: number) {
  const done: Array<{ attendeeId: string; id: string; reference: string }> = [];
  for (let i = 0; i < n; i += 1) {
    const attendeeId = randomUUID();
    const res = await registerAs(attendeeId, eventId);
    expect(res.status).toBe(201);
    done.push({ attendeeId, id: res.body.id, reference: res.body.reference });
  }
  return done;
}

/** An attendee the fake directory finds by this email, with a fresh id. */
function anAttendee(label: string) {
  const id = randomUUID();
  const email = `attendee+${label}@connectsphere.test`;
  directoryPeople.attendees.set(email, id);
  return { id, email };
}

/** The invariant R7 keeps: no free seat while an active registration holds none, and each held seat is one active registration's. */
async function invariantHolds(eventId: string) {
  const [state] = await sql<{ free: number; unseated: number; registered: number; claimed: number; mismatched: number }[]>`
    select
      (select count(*)::int from registration.seats where event_id = ${eventId} and status = 'FREE') as free,
      (select count(*)::int from registration.registrations where event_id = ${eventId} and status = 'REGISTERED' and seat_id is null) as unseated,
      (select count(*)::int from registration.registrations where event_id = ${eventId} and status = 'REGISTERED') as registered,
      (select count(*)::int from registration.seats where event_id = ${eventId} and status = 'CLAIMED') as claimed,
      (select count(*)::int from registration.seats s
        where s.event_id = ${eventId} and s.status = 'CLAIMED' and not exists (
          select 1 from registration.registrations r where r.seat_id = s.id and r.status = 'REGISTERED' and r.attendee_id = s.claimed_by)) as mismatched
  `;
  return state!;
}

describe("POST /api/v1/events/:eventId/manual-registrations (R7)", () => {
  it("R7-T1 adds an attendee for the owning organiser: Registered, manual, who, when and why, and the attendee is told", async () => {
    const event = await anEvent(sql, { seats: 3 });
    clock.now = minutes(5);

    const res = await addAs(asOrganiser(OWNER), event.eventId, { attendeeEmail: ATTENDEE_EMAIL, reason: "Keynote speaker's guest" });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      reference: expect.stringMatching(/^REG-\d{6}$/),
      attendee: { id: ATTENDEE_ONE, name: "Attendee One", email: ATTENDEE_EMAIL },
      status: "REGISTERED",
      registeredAt: minutes(5).toISOString(),
      manualAddition: { addedBy: { id: OWNER, name: "Organiser One" }, reason: "Keynote speaker's guest", overCapacity: false },
      holdsSeat: true,
      capacity: 3,
      totalAfter: 1,
    });
    expect(await storedFor(event.eventId, ATTENDEE_ONE)).toEqual([
      expect.objectContaining({ status: "REGISTERED", added_by: OWNER, addition_reason: "Keynote speaker's guest", added_over_capacity: false, registered_at: minutes(5) }),
    ]);
    const [told] = await outboxOf(sql, event.eventId);
    expect(told).toMatchObject({ type: "registration.added", key: res.body.id, actor: `EVENT_ORGANISER:${OWNER}` });
    expect(told!.data).toMatchObject({ attendeeId: ATTENDEE_ONE, addedBy: OWNER, addedByName: "Organiser One", addedOverCapacity: false, eventReference: event.reference });
    expect(told!.data).not.toHaveProperty("reason");
    expect(await placesOf(sql, event.eventId)).toBe(2);
    const mine = await request(app).get("/api/v1/registrations").set(asAttendee(ATTENDEE_ONE));
    expect(mine.body.items.map((r: { id: string; status: string }) => [r.id, r.status])).toEqual([[res.body.id, "REGISTERED"]]);
  });

  it("R7-T2 adds an attendee for the assigned coordinator, with no reason", async () => {
    const event = await anEvent(sql, { seats: 3 });

    const res = await addAs(asCoordinator(COORDINATOR), event.eventId, { attendeeEmail: ATTENDEE_EMAIL, reason: "" });

    expect(res.status).toBe(201);
    expect(res.body.manualAddition).toEqual({ addedBy: { id: COORDINATOR, name: "Coordinator One", email: "coordinator@connectsphere.test" }, reason: null, overCapacity: false });
    expect(await storedFor(event.eventId, ATTENDEE_ONE)).toEqual([expect.objectContaining({ added_by: COORDINATOR, addition_reason: null })]);
  });

  it("R7-T3 lets nobody else add an attendee, storing nothing", async () => {
    const event = await anEvent(sql, { seats: 3 });

    const otherOrganiser = await addAs(asOrganiser(randomUUID()), event.eventId);
    const otherCoordinator = await addAs(asCoordinator(randomUUID()), event.eventId);
    const attendee = await addAs(asAttendee(ATTENDEE_ONE), event.eventId);

    for (const res of [otherOrganiser, otherCoordinator]) expect([res.status, res.body.error.code]).toEqual([404, "EVENT_NOT_FOUND"]);
    expect([attendee.status, attendee.body.error.code]).toEqual([403, "ROLE_NOT_AUTHORISED"]);
    expect(await sql`select id from registration.registrations where event_id = ${event.eventId}`).toHaveLength(0);
  });

  it("R7-T4 adds an attendee after registration closed, taking a place", async () => {
    const event = await anEvent(sql, { seats: 3, opensAt: "2026-11-20T01:00:00.000Z", closesAt: "2026-11-28T10:00:00.000Z" });
    expect((await registerAs(randomUUID(), event.eventId)).body.error.code).toBe("REGISTRATION_OUTSIDE_WINDOW");

    const res = await addAs(asOrganiser(OWNER), event.eventId);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ status: "REGISTERED", manualAddition: { overCapacity: false }, holdsSeat: true });
    expect(await placesOf(sql, event.eventId)).toBe(2);
  });

  it("R7-T5 adds over capacity once confirmed, showing the capacity and the new total, and records it", async () => {
    const event = await anEvent(sql, { seats: 2 });
    await taken(event.eventId, 2);

    const res = await addAs(asOrganiser(OWNER), event.eventId, { attendeeEmail: ATTENDEE_EMAIL, confirmOverCapacity: true });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ capacity: 2, totalAfter: 3, manualAddition: { overCapacity: true }, holdsSeat: false });
    expect(await storedFor(event.eventId, ATTENDEE_ONE)).toEqual([expect.objectContaining({ added_over_capacity: true, seat_id: null })]);
    expect((await listOf(event.eventId)).body.totals).toMatchObject({ registered: 3, placesRemaining: 0, addedOverCapacity: 1, overCapacityBy: 1, capacity: 2 });
    expect((await openEvent(event.eventId)).body).toMatchObject({ placesRemaining: 0, isFull: true });
  });

  it("R7-T6 saves nothing over capacity until it is confirmed, naming the capacity and the new total", async () => {
    const event = await anEvent(sql, { seats: 2 });
    await taken(event.eventId, 2);

    const res = await addAs(asOrganiser(OWNER), event.eventId, { attendeeEmail: ATTENDEE_EMAIL });

    expect([res.status, res.body.error.code, res.body.error.details]).toEqual([409, "REGISTRATION_OVER_CAPACITY_UNCONFIRMED", { capacity: 2, registered: 2, totalAfter: 3 }]);
    expect(res.body.error.message).toContain("has a capacity of 2. Adding this attendee makes 3");
    expect(await storedFor(event.eventId, ATTENDEE_ONE)).toEqual([]);
    expect((await outboxOf(sql, event.eventId)).filter((m) => m.type === "registration.added")).toEqual([]);
  });

  it("R7-T7 takes the total of every confirmed venue as the capacity", async () => {
    const event = await anEvent(sql, {
      venues: [
        { seats: 2, venueName: "Lee Kong Chian Auditorium", venueLocation: "School of Computing, Level 1" },
        { seats: 3, venueName: "Seminar Room 2-1", venueLocation: "School of Computing, Level 2" },
      ],
    });
    await taken(event.eventId, 4);

    const res = await addAs(asOrganiser(OWNER), event.eventId);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ capacity: 5, totalAfter: 5, manualAddition: { overCapacity: false }, holdsSeat: true });
    expect(await placesOf(sql, event.eventId)).toBe(0);
  });

  it("R7-T8 refuses an addition while the event has no confirmed venue booking", async () => {
    const event = await anEvent(sql, { venues: [] });

    const res = await addAs(asOrganiser(OWNER), event.eventId);

    expect([res.status, res.body.error.code]).toEqual([422, "REGISTRATION_NO_CONFIRMED_BOOKING"]);
    expect(res.body.error.message).toContain("has no confirmed venue booking, so its capacity is not known yet");
    expect(await sql`select id from registration.registrations where event_id = ${event.eventId}`).toHaveLength(0);
  });

  it("R7-T9 lists a manual addition apart from self-registrations, counted in the totals and places remaining", async () => {
    const event = await anEvent(sql, { seats: 3 });
    const [self] = await taken(event.eventId, 1);
    clock.now = minutes(1);
    await addAs(asOrganiser(OWNER), event.eventId, { attendeeEmail: ATTENDEE_EMAIL, reason: "Guest of honour" });

    const list = await listOf(event.eventId);

    expect(list.body.items.map((r: { attendee: { id: string }; manualAddition: unknown }) => [r.attendee.id, r.manualAddition])).toEqual([
      [self!.attendeeId, null],
      [ATTENDEE_ONE, { addedBy: { id: OWNER, name: "Organiser One", email: "organiser@connectsphere.test" }, reason: "Guest of honour", overCapacity: false }],
    ]);
    expect(list.body.totals).toMatchObject({ registered: 2, manuallyAdded: 1, placesRemaining: 1 });
    expect((await openEvent(event.eventId)).body.placesRemaining).toBe(1);
  });

  it("R7-T10 refuses a duplicate addition, naming the existing registration", async () => {
    const event = await anEvent(sql, { seats: 3 });
    const own = await registerAs(ATTENDEE_ONE, event.eventId);

    const res = await addAs(asOrganiser(OWNER), event.eventId);

    expect([res.status, res.body.error.code, res.body.error.details.registrationReference]).toEqual([409, "REGISTRATION_DUPLICATE", own.body.reference]);
    expect(res.body.error.message).toBe(
      `attendee@connectsphere.test already holds registration ${own.body.reference} for ${event.reference} “R Test Symposium”, so they were not added again.`,
    );
    expect(await storedFor(event.eventId, ATTENDEE_ONE)).toHaveLength(1);
  });

  it("R7-T11 lets the added attendee withdraw under R4's terms, deadline included", async () => {
    const event = await anEvent(sql, { seats: 3 });
    const added = await addAs(asOrganiser(OWNER), event.eventId);
    const late = await anEvent(sql, { seats: 3, deadline: "2026-12-04T10:00:00.000Z" });
    const lateAdded = await addAs(asOrganiser(OWNER), late.eventId);

    const withdrawn = await withdrawAs(ATTENDEE_ONE, added.body.id);
    const refused = await withdrawAs(ATTENDEE_ONE, lateAdded.body.id);

    expect([withdrawn.status, withdrawn.body.status]).toEqual([200, "WITHDRAWN"]);
    expect(await placesOf(sql, event.eventId)).toBe(3);
    expect([refused.status, refused.body.error.code]).toEqual([422, "WITHDRAWAL_DEADLINE_PASSED"]);
    expect(await placesOf(sql, late.eventId)).toBe(2);
  });

  it("R7-T12 gives a freed seat to an addition over capacity first (R2-T13)", async () => {
    const event = await anEvent(sql, { seats: 2 });
    const [a, b] = await taken(event.eventId, 2);
    const over = await addAs(asOrganiser(OWNER), event.eventId, { attendeeEmail: ATTENDEE_EMAIL, confirmOverCapacity: true });
    const newcomer = randomUUID();

    expect((await openEvent(event.eventId)).body).toMatchObject({ placesRemaining: 0, isFull: true });
    expect((await registerAs(newcomer, event.eventId)).body.error.code).toBe("REGISTRATION_FULL");

    await withdrawAs(a!.attendeeId, a!.id);
    const afterOne = await listOf(event.eventId);
    const stillFull = await registerAs(newcomer, event.eventId);

    expect(afterOne.body.items.find((r: { id: string }) => r.id === over.body.id)).toMatchObject({ holdsSeat: true, manualAddition: { overCapacity: true } });
    expect(afterOne.body.totals).toMatchObject({ registered: 2, withdrawn: 1, placesRemaining: 0 });
    expect(stillFull.body.error.code).toBe("REGISTRATION_FULL");
    expect(await invariantHolds(event.eventId)).toMatchObject({ free: 0, unseated: 0, mismatched: 0 });

    await withdrawAs(b!.attendeeId, b!.id);
    expect((await openEvent(event.eventId)).body).toMatchObject({ placesRemaining: 1, isFull: false });
    expect((await registerAs(newcomer, event.eventId)).status).toBe(201);
  });

  it("R7-T12 gives a freed seat to an addition over capacity first, under concurrent withdrawals, additions and registrations", async () => {
    const event = await anEvent(sql, { seats: 6 });
    const seated = await taken(event.eventId, 6);
    const early = [anAttendee("early-1"), anAttendee("early-2")];
    for (const person of early) {
      expect((await addAs(asOrganiser(OWNER), event.eventId, { attendeeEmail: person.email, confirmOverCapacity: true })).status).toBe(201);
    }
    const late = [anAttendee("late-1"), anAttendee("late-2"), anAttendee("late-3")];
    const newcomers = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];

    const results = await Promise.all([
      ...seated.slice(0, 4).map((s) => withdrawAs(s.attendeeId, s.id)),
      ...late.map((person) => addAs(asCoordinator(COORDINATOR), event.eventId, { attendeeEmail: person.email, confirmOverCapacity: true })),
      ...newcomers.map((id) => registerAs(id, event.eventId)),
    ]);

    expect(results.slice(0, 4).map((r) => r.status)).toEqual([200, 200, 200, 200]);
    expect(results.slice(4, 7).map((r) => r.status)).toEqual([201, 201, 201]);
    const state = await invariantHolds(event.eventId);
    expect(state.mismatched).toBe(0);
    expect(state.free === 0 || state.unseated === 0).toBe(true);
    expect(state.claimed).toBe(6 - state.free);
    expect(state.registered).toBe(state.claimed + state.unseated);
    const list = await listOf(event.eventId);
    expect(list.body.totals.placesRemaining).toBe(state.free);
    expect(list.body.totals.placesRemaining).toBeGreaterThanOrEqual(0);
  });

  it("R7-T13 refuses an email with no attendee account and a reason over 500 characters, and keeps one of 500", async () => {
    const event = await anEvent(sql, { seats: 3 });

    const nobody = await addAs(asOrganiser(OWNER), event.eventId, { attendeeEmail: "nobody@connectsphere.test" });
    const staff = await addAs(asOrganiser(OWNER), event.eventId, { attendeeEmail: "organiser2@connectsphere.test" });
    const tooLong = await addAs(asOrganiser(OWNER), event.eventId, { attendeeEmail: ATTENDEE_EMAIL, reason: "r".repeat(501) });
    const longest = await addAs(asOrganiser(OWNER), event.eventId, { attendeeEmail: ATTENDEE_EMAIL, reason: "r".repeat(500) });

    for (const res of [nobody, staff]) expect([res.status, res.body.error.code, res.body.error.fields[0].field]).toEqual([422, "ATTENDEE_NOT_FOUND", "attendeeEmail"]);
    expect(nobody.body.error.message).toContain("No attendee account has the email nobody@connectsphere.test");
    expect([tooLong.status, tooLong.body.error.code, tooLong.body.error.fields]).toEqual([400, "VALIDATION_FAILED", [{ field: "reason", message: "Keep the reason to 500 characters." }]]);
    expect(longest.status).toBe(201);
    expect((await storedFor(event.eventId, ATTENDEE_ONE))[0]!.addition_reason).toHaveLength(500);
  });

  it("refuses a cancelled event, answers 503 when identity can't be asked, and ends a waiting entry when the attendee is added", async () => {
    const cancelled = await anEvent(sql, { seats: 1 });
    await handleListingMessage(cancelledMessage(cancelled.eventId, cancelled.reference), { sql });
    const closed = await addAs(asOrganiser(OWNER), cancelled.eventId);
    const event = await anEvent(sql, { seats: 1 });
    await taken(event.eventId, 1);
    const down = await addAs(asOrganiser(OWNER), event.eventId, { attendeeEmail: "down@connectsphere.test" });
    const waiting = await request(app).post(`/api/v1/events/${event.eventId}/waitlist`).set(asAttendee(ATTENDEE_ONE));

    const added = await addAs(asOrganiser(OWNER), event.eventId, { attendeeEmail: ATTENDEE_EMAIL, confirmOverCapacity: true });

    expect([closed.status, closed.body.error.code, closed.body.error.details.status]).toEqual([409, "REGISTRATION_EVENT_CLOSED", "CANCELLED"]);
    expect([down.status, down.body.error.code]).toEqual([503, "IDENTITY_UNAVAILABLE"]);
    expect(waiting.status).toBe(201);
    expect(added.status).toBe(201);
    const [entry] = await sql<{ status: string; registration_id: string }[]>`select status, registration_id from registration.waitlist_entries where id = ${waiting.body.id}`;
    expect(entry).toEqual({ status: "REGISTERED", registration_id: added.body.id });
  });
});
