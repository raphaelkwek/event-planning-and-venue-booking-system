import { afterAll, afterEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import request from "supertest";
import { handleListingMessage } from "../../src/consumer/handleListing.js";
import { CLOSES, DEADLINE, DURING, STARTS, anEvent, appAt, asAttendee, cleanUp, listingMessage, outboxOf, placesOf } from "../support/fixtures.js";

/**
 * R4 — withdraw my registration (POST /api/v1/registrations/:id/withdrawal),
 * against the real registration schema. One test per card in tests/R4; every
 * refusal is checked to change neither the status nor places remaining.
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
const withdrawAs = (attendeeId: string, registrationId: string) =>
  request(app).post(`/api/v1/registrations/${registrationId}/withdrawal`).set(asAttendee(attendeeId));

async function stored(id: string) {
  const [row] = await sql<{ status: string; withdrawn_at: Date | null }[]>`
    select status, withdrawn_at from registration.registrations where id = ${id}`;
  return row!;
}

/** A registered attendee for a fresh event, and the event. */
async function registered(o: Parameters<typeof anEvent>[1] = {}) {
  const event = await anEvent(sql, o);
  const me = randomUUID();
  const res = await registerAs(me, event.eventId);
  expect(res.status).toBe(201);
  return { event, me, registration: res.body as { id: string; reference: string } };
}

describe("POST /api/v1/registrations/:id/withdrawal (R4)", () => {
  it("R4-T1 withdraws my registration: Withdrawn, with its time, and the record kept", async () => {
    const { me, registration } = await registered();
    clock.now = new Date(DURING.getTime() + 3_600_000);

    const res = await withdrawAs(me, registration.id);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: registration.id, status: "WITHDRAWN", withdrawnAt: "2026-12-05T03:00:00.000Z", registeredAt: DURING.toISOString() });
    expect(await stored(registration.id)).toEqual({ status: "WITHDRAWN", withdrawn_at: new Date("2026-12-05T03:00:00.000Z") });
  });

  it("R4-T2 puts places remaining up by exactly one", async () => {
    const { event, me, registration } = await registered({ seats: 3 });
    await registerAs(randomUUID(), event.eventId);
    expect(await placesOf(sql, event.eventId)).toBe(1);

    await withdrawAs(me, registration.id);

    expect(await placesOf(sql, event.eventId)).toBe(2);
  });

  it("R4-T3 answers another attendee's registration as not found, and changes nothing", async () => {
    const { event, registration } = await registered({ seats: 3 });

    const res = await withdrawAs(randomUUID(), registration.id);
    const notAnId = await withdrawAs(randomUUID(), "not-an-id");

    expect([res.status, res.body.error.code, res.body.error.message]).toEqual([404, "REGISTRATION_NOT_FOUND", "No registration with that id is yours."]);
    expect([notAnId.status, notAnId.body.error.code]).toEqual([404, "REGISTRATION_NOT_FOUND"]);
    expect((await stored(registration.id)).status).toBe("REGISTERED");
    expect(await placesOf(sql, event.eventId)).toBe(2);
  });

  it("R4-T4 refuses to withdraw a registration that is already Withdrawn or Cancelled, changing nothing", async () => {
    const { event, me, registration } = await registered({ seats: 3 });
    await withdrawAs(me, registration.id);
    const first = await stored(registration.id);

    const again = await withdrawAs(me, registration.id);

    expect(again.status).toBe(409);
    expect(again.body.error).toMatchObject({
      code: "REGISTRATION_NOT_ACTIVE",
      message: `Registration ${registration.reference} is Withdrawn, so it cannot be withdrawn.`,
      details: { status: "WITHDRAWN" },
    });
    expect(await stored(registration.id)).toEqual(first);
    expect((await outboxOf(sql, event.eventId)).filter((m) => m.type === "registration.withdrawn")).toHaveLength(1);
    expect(await placesOf(sql, event.eventId)).toBe(3);

    const other = await registered();
    await handleListingMessage(listingMessage(other.event.eventId, other.event.reference, { status: "CANCELLED", changedAt: "2026-12-06T00:00:00.000Z" }), { sql });
    const cancelled = await withdrawAs(other.me, other.registration.id);
    expect([cancelled.status, cancelled.body.error.message]).toEqual([409, `Registration ${other.registration.reference} is Cancelled, so it cannot be withdrawn.`]);
  });

  it("R4-T5 allows a withdrawal exactly at the organiser's deadline", async () => {
    const { me, registration } = await registered();
    clock.now = new Date(DEADLINE);

    expect((await withdrawAs(me, registration.id)).status).toBe(200);
  });

  it("R4-T6 refuses a withdrawal a millisecond after the deadline, naming it; status and places unchanged", async () => {
    const { event, me, registration } = await registered({ seats: 3 });
    clock.now = new Date(Date.parse(DEADLINE) + 1);

    const res = await withdrawAs(me, registration.id);

    expect(res.status).toBe(422);
    expect(res.body.error).toMatchObject({
      code: "WITHDRAWAL_DEADLINE_PASSED",
      message: `The withdrawal deadline for ${event.reference} “R Test Symposium” was Monday 14 December 2026, 18:00, so registration ${registration.reference} can no longer be withdrawn.`,
      details: { withdrawalDeadline: DEADLINE },
    });
    expect((await stored(registration.id)).status).toBe("REGISTERED");
    expect(await placesOf(sql, event.eventId)).toBe(2);
  });

  it("R4-T7 with no deadline, allows withdrawal up to the event's start, and refuses it after, naming the start", async () => {
    const atStart = await registered({ deadline: null });
    clock.now = new Date(STARTS);
    expect((await withdrawAs(atStart.me, atStart.registration.id)).status).toBe(200);

    clock.now = DURING;
    const after = await registered({ deadline: null });
    clock.now = new Date(Date.parse(STARTS) + 1);
    const res = await withdrawAs(after.me, after.registration.id);

    expect(res.status).toBe(422);
    expect(res.body.error.message).toBe(
      `The withdrawal deadline for ${after.event.reference} “R Test Symposium” was its start, Wednesday 16 December 2026, 14:00, so registration ${after.registration.reference} can no longer be withdrawn.`,
    );
    expect((await stored(after.registration.id)).status).toBe("REGISTERED");
  });

  it("R4-T9 writes registration.withdrawn for the attendee's confirmation, naming the event for R6's waitlist", async () => {
    const { event, me, registration } = await registered();

    await withdrawAs(me, registration.id);

    const withdrawn = (await outboxOf(sql, event.eventId)).filter((m) => m.type === "registration.withdrawn");
    expect(withdrawn).toEqual([
      {
        type: "registration.withdrawn",
        key: registration.id,
        actor: `ATTENDEE:${me}`,
        data: {
          registrationId: registration.id,
          registrationReference: registration.reference,
          eventId: event.eventId,
          eventReference: event.reference,
          eventName: "R Test Symposium",
          attendeeId: me,
          registeredAt: DURING.toISOString(),
          withdrawnAt: DURING.toISOString(),
        },
      },
    ]);
  });

  it("R4-T10 registering again after withdrawing makes a new registration, under the same capacity and window rules", async () => {
    const { event, me, registration } = await registered({ seats: 1 });
    await withdrawAs(me, registration.id);

    const again = await registerAs(me, event.eventId);
    expect(again.status).toBe(201);
    expect(again.body.reference).not.toBe(registration.reference);
    expect((await request(app).get("/api/v1/registrations").set(asAttendee(me))).body.items.map((r: { status: string }) => r.status).sort()).toEqual([
      // Both were made at the fixed test instant, so the list's tie-break (the random id) decides their order.
      "REGISTERED",
      "WITHDRAWN",
    ]);

    // Capacity: the place was taken by someone else meanwhile.
    await withdrawAs(me, again.body.id);
    await registerAs(randomUUID(), event.eventId);
    expect((await registerAs(me, event.eventId)).body.error.code).toBe("REGISTRATION_FULL");

    // The window: closed by then.
    const second = await registered({ seats: 2 });
    await withdrawAs(second.me, second.registration.id);
    clock.now = new Date(Date.parse(CLOSES) + 1);
    expect((await registerAs(second.me, second.event.eventId)).body.error.code).toBe("REGISTRATION_OUTSIDE_WINDOW");
  });

  it("two withdrawals of one registration at once record one, and free its seat once", async () => {
    const { event, me, registration } = await registered({ seats: 2 });

    const pair = await Promise.all([withdrawAs(me, registration.id), withdrawAs(me, registration.id)]);

    expect(pair.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await placesOf(sql, event.eventId)).toBe(2);
  });
});
