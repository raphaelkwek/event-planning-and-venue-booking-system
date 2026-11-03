import { afterAll, afterEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { handleListingMessage } from "../../src/consumer/handleListing.js";
import { findListing } from "../../src/repo/listings.js";
import { cleanUp, listingMessage, track } from "../support/fixtures.js";

/**
 * R1 — the event-listings consumer keeps the service's copy of each event from
 * planning-core's event.listing-changed, against the real registration schema
 * (implementation.md §3.5). Kafka is not involved: what is tested is what the
 * consumer runs for each message. The paths that never reach the database are
 * in handleListing.unit.test.ts.
 */

const sql = postgres(process.env.DATABASE_URL!, { max: 4, prepare: false });

afterEach(() => cleanUp(sql));
afterAll(() => sql.end());

describe("handleListingMessage", () => {
  it("records an event's published fields and registration settings from its first listing", async () => {
    const eventId = randomUUID();
    track(eventId);

    expect(await handleListingMessage(listingMessage(eventId, "EVT-000901", { deadline: null }), { sql })).toEqual({
      outcome: "applied",
      stale: false,
      cancelled: 0,
    });

    expect(await findListing(sql, eventId)).toEqual({
      eventId,
      eventReference: "EVT-000901",
      name: "R Test Symposium",
      description: "A one-day symposium for the school of computing.",
      ownerId: "00000000-0000-0000-0000-000000000001",
      // R5, R7: who may see the registrations and add attendees, besides the owner.
      assignedCoordinatorId: "00000000-0000-0000-0000-000000000002",
      status: "CONFIRMED",
      startsAt: "2026-12-16T06:00:00.000Z",
      endsAt: "2026-12-16T10:00:00.000Z",
      registrationRequired: true,
      registrationOpensAt: "2026-12-01T01:00:00.000Z",
      registrationClosesAt: "2026-12-10T10:00:00.000Z",
      withdrawalDeadlineAt: null,
    });
  });

  it("R5, R7 takes a change of coordinator from a newer snapshot, and none from one written before the field", async () => {
    const eventId = randomUUID();
    track(eventId);
    const newCoordinator = randomUUID();

    await handleListingMessage(listingMessage(eventId, "EVT-000902", { changedAt: "2026-11-20T00:00:00.000Z" }), { sql });
    await handleListingMessage(listingMessage(eventId, "EVT-000902", { changedAt: "2026-11-21T00:00:00.000Z", coordinatorId: newCoordinator }), { sql });
    expect((await findListing(sql, eventId))!.assignedCoordinatorId).toBe(newCoordinator);

    const before = JSON.parse(listingMessage(eventId, "EVT-000902", { changedAt: "2026-11-22T00:00:00.000Z" })) as { data: Record<string, unknown> };
    delete before.data.assignedCoordinatorId;
    await handleListingMessage(JSON.stringify(before), { sql });
    expect((await findListing(sql, eventId))!.assignedCoordinatorId).toBeNull();
  });

  it("replaces it with a newer snapshot, and ignores an older one delivered late", async () => {
    const eventId = randomUUID();
    track(eventId);
    await handleListingMessage(listingMessage(eventId, "EVT-000902", { name: "First", changedAt: "2026-11-01T00:00:00.000Z" }), { sql });

    const newer = await handleListingMessage(listingMessage(eventId, "EVT-000902", { name: "Second", changedAt: "2026-11-02T00:00:00.000Z" }), { sql });
    const older = await handleListingMessage(listingMessage(eventId, "EVT-000902", { name: "Stale", changedAt: "2026-11-01T12:00:00.000Z" }), { sql });

    expect(newer).toEqual({ outcome: "applied", stale: false, cancelled: 0 });
    expect(older).toEqual({ outcome: "applied", stale: true, cancelled: 0 });
    expect((await findListing(sql, eventId))!.name).toBe("Second");
  });

  it("applies a redelivered message once, recording it in the inbox", async () => {
    const eventId = randomUUID();
    track(eventId);
    const message = listingMessage(eventId, "EVT-000903");
    const id = JSON.parse(message).id as string;

    await handleListingMessage(message, { sql });
    expect(await handleListingMessage(message, { sql })).toEqual({ outcome: "duplicate" });
    const rows = await sql`select consumer from registration.consumed_messages where message_id = ${id}`;
    expect(rows.map((r) => r.consumer)).toEqual(["registration.event-listings"]);
  });

  it("never brings a cancelled event back, whatever a later message says", async () => {
    const eventId = randomUUID();
    track(eventId);
    await handleListingMessage(listingMessage(eventId, "EVT-000904", { status: "CANCELLED", changedAt: "2026-11-01T00:00:00.000Z" }), { sql });

    expect(await handleListingMessage(listingMessage(eventId, "EVT-000904", { status: "CONFIRMED", changedAt: "2026-11-03T00:00:00.000Z" }), { sql })).toMatchObject({
      stale: true,
    });
    expect((await findListing(sql, eventId))!.status).toBe("CANCELLED");
  });
});
