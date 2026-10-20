import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { HoldExpirySchedule } from "../../src/temporal/domain/holdExpiryTrigger.js";
import { consumerGroup, handleHoldExpiryMessage } from "../../src/temporal/holdExpiryConsumer.js";

/**
 * L6 — the consumer that starts and resets HoldExpiry from the venue-booking
 * topic (ADR-0008, ADR-0009). No Kafka here: the handler is given a message's
 * value, as kafkajs would, and the scheduler is a fake.
 */

function message(type: string, data: Record<string, unknown>, holdId = data.holdId as string): string {
  return JSON.stringify({
    specversion: "1.0",
    id: randomUUID(),
    source: "/connectsphere/planning-core/venue",
    type,
    subject: holdId,
    time: "2026-10-21T08:00:00.000Z",
    datacontenttype: "application/json",
    traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
    actor: "SYSTEM",
    data,
  });
}

const base = () => ({
  holdId: randomUUID(),
  holdReference: "HLD-000001",
  venueId: randomUUID(),
  expiresAt: "2026-11-20T09:00:00.000Z",
});

function fakeScheduler() {
  const scheduled: HoldExpirySchedule[] = [];
  return { scheduled, schedule: async (s: HoldExpirySchedule) => void scheduled.push(s) };
}

describe("consumerGroup", () => {
  it("is planning-core's hold-expiry group, with the laptop's suffix when there is one (§3.1)", () => {
    expect(consumerGroup("")).toBe("connectsphere.planning-core.hold-expiry");
    expect(consumerGroup("dev-cyc")).toBe("connectsphere.planning-core.hold-expiry.dev-cyc");
  });
});

describe("handleHoldExpiryMessage", () => {
  it("schedules the expiry of a placed hold", async () => {
    const scheduler = fakeScheduler();
    const data = { ...base(), eventId: randomUUID(), reminderLeadMinutes: 60 };

    const outcome = await handleHoldExpiryMessage(message("venue-booking.hold-placed", data), scheduler);

    expect(outcome).toEqual({ outcome: "scheduled", holdId: data.holdId });
    expect(scheduler.scheduled).toEqual([{ holdId: data.holdId, expiresAt: data.expiresAt, reminderLeadMinutes: 60 }]);
  });

  it("reschedules a hold whose expiry Venue Staff changed", async () => {
    const scheduler = fakeScheduler();
    const data = { ...base(), reminderLeadMinutes: 90, changedBy: randomUUID() };

    const outcome = await handleHoldExpiryMessage(message("venue-booking.hold-expiry-changed", data), scheduler);

    expect(outcome).toEqual({ outcome: "scheduled", holdId: data.holdId });
    expect(scheduler.scheduled).toEqual([{ holdId: data.holdId, expiresAt: data.expiresAt, reminderLeadMinutes: 90 }]);
  });

  it("ignores a message the workflow has no business with", async () => {
    const scheduler = fakeScheduler();
    const data = {
      ...base(),
      venueName: "Great Hall",
      eventId: randomUUID(),
      eventReference: "EVT-1",
      eventName: "Orientation",
      coordinatorId: randomUUID(),
      startsAt: "2026-12-01T09:00:00.000Z",
      endsAt: "2026-12-01T17:00:00.000Z",
    };

    expect(await handleHoldExpiryMessage(message("venue-booking.hold-expired", data), scheduler)).toEqual({ outcome: "ignored" });
    expect(scheduler.scheduled).toEqual([]);
  });

  it.each([
    ["not JSON", "{"],
    ["empty", null],
    ["not a CloudEvent", JSON.stringify({ hello: "world" })],
    ["data that fails its type's schema", message("venue-booking.hold-placed", { holdId: randomUUID() })],
  ])("skips a message that is %s, saying why, because a retry can't fix it", async (_label, value) => {
    const scheduler = fakeScheduler();

    const outcome = await handleHoldExpiryMessage(value, scheduler);

    expect(outcome.outcome).toBe("invalid");
    expect(scheduler.scheduled).toEqual([]);
  });

  it("lets a Temporal failure propagate, so kafkajs delivers the message again", async () => {
    const failing = {
      schedule: async () => {
        throw new Error("Temporal unreachable");
      },
    };
    const data = { ...base(), eventId: randomUUID(), reminderLeadMinutes: 60 };

    await expect(handleHoldExpiryMessage(message("venue-booking.hold-placed", data), failing)).rejects.toThrow("Temporal unreachable");
  });
});
