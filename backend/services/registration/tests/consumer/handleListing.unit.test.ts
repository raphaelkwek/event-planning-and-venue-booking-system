import { describe, expect, it } from "vitest";
import type { Sql } from "postgres";
import { handleListingMessage } from "../../src/consumer/handleListing.js";

/** R1 — the paths of the event-listings consumer that never reach the database. */

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
    source: "/connectsphere/planning-core/event",
    type,
    subject: "22222222-2222-4222-8222-222222222222",
    time: "2026-10-18T02:00:00.000Z",
    datacontenttype: "application/json",
    traceparent: "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01",
    actor: "EVENT_ORGANISER:00000000-0000-0000-0000-000000000001",
    data,
  });

describe("handleListingMessage without a database", () => {
  it("skips the event messages it has no use for", async () => {
    const approved = {
      eventId: "22222222-2222-4222-8222-222222222222",
      eventReference: "EVT-000123",
      eventName: "R Test Symposium",
      ownerId: "00000000-0000-0000-0000-000000000001",
      approvedBy: "00000000-0000-0000-0000-000000000002",
      approvedAt: "2026-10-18T02:00:00.000Z",
    };
    expect(await handleListingMessage(message("event.approved", approved), { sql: noDatabase })).toEqual({ outcome: "ignored", reason: "other-type" });
  });

  it("reports a message that is not JSON, not a CloudEvent, or whose data fails its contract", async () => {
    for (const value of [null, "{not json", JSON.stringify({ hello: "world" }), message("event.listing-changed", { eventId: "x" })]) {
      expect((await handleListingMessage(value, { sql: noDatabase })).outcome).toBe("invalid");
    }
  });
});
