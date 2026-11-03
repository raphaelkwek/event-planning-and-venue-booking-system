import { describe, expect, it } from "vitest";
import {
  admissionExpiredMessage,
  admissionRequiredMessage,
  capacityMessage,
  deadlineMessage,
  duplicateMessage,
  eventLabel,
  notActiveMessage,
  singaporeMoment,
  waitingRoomNotRequiredMessage,
  windowMessage,
} from "../../src/domain/refusals.js";

/** R2, R4 — every refusal names its cause, in Singapore time. */

const event = { reference: "EVT-000123", name: "R Test Symposium" };

describe("the refusal messages", () => {
  it("label the event by reference and name", () => {
    expect(eventLabel(event)).toBe("EVT-000123 “R Test Symposium”");
  });

  it("give instants in Singapore time", () => {
    expect(singaporeMoment("2026-12-01T01:00:00.000Z")).toBe("Tuesday 1 December 2026, 09:00");
    expect(singaporeMoment("2026-12-16T15:30:00.000Z")).toBe("Wednesday 16 December 2026, 23:30");
  });

  it("R2-T4 name capacity and offer the waitlist", () => {
    expect(capacityMessage(event)).toBe(
      "EVT-000123 “R Test Symposium” has no places remaining, so you were not registered. You can ask for a place on the waitlist instead.",
    );
  });

  it("R2-T6 name the existing registration", () => {
    expect(duplicateMessage(event, "REG-000042")).toBe(
      "You are already registered for EVT-000123 “R Test Symposium” (registration REG-000042), so no second registration was made.",
    );
  });

  it("R2-T8 R2-T10 name the window, before it opens and after it closes", () => {
    const opens = "2026-12-01T01:00:00.000Z";
    const closes = "2026-12-10T10:00:00.000Z";
    expect(windowMessage(event, "NOT_YET_OPEN", opens, closes)).toBe(
      "Registration for EVT-000123 “R Test Symposium” opens on Tuesday 1 December 2026, 09:00 and closes on Thursday 10 December 2026, 18:00, so you cannot register now.",
    );
    expect(windowMessage(event, "CLOSED", opens, closes)).toBe(
      "Registration for EVT-000123 “R Test Symposium” opened on Tuesday 1 December 2026, 09:00 and closed on Thursday 10 December 2026, 18:00, so you can no longer register.",
    );
  });

  it("say registration is not open when the window has no end to name", () => {
    expect(windowMessage(event, "CLOSED", null, "2026-12-10T10:00:00.000Z")).toBe(
      "Registration for EVT-000123 “R Test Symposium” is not open, so you cannot register.",
    );
    expect(windowMessage(event, "CLOSED", "2026-12-01T01:00:00.000Z", null)).toBe(
      "Registration for EVT-000123 “R Test Symposium” is not open, so you cannot register.",
    );
  });

  it("R4-T6 R4-T7 name the deadline, or the event's start when it was the deadline", () => {
    expect(deadlineMessage(event, "REG-000042", { at: "2026-12-14T10:00:00.000Z", isEventStart: false })).toBe(
      "The withdrawal deadline for EVT-000123 “R Test Symposium” was Monday 14 December 2026, 18:00, so registration REG-000042 can no longer be withdrawn.",
    );
    expect(deadlineMessage(event, "REG-000042", { at: "2026-12-16T06:00:00.000Z", isEventStart: true })).toBe(
      "The withdrawal deadline for EVT-000123 “R Test Symposium” was its start, Wednesday 16 December 2026, 14:00, so registration REG-000042 can no longer be withdrawn.",
    );
  });

  it("R4-T4 name the registration and its status when it is not Registered", () => {
    expect(notActiveMessage("REG-000042", "WITHDRAWN")).toBe("Registration REG-000042 is Withdrawn, so it cannot be withdrawn.");
    expect(notActiveMessage("REG-000042", "CANCELLED")).toBe("Registration REG-000042 is Cancelled, so it cannot be withdrawn.");
  });

  it("EN-19-T4 say a high-demand event needs the waiting room first, naming the event", () => {
    expect(admissionRequiredMessage(event)).toBe(
      `${eventLabel(event)} is a high-demand event, so you must join its waiting room and be admitted before you can register. Nothing was changed.`,
    );
  });

  it("EN-19-T8 say the attendee's turn has passed and to join again", () => {
    expect(admissionExpiredMessage(event)).toBe(
      `Your turn to register for ${eventLabel(event)} has passed. Join the waiting room again for a new place in the queue. Nothing was changed.`,
    );
  });

  it("EN-19-T10 say an event that is not high-demand has no waiting room", () => {
    expect(waitingRoomNotRequiredMessage(event)).toBe(
      `${eventLabel(event)} is not a high-demand event, so it has no waiting room. You can register for it directly.`,
    );
  });
});
