import { afterAll, afterEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import request from "supertest";
import { parseCloudEvent } from "@connectsphere/contracts";
import { handleListingMessage } from "../../src/consumer/handleListing.js";
import { register } from "../../src/service/register.js";
import {
  CLOSES,
  DURING,
  ENDS,
  OPENS,
  STARTS,
  anEvent,
  appAt,
  asAttendee,
  asOrganiser,
  cleanUp,
  listingMessage,
  outboxOf,
  placesOf,
} from "../support/fixtures.js";

/**
 * R2 — register for an event (POST /api/v1/registrations), against the real
 * registration schema. One test per card in tests/R2; every refusal is checked
 * to store nothing and leave places unchanged.
 */

const sql = postgres(process.env.DATABASE_URL!, { max: 20, prepare: false });
const clock = { now: DURING };
const app = appAt(sql, clock);

afterEach(async () => {
  clock.now = DURING;
  await cleanUp(sql);
});
afterAll(() => sql.end());

const registerAs = (attendeeId: string, eventId: string) =>
  request(app).post("/api/v1/registrations").set(asAttendee(attendeeId)).send({ eventId });

async function registrationsOf(eventId: string) {
  return sql<{ attendee_id: string; status: string; registered_at: Date; reference: string }[]>`
    select attendee_id, status, registered_at, reference from registration.registrations where event_id = ${eventId} order by registered_at`;
}

/** What a refusal must leave as it was (R2): no registration, no message, the same places. */
async function nothingChanged(eventId: string, places: number, registrations = 0) {
  expect(await registrationsOf(eventId)).toHaveLength(registrations);
  expect(await placesOf(sql, eventId)).toBe(places);
  expect(await outboxOf(sql, eventId)).toHaveLength(registrations);
}

describe("POST /api/v1/registrations (R2)", () => {
  it("R2-T1 registers the attendee as Registered at the time it was accepted, confirms it, and takes exactly one place", async () => {
    const event = await anEvent(sql, { seats: 3 });
    const me = randomUUID();

    const res = await registerAs(me, event.eventId);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      reference: expect.stringMatching(/^REG-\d{6}$/),
      status: "REGISTERED",
      registeredAt: DURING.toISOString(),
      withdrawnAt: null,
      event: { eventId: event.eventId, reference: event.reference, name: "R Test Symposium", startsAt: STARTS, endsAt: ENDS },
    });
    const [row] = await registrationsOf(event.eventId);
    expect(row).toMatchObject({ attendee_id: me, status: "REGISTERED", registered_at: DURING, reference: res.body.reference });
    expect(await placesOf(sql, event.eventId)).toBe(2);
    const [message] = await outboxOf(sql, event.eventId);
    expect(message).toMatchObject({ type: "registration.confirmed", key: res.body.id, actor: `ATTENDEE:${me}` });
    expect(message!.data).toEqual({
      registrationId: res.body.id,
      registrationReference: res.body.reference,
      eventId: event.eventId,
      eventReference: event.reference,
      eventName: "R Test Symposium",
      attendeeId: me,
      registeredAt: DURING.toISOString(),
      eventStartsAt: STARTS,
      eventEndsAt: ENDS,
    });
  });

  it("D7: answers each registration with the event's places remaining just after it", async () => {
    const event = await anEvent(sql, { seats: 3 });

    const first = await registerAs(randomUUID(), event.eventId);
    const second = await registerAs(randomUUID(), event.eventId);

    expect([first.status, second.status]).toEqual([201, 201]);
    expect(first.body.placesRemaining).toBe(2);
    expect(second.body.placesRemaining).toBe(1);
    expect(await placesOf(sql, event.eventId)).toBe(1);
  });

  it("R2-T2 takes its places from the layout capacity: two left of three, and a second registration is accepted", async () => {
    const event = await anEvent(sql, { seats: 3 });
    expect((await registerAs(randomUUID(), event.eventId)).status).toBe(201);
    const open = await request(app).get(`/api/v1/open-events/${event.eventId}`).set(asAttendee(randomUUID()));
    expect(open.body.placesRemaining).toBe(2);

    expect((await registerAs(randomUUID(), event.eventId)).status).toBe(201);
    expect(await placesOf(sql, event.eventId)).toBe(1);
  });

  it("R2-T3 accepts registrations up to the total of two venues' capacities, then refuses for capacity", async () => {
    const event = await anEvent(sql, {
      venues: [
        { seats: 2, venueName: "Lee Kong Chian Auditorium", venueLocation: "School of Computing, Level 1" },
        { seats: 1, venueName: "Seminar Room 2-1", venueLocation: "School of Computing, Level 2" },
      ],
    });

    const statuses = [];
    for (let i = 0; i < 4; i++) statuses.push((await registerAs(randomUUID(), event.eventId)).status);

    expect(statuses).toEqual([201, 201, 201, 409]);
    expect(await placesOf(sql, event.eventId)).toBe(0);
  });

  it("R2-T4 refuses a full event naming capacity and offering the waitlist, storing nothing and leaving places at zero", async () => {
    const event = await anEvent(sql, { seats: 1 });
    expect((await registerAs(randomUUID(), event.eventId)).status).toBe(201);

    const res = await registerAs(randomUUID(), event.eventId);

    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({
      code: "REGISTRATION_FULL",
      message: `${event.reference} “R Test Symposium” has no places remaining, so you were not registered. You can ask for a place on the waitlist instead.`,
      details: { eventId: event.eventId, placesRemaining: 0, waitlistOffered: true },
    });
    await nothingChanged(event.eventId, 0, 1);
  });

  it("R2-T5 race: two attendees registering at once for the last place leave exactly one registration", async () => {
    const event = await anEvent(sql, { seats: 1 });

    const [a, b] = await Promise.all([registerAs(randomUUID(), event.eventId), registerAs(randomUUID(), event.eventId)]);

    expect([a.status, b.status].sort()).toEqual([201, 409]);
    expect(await registrationsOf(event.eventId)).toHaveLength(1);
    expect(await placesOf(sql, event.eventId)).toBe(0);
  });

  it("R2-T5 race: 500 attendees registering at once for 100 places leave exactly 100 registrations, each on its own seat (EN-13-T9 through R2)", async () => {
    const event = await anEvent(sql, { seats: 100 });

    const outcomes = await Promise.all(
      Array.from({ length: 500 }, () => register(sql, { eventId: event.eventId, attendeeId: randomUUID(), now: DURING, correlationId: null })),
    );

    expect(outcomes.filter((o) => o.ok)).toHaveLength(100);
    expect(outcomes.filter((o) => !o.ok && o.code === "FULL")).toHaveLength(400);
    const [counts] = await sql<{ registrations: number; seats: number }[]>`
      select count(*)::int as registrations, count(distinct seat_id)::int as seats
      from registration.registrations where event_id = ${event.eventId} and status = 'REGISTERED'`;
    expect(counts).toEqual({ registrations: 100, seats: 100 });
    expect(await placesOf(sql, event.eventId)).toBe(0);
  });

  it("R2-T6 refuses a second registration naming the first, with no second record and places unchanged", async () => {
    const event = await anEvent(sql, { seats: 3 });
    const me = randomUUID();
    const first = await registerAs(me, event.eventId);

    const again = await registerAs(me, event.eventId);

    expect(again.status).toBe(409);
    expect(again.body.error).toMatchObject({
      code: "REGISTRATION_DUPLICATE",
      message: `You are already registered for ${event.reference} “R Test Symposium” (registration ${first.body.reference}), so no second registration was made.`,
      details: { registrationId: first.body.id, registrationReference: first.body.reference },
    });
    await nothingChanged(event.eventId, 2, 1);
  });

  it("R2-T6 one attendee sending two registrations at once gets one, and the other names it", async () => {
    const event = await anEvent(sql, { seats: 3 });
    const me = randomUUID();

    const pair = await Promise.all([registerAs(me, event.eventId), registerAs(me, event.eventId)]);

    expect(pair.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(pair.find((r) => r.status === 409)!.body.error.code).toBe("REGISTRATION_DUPLICATE");
    await nothingChanged(event.eventId, 2, 1);
  });

  it("R2-T7 accepts a registration exactly at the opening instant", async () => {
    const event = await anEvent(sql);
    clock.now = new Date(OPENS);

    expect((await registerAs(randomUUID(), event.eventId)).status).toBe(201);
  });

  it("R2-T8 refuses a registration a millisecond before opening, naming the window, storing nothing", async () => {
    const event = await anEvent(sql, { seats: 3 });
    clock.now = new Date(Date.parse(OPENS) - 1);

    const res = await registerAs(randomUUID(), event.eventId);

    expect(res.status).toBe(422);
    expect(res.body.error).toMatchObject({
      code: "REGISTRATION_OUTSIDE_WINDOW",
      message: `Registration for ${event.reference} “R Test Symposium” opens on Tuesday 1 December 2026, 09:00 and closes on Thursday 10 December 2026, 18:00, so you cannot register now.`,
      details: { registrationOpensAt: OPENS, registrationClosesAt: CLOSES },
    });
    await nothingChanged(event.eventId, 3);
  });

  it("R2-T9 accepts a registration exactly at the closing instant", async () => {
    const event = await anEvent(sql);
    clock.now = new Date(CLOSES);

    expect((await registerAs(randomUUID(), event.eventId)).status).toBe(201);
  });

  it("R2-T10 refuses a registration a millisecond after closing, naming the window, storing nothing", async () => {
    const event = await anEvent(sql, { seats: 3 });
    clock.now = new Date(Date.parse(CLOSES) + 1);

    const res = await registerAs(randomUUID(), event.eventId);

    expect(res.status).toBe(422);
    expect(res.body.error.message).toBe(
      `Registration for ${event.reference} “R Test Symposium” opened on Tuesday 1 December 2026, 09:00 and closed on Thursday 10 December 2026, 18:00, so you can no longer register.`,
    );
    await nothingChanged(event.eventId, 3);
  });

  it("R2-T11 applies the window the organiser sets: a later listing message moves it", async () => {
    const event = await anEvent(sql, { opensAt: "2026-12-06T01:00:00.000Z" });
    expect((await registerAs(randomUUID(), event.eventId)).status).toBe(422);

    await handleListingMessage(listingMessage(event.eventId, event.reference, { opensAt: OPENS }), { sql });

    expect((await registerAs(randomUUID(), event.eventId)).status).toBe(201);
  });

  it("R2-T14 lets only attendees register, and does not reveal an event that is not open", async () => {
    const open = await anEvent(sql, { seats: 3 });
    const planning = await anEvent(sql, { status: "PLANNING" });

    const organiser = await request(app).post("/api/v1/registrations").set(asOrganiser(randomUUID())).send({ eventId: open.eventId });
    const inPlanning = await registerAs(randomUUID(), planning.eventId);
    const unknown = await registerAs(randomUUID(), randomUUID());
    const noToken = await request(app).post("/api/v1/registrations").send({ eventId: open.eventId });
    const identityDown = await request(app).post("/api/v1/registrations").set({ Authorization: "Bearer down" }).send({ eventId: open.eventId });
    const revoked = await request(app).post("/api/v1/registrations").set({ Authorization: "Bearer revoked" }).send({ eventId: open.eventId });
    const noEvent = await request(app).post("/api/v1/registrations").set(asAttendee(randomUUID())).send({});

    expect([organiser.status, organiser.body.error.code]).toEqual([403, "ROLE_NOT_AUTHORISED"]);
    expect([inPlanning.status, inPlanning.body.error.code]).toEqual([404, "EVENT_NOT_FOUND"]);
    expect([unknown.status, unknown.body.error.message]).toEqual([404, inPlanning.body.error.message]);
    expect([noToken.status, noToken.body.error.code]).toEqual([401, "UNAUTHENTICATED"]);
    expect([identityDown.status, identityDown.body.error.code]).toEqual([503, "IDENTITY_UNAVAILABLE"]);
    expect([revoked.status, revoked.body.error.code]).toEqual([401, "UNAUTHENTICATED"]);
    expect([noEvent.status, noEvent.body.error.fields]).toEqual([400, [{ field: "eventId", message: "Give the event's id." }]]);
    await nothingChanged(open.eventId, 3);
    await nothingChanged(planning.eventId, 3);
  });

  it("checks the message it writes against its contract", async () => {
    const event = await anEvent(sql);
    await registerAs(randomUUID(), event.eventId);
    const [row] = await sql<{ envelope: unknown }[]>`
      select envelope from registration.outbox
      where message_key in (select id::text from registration.registrations where event_id = ${event.eventId})`;
    expect(parseCloudEvent(row!.envelope)).toMatchObject({ source: "/connectsphere/registration", type: "registration.confirmed" });
  });
});
