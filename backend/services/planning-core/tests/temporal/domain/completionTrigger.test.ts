import { describe, expect, it } from "vitest";
import { completeEventWorkflowId, completionScheduleFor } from "../../../src/temporal/domain/completionTrigger.js";

/** EN-11 — which event messages start or reset an event's CompleteEvent workflow (ADR-0009). */

const eventId = "6f1c2a4e-8b1d-4c3a-9e2f-1a2b3c4d5e6f";
const end = "2026-11-20T09:00:00.000Z";

const statusChanged = (data: Record<string, unknown>) => ({
  type: "event.status-changed",
  data: { eventId, previousStatus: "SAFETY_REVIEW", newStatus: "CONFIRMED", proposedEndAt: end, ...data },
});
const scheduleChanged = (data: Record<string, unknown>) => ({
  type: "event.schedule-changed",
  data: { eventId, status: "CONFIRMED", proposedEndAt: end, ...data },
});

describe("completeEventWorkflowId", () => {
  it("names one workflow per event", () => {
    expect(completeEventWorkflowId(eventId)).toBe(`complete-event-${eventId}`);
  });
});

describe("completionScheduleFor", () => {
  it("starts the timer when an event becomes Confirmed, for its end", () => {
    expect(completionScheduleFor(statusChanged({}))).toEqual({ eventId, endsAt: end });
  });

  it.each(["SAFETY_REVIEW", "PLANNING", "COMPLETED", "CANCELLED"])("ignores a move to %s", (newStatus) => {
    expect(completionScheduleFor(statusChanged({ newStatus }))).toBeNull();
  });

  it("ignores a status change that leaves Confirmed, which the workflow finds for itself", () => {
    expect(completionScheduleFor(statusChanged({ previousStatus: "CONFIRMED", newStatus: "COMPLETED" }))).toBeNull();
  });

  it("resets the timer when a Confirmed event's end moves", () => {
    const moved = "2026-11-21T09:00:00.000Z";
    expect(completionScheduleFor(scheduleChanged({ proposedEndAt: moved }))).toEqual({ eventId, endsAt: moved });
  });

  it("ignores a schedule change while the event is not yet Confirmed: the timer starts when it is", () => {
    expect(completionScheduleFor(scheduleChanged({ status: "PLANNING" }))).toBeNull();
  });

  it("ignores a Confirmed event without an end, which has nothing to wait for", () => {
    expect(completionScheduleFor(statusChanged({ proposedEndAt: null }))).toBeNull();
    expect(completionScheduleFor(scheduleChanged({ proposedEndAt: null }))).toBeNull();
  });

  it("ignores a message without an event id", () => {
    expect(completionScheduleFor(statusChanged({ eventId: undefined }))).toBeNull();
  });

  it("ignores every other message type, even one that mentions Confirmed", () => {
    expect(completionScheduleFor({ type: "event.approved", data: { eventId, newStatus: "CONFIRMED", status: "CONFIRMED", proposedEndAt: end } })).toBeNull();
    expect(completionScheduleFor({ type: "equipment-request.line-status-changed", data: { eventId, newStatus: "CONFIRMED", proposedEndAt: end } })).toBeNull();
  });
});
