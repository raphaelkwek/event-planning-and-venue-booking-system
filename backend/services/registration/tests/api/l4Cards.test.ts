import { afterAll, afterEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import request from "supertest";
import { handleMessage } from "../../src/consumer/handleApproval.js";
import { DURING, OWNER, anEvent, appAt, approvalMessage, asAttendee, asOrganiser, cleanUp, placesOf } from "../support/fixtures.js";

/**
 * L4-T11 (tests/L4) — CR-03, CQ-04: for an event with several confirmed venues, registration is
 * limited by the total of their layout capacities (R2), and so is R7's capacity check. The event
 * reaches the service as planning-core publishes it: its listing, then one
 * `venue-booking.request-approved` per confirmed booking, each naming its own booked layout and
 * that layout's capacity, handled by the seat builder.
 */

const sql = postgres(process.env.DATABASE_URL!, { max: 20, prepare: false });
const clock = { now: DURING };
const app = appAt(sql, clock);

afterEach(() => cleanUp(sql));
afterAll(() => sql.end());

const registerAs = (attendeeId: string, eventId: string) =>
  request(app).post("/api/v1/registrations").set(asAttendee(attendeeId)).send({ eventId });

/** M1's approval of one of the event's bookings, for the venue and booked layout given, handled by the seat builder. */
async function confirmedBooking(eventId: string, booking: { venueName: string; venueLocation: string; layout: string; seats: number }) {
  const approval = approvalMessage(eventId, { seats: booking.seats, venueName: booking.venueName, venueLocation: booking.venueLocation });
  // The fixture's approval is for a Theatre booking; this one names the layout that was booked.
  const envelope = JSON.parse(approval.value) as { data: Record<string, unknown> };
  envelope.data.layout = booking.layout;
  const built = await handleMessage(JSON.stringify(envelope), { sql });
  expect(built.outcome).toBe("built");
}

/** `n` new attendees register, twenty at a time; every one is accepted. */
async function registered(eventId: string, n: number) {
  for (let done = 0; done < n; done += 20) {
    const batch = await Promise.all(Array.from({ length: Math.min(20, n - done) }, () => registerAs(randomUUID(), eventId)));
    expect(batch.map((res) => res.status)).toEqual(batch.map(() => 201));
  }
}

describe("registration capacity across an event's venues (L4, CQ-04)", () => {
  it("L4-T11 limits registration to the total of both layout capacities: the 360th registers, the 361st is refused for capacity and offered the waitlist, and R7 counts the same 360", async () => {
    // FX-BOOKING's event, Confirmed with registration open (U1, R1), with its two confirmed bookings.
    const event = await anEvent(sql, { venues: [] });
    await confirmedBooking(event.eventId, { venueName: "Lee Kong Chian Auditorium", venueLocation: "School of Computing, Level 1", layout: "Theatre", seats: 300 });
    await confirmedBooking(event.eventId, { venueName: "Seminar Room 2-1", venueLocation: "School of Computing, Level 2", layout: "Classroom", seats: 60 });
    const opened = await request(app).get(`/api/v1/open-events/${event.eventId}`).set(asAttendee(randomUUID()));
    expect(opened.body.placesRemaining).toBe(360);

    // Step 1: attendees register until registration is full. The 360th takes the last place.
    await registered(event.eventId, 359);
    expect(await placesOf(sql, event.eventId)).toBe(1);
    expect((await registerAs(randomUUID(), event.eventId)).status).toBe(201);
    expect(await placesOf(sql, event.eventId)).toBe(0);

    // The 361st is refused, naming capacity as the cause and offering the waitlist (R2, R6), and stores nothing.
    const over = randomUUID();
    const refused = await registerAs(over, event.eventId);
    expect(refused.status).toBe(409);
    expect(refused.body.error).toMatchObject({
      code: "REGISTRATION_FULL",
      message: `${event.reference} “R Test Symposium” has no places remaining, so you were not registered. You can ask for a place on the waitlist instead.`,
      details: { eventId: event.eventId, placesRemaining: 0, waitlistOffered: true },
    });
    const [counts] = await sql<{ registered: number; seats: number; over: number }[]>`
      select count(*)::int as registered, count(distinct seat_id)::int as seats,
             count(*) filter (where attendee_id = ${over})::int as over
      from registration.registrations where event_id = ${event.eventId} and status = 'REGISTERED'`;
    expect(counts).toEqual({ registered: 360, seats: 360, over: 0 });
    const joined = await request(app).post(`/api/v1/events/${event.eventId}/waitlist`).set(asAttendee(over));
    expect(joined.status).toBe(201);
    expect(joined.body).toMatchObject({ status: "WAITLISTED", position: 1 });

    // Step 2: R7's capacity check takes the same total. One more, added by hand, would be the 361st.
    const added = await request(app)
      .post(`/api/v1/events/${event.eventId}/manual-registrations`)
      .set(asOrganiser(OWNER))
      .send({ attendeeEmail: "attendee@connectsphere.test" });
    expect([added.status, added.body.error?.code, added.body.error?.details]).toEqual([
      409,
      "REGISTRATION_OVER_CAPACITY_UNCONFIRMED",
      { capacity: 360, registered: 360, totalAfter: 361 },
    ]);
  }, 120_000);
});
