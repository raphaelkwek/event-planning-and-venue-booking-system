import { afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { handleMessage, type OutgoingMessage } from "../../src/consumer/handleMessage.js";

/**
 * Team decision D-02 (clarifications.md): the messages planning-core writes when a request enters
 * the unassigned queue, an event enters Safety Review, and a coordinator saves an equipment line
 * are stored as one notification per Lead, Safety Officer and Technical Support member they name,
 * against the real notification schema (implementation.md §3.5). The rules themselves are in
 * tests/domain/leadSafetyTechSupport.test.ts.
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

/** A CloudEvent as the relay publishes it, about `subject`, on `topic`. */
function delivered(topic: string, type: string, source: string, subject: string, data: Record<string, unknown>) {
  const id = randomUUID();
  messageIds.push(id);
  const event = {
    specversion: "1.0",
    id,
    source,
    type,
    subject,
    time: new Date().toISOString(),
    datacontenttype: "application/json",
    traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
    actor: "EVENT_COORDINATOR:00000000-0000-0000-0000-000000000002",
    data,
  };
  return { id, message: { topic, key: subject, value: JSON.stringify(event), headers: { "content-type": "application/cloudevents+json; charset=UTF-8" } } };
}

const people = (count: number) => {
  const ids = Array.from({ length: count }, () => randomUUID());
  recipients.push(...ids);
  return ids;
};
const rowsFor = (ids: string[]) =>
  sql<{ recipient_user_id: string; notification_type: string; event_reference: string; message: string }[]>`
    select recipient_user_id, notification_type, event_reference, message from notification.notifications
    where recipient_user_id in ${sql(ids)} order by recipient_user_id`;

describe("D-02 notifications, stored from the messages planning-core writes", () => {
  it("stores one notification for each Lead an event.submitted message names (E3-T9)", async () => {
    const [organiser, leadA, leadB] = people(3);
    const eventId = randomUUID();
    const { id, message } = delivered("connectsphere.event.v1", "event.submitted", "/connectsphere/planning-core/event", eventId, {
      eventId,
      eventReference: "EVT-D02-0001",
      eventName: "Queue test",
      ownerId: organiser,
      proposedStartAt: "2030-01-01T01:00:00.000Z",
      proposedEndAt: "2030-01-01T03:00:00.000Z",
      submittedAt: new Date().toISOString(),
      leadIds: [leadA, leadB],
    });
    const { publish, sent } = publisher();

    expect(await handleMessage(message, { sql, publish })).toEqual({ outcome: "stored", notifications: 2 });
    const rows = await rowsFor([organiser!, leadA!, leadB!]);
    expect(rows.map((row) => row.recipient_user_id).sort()).toEqual([leadA, leadB].sort());
    expect(rows.every((row) => row.notification_type === "event.submitted" && row.event_reference === "EVT-D02-0001")).toBe(true);
    expect(rows[0]!.message).toContain("waiting in your unassigned queue");
    const [inbox] = await sql`select consumer from notification.consumed_messages where message_id = ${id}`;
    expect(inbox!.consumer).toBe("notification.event-notifier");
    expect(sent).toEqual([]);
  });

  it("stores one notification for each Technical Support member an equipment-request.line-submitted message names (O1-T27)", async () => {
    const [coordinator, techA, techB] = people(3);
    const eventId = randomUUID();
    const lineId = randomUUID();
    const { message } = delivered("connectsphere.equipment-request.v1", "equipment-request.line-submitted", "/connectsphere/planning-core/equipment", lineId, {
      eventId,
      eventReference: "EVT-D02-0002",
      eventName: "Equipment test",
      lineId,
      equipmentTypeName: "Folding Chairs",
      quantity: 40,
      requiredFrom: "2030-01-01T01:00:00.000Z",
      requiredTo: "2030-01-01T03:00:00.000Z",
      requestedBy: coordinator,
      requestedAt: new Date().toISOString(),
      technicalSupportIds: [techA, techB],
    });
    const { publish } = publisher();

    expect(await handleMessage(message, { sql, publish })).toEqual({ outcome: "stored", notifications: 2 });
    const rows = await rowsFor([coordinator!, techA!, techB!]);
    expect(rows.map((row) => row.recipient_user_id).sort()).toEqual([techA, techB].sort());
    expect(rows.every((row) => row.notification_type === "equipment-request.line-submitted")).toBe(true);
    expect(rows[0]!.message).toContain("Folding Chairs × 40");
  });

  it("stores a notification for each Safety Officer an event.arrangements-confirmed message names, beside F5's (U1-T17)", async () => {
    const [organiser, staff, reserver, officer] = people(4);
    const eventId = randomUUID();
    const { message } = delivered("connectsphere.event.v1", "event.arrangements-confirmed", "/connectsphere/planning-core/event", eventId, {
      eventId,
      eventReference: "EVT-D02-0003",
      eventName: "Safety test",
      ownerId: organiser,
      confirmedBy: randomUUID(),
      confirmedAt: new Date().toISOString(),
      bookings: [
        { bookingId: randomUUID(), reference: "BKR-D02-01", venueName: "Hall", startsAt: "2030-01-01T01:00:00.000Z", endsAt: "2030-01-01T03:00:00.000Z", staffIds: [staff] },
      ],
      reservations: [{ reservationId: randomUUID(), equipmentTypeName: "Chairs", reservedQuantity: 5, reservedBy: reserver }],
      safetyOfficerIds: [officer],
    });
    const { publish } = publisher();

    expect(await handleMessage(message, { sql, publish })).toEqual({ outcome: "stored", notifications: 4 });
    const rows = await rowsFor([organiser!, staff!, reserver!, officer!]);
    expect(rows).toHaveLength(4);
    expect(rows.find((row) => row.recipient_user_id === officer)!.message).toContain("waiting in your Safety Review queue");
  });
});
