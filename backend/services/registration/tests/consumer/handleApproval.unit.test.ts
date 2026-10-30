import { describe, expect, it } from "vitest";
import type { Sql } from "postgres";
import { handleMessage } from "../../src/consumer/handleApproval.js";
import { consumerGroup } from "../../src/consumer/kafkaMessages.js";

/**
 * EN-13: the paths of the seat builder that never reach the database. Seats built,
 * a redelivery and a replaced booking are in handleApproval.test.ts.
 */

/** A database that fails the test if anything uses it. */
const noDatabase = new Proxy(() => undefined, {
  get() {
    throw new Error("the database was used");
  },
  apply() {
    throw new Error("the database was used");
  },
}) as unknown as Sql;

const message = (type: string, data: Record<string, unknown>) =>
  JSON.stringify({
    specversion: "1.0",
    id: "44444444-4444-4444-8444-444444444444",
    source: "/connectsphere/planning-core/venue",
    type,
    subject: "11111111-1111-4111-8111-111111111111",
    time: "2026-10-18T02:00:00.000Z",
    datacontenttype: "application/json",
    traceparent: "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01",
    actor: "VENUE_STAFF:00000000-0000-0000-0000-000000000003",
    data,
  });

const approved = {
  bookingRequestId: "11111111-1111-4111-8111-111111111111",
  reference: "BKR-000001",
  eventId: "22222222-2222-4222-8222-222222222222",
  eventReference: "EVT-000123",
  eventName: "Annual Research Symposium",
  venueId: "33333333-3333-4333-8333-333333333333",
  venueName: "Lee Kong Chian Auditorium",
  startsAt: "2026-12-02T06:00:00.000Z",
  endsAt: "2026-12-02T10:00:00.000Z",
  coordinatorId: "00000000-0000-0000-0000-000000000002",
  ownerId: "00000000-0000-0000-0000-000000000001",
  decidedBy: "00000000-0000-0000-0000-000000000003",
  decidedAt: "2026-10-18T02:00:00.000Z",
  bookingId: "55555555-5555-4555-8555-555555555555",
  replacedBookingId: null,
};

describe("handleMessage (the seat builder)", () => {
  it("skips a message that is not JSON, and one that fails validation, without touching the database (EN-13-T8)", async () => {
    expect((await handleMessage("not json", { sql: noDatabase })).outcome).toBe("invalid");
    expect((await handleMessage(null, { sql: noDatabase })).outcome).toBe("invalid");
    expect((await handleMessage(message("venue-booking.request-approved", { bookingId: "x" }), { sql: noDatabase })).outcome).toBe("invalid");
  });

  it("ignores a message that is not an approval (EN-13-T8)", async () => {
    const rejected = { ...approved, reason: "Closed", suggestion: null };
    expect(await handleMessage(message("venue-booking.request-rejected", rejected), { sql: noDatabase })).toEqual({
      outcome: "ignored",
      reason: "other-type",
    });
  });

  it("ignores an approval that names no layout capacity (EN-13-T7)", async () => {
    expect(await handleMessage(message("venue-booking.request-approved", approved), { sql: noDatabase })).toEqual({
      outcome: "ignored",
      reason: "no-layout-capacity",
    });
  });
});

describe("consumerGroup", () => {
  it("names the group connectsphere.registration.<consumer> (implementation.md §3.1)", () => {
    expect(consumerGroup("seat-builder", "")).toBe("connectsphere.registration.seat-builder");
  });

  it("appends the laptop's suffix so a local consumer never takes a teammate's partitions", () => {
    expect(consumerGroup("seat-builder", "dev-yc")).toBe("connectsphere.registration.seat-builder.dev-yc");
  });
});
