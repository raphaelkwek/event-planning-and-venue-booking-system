import { afterAll, afterEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import request from "supertest";
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
  cleanUp,
  directoryPeople,
} from "../support/fixtures.js";

/**
 * R5 — the registrations for an event I manage
 * (GET /api/v1/events/:eventId/registrations), against the real registration
 * schema. One test per card in tests/R5. R4-T12 is proven with R5-T5.
 */

const sql = postgres(process.env.DATABASE_URL!, { max: 4, prepare: false });
const clock = { now: DURING };
const app = appAt(sql, clock);

afterEach(async () => {
  clock.now = DURING;
  directoryPeople.namesDown = false;
  await cleanUp(sql);
});
afterAll(() => sql.end());

const registerAs = (attendeeId: string, eventId: string) =>
  request(app).post("/api/v1/registrations").set(asAttendee(attendeeId)).send({ eventId });
const withdrawAs = (attendeeId: string, registrationId: string) =>
  request(app).post(`/api/v1/registrations/${registrationId}/withdrawal`).set(asAttendee(attendeeId));
const listAs = (headers: Record<string, string>, eventId: string, query = "") =>
  request(app).get(`/api/v1/events/${eventId}/registrations${query}`).set(headers);

/** A registration made at `at` by the attendee, which the test expects to succeed. */
async function registeredAt(attendeeId: string, eventId: string, at: Date) {
  clock.now = at;
  const res = await registerAs(attendeeId, eventId);
  expect(res.status).toBe(201);
  return res.body as { id: string; reference: string };
}

const minutes = (n: number) => new Date(DURING.getTime() + n * 60_000);

describe("GET /api/v1/events/:eventId/registrations (R5)", () => {
  it("R5-T1 shows the owning organiser each registration with the attendee's name, its time and its status", async () => {
    const event = await anEvent(sql, { seats: 3 });
    const mine = await registeredAt(ATTENDEE_ONE, event.eventId, DURING);

    const res = await listAs(asOrganiser(OWNER), event.eventId);

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([
      {
        id: mine.id,
        reference: mine.reference,
        attendee: { id: ATTENDEE_ONE, name: "Attendee One", email: "attendee@connectsphere.test" },
        status: "REGISTERED",
        registeredAt: DURING.toISOString(),
        withdrawnAt: null,
        cancelledAt: null,
        manualAddition: null,
        holdsSeat: true,
      },
    ]);
    expect(res.body.event).toEqual({ eventId: event.eventId, reference: event.reference, name: "R Test Symposium", status: "CONFIRMED", startsAt: "2026-12-16T06:00:00.000Z" });
    expect(res.body.totals).toMatchObject({ registered: 1, withdrawn: 0, placesRemaining: 2, capacity: 3 });
    expect(res.body.namesAvailable).toBe(true);
  });

  it("R5-T2 shows the assigned coordinator the same list", async () => {
    const event = await anEvent(sql, { seats: 3 });
    await registeredAt(ATTENDEE_ONE, event.eventId, DURING);

    const organiser = await listAs(asOrganiser(OWNER), event.eventId);
    const coordinator = await listAs(asCoordinator(COORDINATOR), event.eventId);

    expect(coordinator.status).toBe(200);
    expect(coordinator.body).toEqual(organiser.body);
  });

  it("R5-T3 gives another organiser, an unassigned coordinator and an attendee no registration data", async () => {
    const event = await anEvent(sql, { seats: 3 });
    await registeredAt(ATTENDEE_ONE, event.eventId, DURING);
    const unassigned = await anEvent(sql, { seats: 3, coordinatorId: null });

    const responses = [
      await listAs(asOrganiser(randomUUID()), event.eventId),
      await listAs(asCoordinator(randomUUID()), event.eventId),
      await listAs(asCoordinator(COORDINATOR), unassigned.eventId),
      await listAs(asOrganiser(OWNER), randomUUID()),
    ];
    const attendee = await listAs(asAttendee(ATTENDEE_ONE), event.eventId);

    for (const res of responses) {
      expect([res.status, res.body.error.code, res.body.error.message]).toEqual([404, "EVENT_NOT_FOUND", "No event you manage has that id."]);
      expect(Object.keys(res.body)).toEqual(["error"]);
      expect(res.body.error).not.toHaveProperty("details");
    }
    expect([attendee.status, attendee.body.error.code, Object.keys(attendee.body)]).toEqual([403, "ROLE_NOT_AUTHORISED", ["error"]]);
  });

  it("R5-T4 totals registered, withdrawn and places remaining from the records", async () => {
    const event = await anEvent(sql, { seats: 4 });
    const [a, b, c] = [randomUUID(), randomUUID(), randomUUID()];
    await registeredAt(a, event.eventId, minutes(1));
    await registeredAt(b, event.eventId, minutes(2));
    const third = await registeredAt(c, event.eventId, minutes(3));
    expect((await withdrawAs(c, third.id)).status).toBe(200);

    const res = await listAs(asOrganiser(OWNER), event.eventId);

    expect(res.body.totals).toEqual({
      registered: 2,
      withdrawn: 1,
      cancelled: 0,
      manuallyAdded: 0,
      addedOverCapacity: 0,
      capacity: 4,
      placesRemaining: 2,
      overCapacityBy: 0,
    });
    expect(res.body.items.map((r: { attendee: { id: string }; status: string }) => [r.attendee.id, r.status])).toEqual([
      [a, "REGISTERED"],
      [b, "REGISTERED"],
      [c, "WITHDRAWN"],
    ]);
  });

  it("R5-T5 shows a withdrawal in the row and the totals on the next load (R4-T12)", async () => {
    const event = await anEvent(sql, { seats: 3 });
    const mine = await registeredAt(ATTENDEE_ONE, event.eventId, DURING);
    const before = await listAs(asOrganiser(OWNER), event.eventId);

    clock.now = minutes(30);
    expect((await withdrawAs(ATTENDEE_ONE, mine.id)).status).toBe(200);
    const after = await listAs(asOrganiser(OWNER), event.eventId);

    expect(before.body.totals).toMatchObject({ registered: 1, withdrawn: 0, placesRemaining: 2 });
    expect(after.body.totals).toMatchObject({ registered: 0, withdrawn: 1, placesRemaining: 3 });
    expect(after.body.items).toEqual([
      expect.objectContaining({ id: mine.id, status: "WITHDRAWN", withdrawnAt: minutes(30).toISOString(), registeredAt: DURING.toISOString() }),
    ]);
  });

  it("R5-T6 shows an event with no registrations as empty, with every place remaining", async () => {
    const event = await anEvent(sql, { seats: 3 });

    const res = await listAs(asOrganiser(OWNER), event.eventId);

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
    expect(res.body.nextCursor).toBeNull();
    expect(res.body.totals).toMatchObject({ registered: 0, withdrawn: 0, placesRemaining: 3, capacity: 3 });
  });

  it("pages the list in registration order, with the totals over all of it", async () => {
    const event = await anEvent(sql, { seats: 5 });
    const ids = [randomUUID(), randomUUID(), randomUUID()];
    for (const [i, id] of ids.entries()) await registeredAt(id, event.eventId, minutes(i));

    const first = await listAs(asOrganiser(OWNER), event.eventId, "?limit=2");
    const second = await listAs(asOrganiser(OWNER), event.eventId, `?limit=2&cursor=${first.body.nextCursor}`);

    expect(first.body.items.map((r: { attendee: { id: string } }) => r.attendee.id)).toEqual(ids.slice(0, 2));
    expect(second.body.items.map((r: { attendee: { id: string } }) => r.attendee.id)).toEqual(ids.slice(2));
    expect(second.body.nextCursor).toBeNull();
    expect(first.body.totals.registered).toBe(3);
  });

  it("still lists the registrations when identity can't name anyone, saying the names are missing", async () => {
    const event = await anEvent(sql, { seats: 3 });
    await registeredAt(ATTENDEE_ONE, event.eventId, DURING);
    directoryPeople.namesDown = true;

    const res = await listAs(asOrganiser(OWNER), event.eventId);

    expect(res.status).toBe(200);
    expect(res.body.namesAvailable).toBe(false);
    expect(res.body.items[0].attendee).toEqual({ id: ATTENDEE_ONE, name: null, email: null });
  });
});
