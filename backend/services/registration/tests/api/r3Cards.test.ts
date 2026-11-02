import { afterAll, afterEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import request from "supertest";
import { handleListingMessage } from "../../src/consumer/handleListing.js";
import {
  DEADLINE,
  DURING,
  ENDS,
  STARTS,
  anEvent,
  appAt,
  asAttendee,
  asOrganiser,
  cancelledMessage,
  cleanUp,
  listingMessage,
  outboxOf,
} from "../support/fixtures.js";

/**
 * R3 — my registrations (GET /api/v1/registrations, GET /api/v1/registrations/:id),
 * against the real registration schema. One test per card in tests/R3.
 */

const sql = postgres(process.env.DATABASE_URL!, { max: 4, prepare: false });
const clock = { now: DURING };
const app = appAt(sql, clock);

afterEach(async () => {
  clock.now = DURING;
  await cleanUp(sql);
});
afterAll(() => sql.end());

const registerAs = (attendeeId: string, eventId: string) =>
  request(app).post("/api/v1/registrations").set(asAttendee(attendeeId)).send({ eventId });
const mine = (attendeeId: string) => request(app).get("/api/v1/registrations").set(asAttendee(attendeeId));

describe("GET /api/v1/registrations (R3)", () => {
  it("R3-T1 R3-T5 lists each of my registrations, newest first, with the event's name, times, venue location, status and timestamps", async () => {
    const symposium = await anEvent(sql, { name: "R Test Symposium" });
    const talk = await anEvent(sql, { name: "R Second Talk" });
    const me = randomUUID();
    await registerAs(me, symposium.eventId);
    clock.now = new Date(DURING.getTime() + 60_000);
    const second = await registerAs(me, talk.eventId);
    clock.now = new Date(DURING.getTime() + 120_000);
    await request(app).post(`/api/v1/registrations/${second.body.id}/withdrawal`).set(asAttendee(me));

    const res = await mine(me);

    expect(res.status).toBe(200);
    expect(res.body.nextCursor).toBeNull();
    expect(res.body.items).toEqual([
      expect.objectContaining({
        status: "WITHDRAWN",
        registeredAt: "2026-12-05T02:01:00.000Z",
        withdrawnAt: "2026-12-05T02:02:00.000Z",
        cancelledAt: null,
        event: {
          eventId: talk.eventId,
          reference: talk.reference,
          name: "R Second Talk",
          startsAt: STARTS,
          endsAt: ENDS,
          venues: [{ name: "Lee Kong Chian Auditorium", location: "School of Computing, Level 1" }],
          withdrawalDeadline: DEADLINE,
        },
      }),
      expect.objectContaining({
        status: "REGISTERED",
        registeredAt: "2026-12-05T02:00:00.000Z",
        withdrawnAt: null,
        cancelledAt: null,
        event: expect.objectContaining({ name: "R Test Symposium", startsAt: STARTS }),
      }),
    ]);
  });

  it("R3-T2 never lists another attendee's registrations", async () => {
    const event = await anEvent(sql);
    const other = randomUUID();
    await registerAs(other, event.eventId);

    const res = await mine(randomUUID());

    expect(res.body).toEqual({ items: [], nextCursor: null });
    expect((await mine(other)).body.items).toHaveLength(1);
  });

  it("R3-T3 answers another attendee's registration by id exactly as one that does not exist", async () => {
    const event = await anEvent(sql);
    const other = randomUUID();
    const theirs = await registerAs(other, event.eventId);
    const me = randomUUID();

    const byId = await request(app).get(`/api/v1/registrations/${theirs.body.id}`).set(asAttendee(me));
    const random = await request(app).get(`/api/v1/registrations/${randomUUID()}`).set(asAttendee(me));
    const notAnId = await request(app).get("/api/v1/registrations/not-an-id").set(asAttendee(me));

    for (const res of [byId, random, notAnId]) {
      expect(res.status).toBe(404);
      expect(res.body.error).toMatchObject({ code: "REGISTRATION_NOT_FOUND", message: "No registration with that id is yours." });
      expect(JSON.stringify(res.body)).not.toContain(event.eventId);
    }
    const own = await request(app).get(`/api/v1/registrations/${theirs.body.id}`).set(asAttendee(other));
    expect([own.status, own.body.id]).toEqual([200, theirs.body.id]);
  });

  it("R3-T4 shows the registration as Cancelled when the event is cancelled (event.listing-changed), keeping it and freeing nothing for others", async () => {
    const event = await anEvent(sql, { seats: 3 });
    const me = randomUUID();
    const registered = await registerAs(me, event.eventId);
    const withdrawer = randomUUID();
    const gone = await registerAs(withdrawer, event.eventId);
    await request(app).post(`/api/v1/registrations/${gone.body.id}/withdrawal`).set(asAttendee(withdrawer));

    const cancelledAt = "2026-12-06T03:00:00.000Z";
    const message = listingMessage(event.eventId, event.reference, { status: "CANCELLED", changedAt: cancelledAt });
    expect(await handleListingMessage(message, { sql })).toEqual({ outcome: "applied", stale: false, cancelled: 1 });
    expect(await handleListingMessage(message, { sql })).toEqual({ outcome: "duplicate" });

    const [view] = (await mine(me)).body.items;
    expect(view).toMatchObject({ id: registered.body.id, status: "CANCELLED", cancelledAt, withdrawnAt: null });
    expect((await mine(withdrawer)).body.items[0]).toMatchObject({ status: "WITHDRAWN", cancelledAt: null });
    const [seats] = await sql<{ live: number }[]>`
      select count(*)::int as live from registration.seats where event_id = ${event.eventId} and status <> 'RETIRED'`;
    expect(seats!.live).toBe(0);
    const messages = await outboxOf(sql, event.eventId);
    expect(messages.filter((m) => m.type === "registration.cancelled")).toEqual([
      expect.objectContaining({ key: registered.body.id, actor: "SYSTEM", data: expect.objectContaining({ attendeeId: me, cancelledAt }) }),
    ]);
    // R1 no longer lists it, and R2 refuses it as not open.
    expect((await request(app).get(`/api/v1/open-events/${event.eventId}`).set(asAttendee(me))).status).toBe(404);
    expect((await registerAs(randomUUID(), event.eventId)).status).toBe(404);
  });

  it("R3-T4 F3's event.cancelled does the same, and whichever of the two messages comes second changes nothing", async () => {
    const event = await anEvent(sql, { seats: 2 });
    const me = randomUUID();
    await registerAs(me, event.eventId);

    expect(await handleListingMessage(cancelledMessage(event.eventId, event.reference), { sql })).toEqual({
      outcome: "applied",
      stale: false,
      cancelled: 1,
    });
    const after = listingMessage(event.eventId, event.reference, { status: "CANCELLED", changedAt: "2026-12-06T02:00:00.001Z" });
    expect(await handleListingMessage(after, { sql })).toEqual({ outcome: "applied", stale: true, cancelled: 0 });

    expect((await mine(me)).body.items[0]).toMatchObject({ status: "CANCELLED", cancelledAt: "2026-12-06T02:00:00.000Z" });
    expect((await outboxOf(sql, event.eventId)).filter((m) => m.type === "registration.cancelled")).toHaveLength(1);
  });

  it("R3-T6 an attendee with no registrations gets an empty list, not an error", async () => {
    expect((await mine(randomUUID())).body).toEqual({ items: [], nextCursor: null });
  });

  it("R3-T7 a staff role has no registrations to list here, and a request without a token is refused", async () => {
    const organiser = await request(app).get("/api/v1/registrations").set(asOrganiser(randomUUID()));
    const anonymous = await request(app).get("/api/v1/registrations");

    expect([organiser.status, organiser.body.error.code]).toEqual([403, "ROLE_NOT_AUTHORISED"]);
    expect([anonymous.status, anonymous.body.error.code]).toEqual([401, "UNAUTHENTICATED"]);
    expect(organiser.body.items).toBeUndefined();
  });

  it("pages through my registrations newest first", async () => {
    const me = randomUUID();
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) {
      const event = await anEvent(sql);
      clock.now = new Date(DURING.getTime() + i * 1000);
      ids.unshift((await registerAs(me, event.eventId)).body.id);
    }

    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const res = await request(app)
        .get(`/api/v1/registrations?limit=2${cursor ? `&cursor=${cursor}` : ""}`)
        .set(asAttendee(me));
      seen.push(...(res.body.items as { id: string }[]).map((r) => r.id));
      cursor = res.body.nextCursor;
    } while (cursor);
    expect(seen).toEqual(ids);
  });
});
