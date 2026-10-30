import { afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { handleMessage } from "../../src/consumer/handleApproval.js";
import { claimSeat, seatCounts } from "../../src/repo/seats.js";

/**
 * EN-13 done-checks, against the real registration schema (implementation.md
 * §3.5): an approval builds the event's seats, a duplicate delivery builds them
 * once, and a replaced booking's free seats are retired. Kafka is not involved:
 * what is tested is what the consumer runs for each message. The paths that
 * never reach the database are in handleApproval.unit.test.ts.
 */

const sql = postgres(process.env.DATABASE_URL!, { max: 4, prepare: false });
const eventIds: string[] = [];
const messageIds: string[] = [];

afterAll(async () => {
  if (eventIds.length) await sql`delete from registration.seats where event_id in ${sql(eventIds)}`;
  if (messageIds.length) await sql`delete from registration.consumed_messages where message_id in ${sql(messageIds)}`;
  await sql.end();
});

/** A valid venue-booking.request-approved CloudEvent, as the relay publishes it. */
function approval(over: { layoutCapacity?: number; replacedBookingId?: string; eventId?: string } = {}) {
  const eventId = over.eventId ?? randomUUID();
  const id = randomUUID();
  const bookingId = randomUUID();
  eventIds.push(eventId);
  messageIds.push(id);
  const data = {
    bookingRequestId: randomUUID(),
    reference: "BKR-000001",
    eventId,
    eventReference: "EVT-000123",
    eventName: "Annual Research Symposium",
    venueId: randomUUID(),
    venueName: "Lee Kong Chian Auditorium",
    startsAt: "2026-12-02T06:00:00.000Z",
    endsAt: "2026-12-02T10:00:00.000Z",
    coordinatorId: randomUUID(),
    ownerId: randomUUID(),
    decidedBy: randomUUID(),
    decidedAt: "2026-10-18T02:00:00.000Z",
    bookingId,
    replacedBookingId: over.replacedBookingId ?? null,
    layout: "Theatre",
    layoutCapacity: over.layoutCapacity ?? 40,
  };
  const value = JSON.stringify({
    specversion: "1.0",
    id,
    source: "/connectsphere/planning-core/venue",
    type: "venue-booking.request-approved",
    subject: data.bookingRequestId,
    time: "2026-10-18T02:00:00.000Z",
    datacontenttype: "application/json",
    traceparent: "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01",
    actor: `VENUE_STAFF:${randomUUID()}`,
    data,
  });
  return { value, eventId, bookingId, id };
}

describe("handleMessage (the seat builder)", () => {
  it("builds the event's seats from an approval's layout capacity (EN-13-T1)", async () => {
    const a = approval({ layoutCapacity: 40 });
    expect(await handleMessage(a.value, { sql })).toEqual({ outcome: "built", seats: 40, retired: 0 });
    expect((await seatCounts(sql, a.eventId)).PUBLIC.free).toBe(40);
  });

  it("builds the seats once when the same message is delivered twice (EN-13-T4)", async () => {
    const a = approval({ layoutCapacity: 25 });
    expect((await handleMessage(a.value, { sql })).outcome).toBe("built");
    expect(await handleMessage(a.value, { sql })).toEqual({ outcome: "duplicate" });
    expect((await seatCounts(sql, a.eventId)).PUBLIC.free).toBe(25);
  });

  it("records the message in the inbox in the same transaction as the seats (EN-13-T4)", async () => {
    const a = approval();
    await handleMessage(a.value, { sql });
    const rows = await sql`select consumer from registration.consumed_messages where message_id = ${a.id}`;
    expect(rows.map((r) => r.consumer)).toEqual(["registration.seat-builder"]);
  });

  it("retires the free seats of the booking an approval replaced, keeping a held seat (CR-02) (EN-13-T6)", async () => {
    const first = approval({ layoutCapacity: 10 });
    await handleMessage(first.value, { sql });
    await claimSeat(sql, { eventId: first.eventId, pool: "PUBLIC", attendeeId: randomUUID() });
    const second = approval({ layoutCapacity: 6, eventId: first.eventId, replacedBookingId: first.bookingId });
    expect(await handleMessage(second.value, { sql })).toEqual({ outcome: "built", seats: 6, retired: 9 });
    expect(await seatCounts(sql, first.eventId)).toEqual({ PUBLIC: { free: 6, claimed: 1 }, VIP: { free: 0, claimed: 0 } });
  });

  it("gives an event with two venues the total of their seats (CQ-04) (EN-13-T5)", async () => {
    const first = approval({ layoutCapacity: 30 });
    const second = approval({ layoutCapacity: 20, eventId: first.eventId });
    await handleMessage(first.value, { sql });
    await handleMessage(second.value, { sql });
    expect((await seatCounts(sql, first.eventId)).PUBLIC.free).toBe(50);
  });
});
