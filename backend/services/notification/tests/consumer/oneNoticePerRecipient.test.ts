import { afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { handleMessage, type OutgoingMessage } from "../../src/consumer/handleMessage.js";

/**
 * One notification per person a message names, against the real notification schema
 * (implementation.md §3.5). notification.notifications is unique on (source_message_id,
 * recipient_user_id): the inbox's idempotency key. S3-T13's browser journey found that a
 * change-request.arrangements-flagged message naming one Venue Staff member for two flagged
 * bookings failed that key, was retried, then dead-lettered, so nobody was told. F5's
 * event.arrangements-confirmed did the same for a member who looks after two booked venues.
 * The rules themselves are in tests/domain/recipients.test.ts.
 */

const sql = postgres(process.env.DATABASE_URL!, { max: 2, prepare: false });
const recipients: string[] = [];
const messageIds: string[] = [];

afterAll(async () => {
  if (recipients.length) await sql`delete from notification.notifications where recipient_user_id in ${sql(recipients)}`;
  if (messageIds.length) await sql`delete from notification.consumed_messages where message_id in ${sql(messageIds)}`;
  await sql.end();
});

const publisher = () => {
  const sent: Array<OutgoingMessage & { topic: string }> = [];
  return { sent, publish: async (topic: string, message: OutgoingMessage) => void sent.push({ topic, ...message }) };
};

/** A CloudEvent on the event topic, as the relay publishes it. */
function delivered(type: string, source: string, eventId: string, data: Record<string, unknown>) {
  const id = randomUUID();
  messageIds.push(id);
  const event = {
    specversion: "1.0",
    id,
    source,
    type,
    subject: eventId,
    time: new Date().toISOString(),
    datacontenttype: "application/json",
    traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
    actor: "EVENT_COORDINATOR:00000000-0000-0000-0000-000000000002",
    data,
  };
  return {
    id,
    message: {
      topic: "connectsphere.event.v1",
      key: eventId,
      value: JSON.stringify(event),
      headers: { "content-type": "application/cloudevents+json; charset=UTF-8" },
    },
  };
}

const people = (count: number) => {
  const ids = Array.from({ length: count }, () => randomUUID());
  recipients.push(...ids);
  return ids;
};

const rowsFor = (ids: string[]) =>
  sql<{ recipient_user_id: string; notification_type: string; source_message_id: string; message: string }[]>`
    select recipient_user_id, notification_type, source_message_id, message from notification.notifications
    where recipient_user_id in ${sql(ids)}`;

describe("one notification per person a message names", () => {
  it("stores one notification per person for an S3 message that flags two of one member's bookings, naming both, and dead-letters nothing", async () => {
    const [venueStaff, otherVenueStaff, techSupport] = people(3);
    const eventId = randomUUID();
    const moved = "The booking is for Tuesday 2 March 2027, 14:00–18:00, but the event is now Tuesday 2 March 2027, 15:00–18:00.";
    const tooSmall = "Expected attendance is now 150, but Theatre One holds 100 in the Theatre layout.";
    const reservationMoved = "The reservation is for Tuesday 2 March 2027, 14:00–18:00, but the event is now Tuesday 2 March 2027, 15:00–18:00.";
    // S3-T13's shape: the theatre booking is moved and too small (two flags), the hall booking is
    // moved, and Venue Staff One looks after both venues; one member reserved two lines.
    const { id, message } = delivered("change-request.arrangements-flagged", "/connectsphere/planning-core/change", eventId, {
      eventId,
      eventReference: "EVT-S3N-0001",
      eventName: "Flag notice test",
      changeRequestId: randomUUID(),
      bookings: [
        { arrangement: "BOOKING", reference: "BKR-S3N-01", venueName: "Theatre One", flag: "REQUIRES_RECONFIRMATION", reason: moved, staffIds: [venueStaff, otherVenueStaff] },
        { arrangement: "BOOKING", reference: "BKR-S3N-01", venueName: "Theatre One", flag: "UNSUITABLE", reason: tooSmall, staffIds: [venueStaff, otherVenueStaff] },
        { arrangement: "BOOKING", reference: "BKR-S3N-02", venueName: "Hall Two", flag: "REQUIRES_RECONFIRMATION", reason: moved, staffIds: [venueStaff] },
      ],
      reservations: [
        { equipmentTypeName: "Folding Chairs", flag: "FLAGGED_FOR_REVIEW", reason: reservationMoved, reservedBy: techSupport },
        { equipmentTypeName: "Projectors", flag: "FLAGGED_FOR_REVIEW", reason: reservationMoved, reservedBy: techSupport },
      ],
      returnedToPlanning: true,
    });
    const { publish, sent } = publisher();

    expect(await handleMessage(message, { sql, publish })).toEqual({ outcome: "stored", notifications: 3 });
    // Nothing went to the retry or the dead-letter topic.
    expect(sent).toEqual([]);

    const rows = await rowsFor([venueStaff!, otherVenueStaff!, techSupport!]);
    expect(rows.map((row) => row.recipient_user_id).sort()).toEqual([venueStaff, otherVenueStaff, techSupport].sort());
    expect(rows.every((row) => row.notification_type === "change-request.arrangements-flagged" && row.source_message_id === id)).toBe(true);
    const textOf = (recipient: string) => rows.find((row) => row.recipient_user_id === recipient)!.message;
    expect(textOf(venueStaff!)).toBe(
      "Booking BKR-S3N-01 at Theatre One and booking BKR-S3N-02 at Hall Two for EVT-S3N-0001 “Flag notice test” need attention after an approved change. " +
        `BKR-S3N-01: ${moved} ${tooSmall} BKR-S3N-02: ${moved}`,
    );
    expect(textOf(otherVenueStaff!)).toBe(
      `Booking BKR-S3N-01 at Theatre One for EVT-S3N-0001 “Flag notice test” needs attention after an approved change: ${moved} ${tooSmall}`,
    );
    expect(textOf(techSupport!)).toBe(
      "The Folding Chairs reservation and the Projectors reservation for EVT-S3N-0001 “Flag notice test” need attention after an approved change. " +
        `Folding Chairs: ${reservationMoved} Projectors: ${reservationMoved} Release any reservation that is no longer needed.`,
    );

    // The key still does its job: a second delivery of the same message stores nothing more.
    expect(await handleMessage(message, { sql, publish })).toEqual({ outcome: "duplicate" });
    expect(await rowsFor([venueStaff!, otherVenueStaff!, techSupport!])).toHaveLength(3);
  });

  it("stores one notification for a Venue Staff member who looks after two of an F5 message's booked venues, naming both", async () => {
    const [organiser, venueStaff, reserver] = people(3);
    const eventId = randomUUID();
    const { message } = delivered("event.arrangements-confirmed", "/connectsphere/planning-core/event", eventId, {
      eventId,
      eventReference: "EVT-S3N-0002",
      eventName: "Confirm notice test",
      ownerId: organiser,
      confirmedBy: randomUUID(),
      confirmedAt: new Date().toISOString(),
      bookings: [
        { bookingId: randomUUID(), reference: "BKR-S3N-11", venueName: "Theatre One", startsAt: "2030-01-01T06:00:00.000Z", endsAt: "2030-01-01T10:00:00.000Z", staffIds: [venueStaff] },
        { bookingId: randomUUID(), reference: "BKR-S3N-12", venueName: "Hall Two", startsAt: "2030-01-01T06:00:00.000Z", endsAt: "2030-01-01T10:00:00.000Z", staffIds: [venueStaff] },
      ],
      reservations: [{ reservationId: randomUUID(), equipmentTypeName: "Chairs", reservedQuantity: 5, reservedBy: reserver }],
      safetyOfficerIds: [],
    });
    const { publish, sent } = publisher();

    expect(await handleMessage(message, { sql, publish })).toEqual({ outcome: "stored", notifications: 3 });
    expect(sent).toEqual([]);
    const staffRows = await rowsFor([venueStaff!]);
    expect(staffRows.map((row) => row.message)).toEqual([
      "EVT-S3N-0002 “Confirm notice test” has confirmed its arrangements, including booking BKR-S3N-11 at Theatre One, Tuesday 1 January 2030, 14:00–18:00; " +
        "booking BKR-S3N-12 at Hall Two, Tuesday 1 January 2030, 14:00–18:00. It is now in Safety Review.",
    ]);
    expect(await rowsFor([organiser!, reserver!])).toHaveLength(2);
  });
});
