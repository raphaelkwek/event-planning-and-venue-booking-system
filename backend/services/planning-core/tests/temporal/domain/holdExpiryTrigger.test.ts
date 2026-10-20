import { describe, expect, it } from "vitest";
import { holdExpiryScheduleFor, holdExpiryWorkflowId } from "../../../src/temporal/domain/holdExpiryTrigger.js";

/** L6 — which venue-booking messages start or reset a hold's HoldExpiry workflow (ADR-0009). */

const holdId = "6f1c2a4e-8b1d-4c3a-9e2f-1a2b3c4d5e6f";
const expiresAt = "2026-11-20T09:00:00.000Z";

describe("holdExpiryWorkflowId", () => {
  it("names one workflow per hold", () => {
    expect(holdExpiryWorkflowId(holdId)).toBe(`hold-expiry-${holdId}`);
  });
});

describe("holdExpiryScheduleFor", () => {
  it("starts the timers when a hold is placed, with its lead time", () => {
    const message = { type: "venue-booking.hold-placed", data: { holdId, expiresAt, reminderLeadMinutes: 60 } };
    expect(holdExpiryScheduleFor(message)).toEqual({ holdId, expiresAt, reminderLeadMinutes: 60 });
  });

  it("resets the timers when the expiry changes; the message has no lead time", () => {
    const message = { type: "venue-booking.hold-expiry-changed", data: { holdId, expiresAt } };
    expect(holdExpiryScheduleFor(message)).toEqual({ holdId, expiresAt, reminderLeadMinutes: null });
  });

  it("ignores a placed hold without a lead time", () => {
    expect(holdExpiryScheduleFor({ type: "venue-booking.hold-placed", data: { holdId, expiresAt } })).toBeNull();
  });

  it.each(["venue-booking.hold-expiring", "venue-booking.hold-expired", "event.status-changed"])("ignores %s", (type) => {
    expect(holdExpiryScheduleFor({ type, data: { holdId, expiresAt, reminderLeadMinutes: 60 } })).toBeNull();
  });

  it.each([
    [{ expiresAt }],
    [{ holdId }],
    [{ holdId: 1, expiresAt }],
  ])("ignores a message without a hold id and expiry: %o", (data) => {
    expect(holdExpiryScheduleFor({ type: "venue-booking.hold-expiry-changed", data })).toBeNull();
  });
});
