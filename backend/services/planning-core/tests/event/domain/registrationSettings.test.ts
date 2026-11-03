import { describe, expect, it } from "vitest";
import {
  changedSettings,
  DEADLINE_AFTER_START_MESSAGE,
  maySetRegistration,
  notSettableMessage,
  readRegistrationSettings,
  registrationSettableIn,
  type RegistrationSettings,
} from "../../../src/modules/event/domain/registrationSettings.js";
import { REGISTRATION_AFTER_START_MESSAGE } from "../../../src/modules/event/domain/validation.js";

/**
 * R2, R4 — the rules for the registration settings the organiser sets: the
 * window (R2) and the withdrawal deadline (R4), checked against the event's
 * start. Every field that is wrong is named, not only the first (B2).
 */

const START = "2026-12-02T06:00:00.000Z"; // 2 December 2026, 14:00 Singapore time
const valid = {
  registrationRequired: true,
  registrationOpensAt: "2026-12-01T01:00:00.000Z",
  registrationClosesAt: "2026-12-02T04:00:00.000Z",
  withdrawalDeadlineAt: "2026-12-02T05:00:00.000Z",
};

const fieldsOf = (body: unknown, start: string | null = START) => {
  const read = readRegistrationSettings(body, start);
  return read.ok ? [] : read.fields;
};

describe("readRegistrationSettings", () => {
  it("accepts a window that closes after it opens and by the start, with a deadline by the start (R2-T11, R4-T8)", () => {
    expect(readRegistrationSettings(valid, START)).toEqual({ ok: true, settings: valid });
  });

  it("stores instants in UTC with milliseconds, whatever offset they were sent in", () => {
    const read = readRegistrationSettings({ ...valid, registrationOpensAt: "2026-12-01T09:00:00+08:00" }, START);
    expect(read).toMatchObject({ ok: true, settings: { registrationOpensAt: "2026-12-01T01:00:00.000Z" } });
  });

  it("accepts no deadline, which leaves withdrawal open until the start (R4-T8 step 4)", () => {
    const read = readRegistrationSettings({ ...valid, withdrawalDeadlineAt: null }, START);
    expect(read).toEqual({ ok: true, settings: { ...valid, withdrawalDeadlineAt: null } });
    const absent: Record<string, unknown> = { ...valid };
    delete absent.withdrawalDeadlineAt;
    expect(readRegistrationSettings(absent, START)).toEqual({ ok: true, settings: { ...valid, withdrawalDeadlineAt: null } });
  });

  it("accepts turning registration off with an empty window and no deadline", () => {
    const off = { registrationRequired: false, registrationOpensAt: null, registrationClosesAt: null, withdrawalDeadlineAt: null };
    expect(readRegistrationSettings(off, START)).toEqual({ ok: true, settings: off });
    expect(readRegistrationSettings({ registrationRequired: false }, START)).toEqual({ ok: true, settings: off });
  });

  it("refuses a closing before or equal to the opening (R2-T11 step 2)", () => {
    for (const closes of ["2026-11-30T01:00:00.000Z", valid.registrationOpensAt]) {
      expect(fieldsOf({ ...valid, registrationClosesAt: closes })).toEqual([
        { field: "registrationClosesAt", message: "Registration closing must be later than registration opening." },
      ]);
    }
  });

  it("accepts a closing exactly at the start and refuses one a millisecond after (B2's rule, R2)", () => {
    expect(fieldsOf({ ...valid, registrationClosesAt: START, withdrawalDeadlineAt: null })).toEqual([]);
    expect(fieldsOf({ ...valid, registrationClosesAt: "2026-12-02T06:00:00.001Z" })).toEqual([
      { field: "registrationClosesAt", message: REGISTRATION_AFTER_START_MESSAGE },
    ]);
  });

  it("accepts a deadline exactly at the start and refuses one a millisecond after (R4-T8 step 2)", () => {
    expect(fieldsOf({ ...valid, withdrawalDeadlineAt: START })).toEqual([]);
    expect(fieldsOf({ ...valid, withdrawalDeadlineAt: "2026-12-02T06:00:00.001Z" })).toEqual([
      { field: "withdrawalDeadlineAt", message: DEADLINE_AFTER_START_MESSAGE },
    ]);
  });

  it("requires the opening and the closing when registration is required, naming both", () => {
    expect(fieldsOf({ registrationRequired: true })).toEqual([
      { field: "registrationOpensAt", message: "Registration opening date and time is required when registration is required." },
      { field: "registrationClosesAt", message: "Registration closing date and time is required when registration is required." },
    ]);
  });

  it("compares nothing with the start when the event has none", () => {
    expect(fieldsOf({ ...valid, registrationClosesAt: "2031-01-01T00:00:00.000Z", withdrawalDeadlineAt: "2031-01-01T00:00:00.000Z" }, null)).toEqual([]);
  });

  it("refuses a window or deadline when attendees don't register, naming each", () => {
    expect(fieldsOf({ ...valid, registrationRequired: false })).toEqual([
      { field: "registrationOpensAt", message: "Leave this empty when attendees don't register for the event." },
      { field: "registrationClosesAt", message: "Leave this empty when attendees don't register for the event." },
      { field: "withdrawalDeadlineAt", message: "Leave this empty when attendees don't register for the event." },
    ]);
  });

  it("names every field that is not a date and time, an unknown field, and a missing yes or no, all at once", () => {
    expect(
      fieldsOf({ registrationRequired: "yes", registrationOpensAt: "next Tuesday", registrationClosesAt: 5, withdrawalDeadlineAt: " ", venue: "x" }),
    ).toEqual([
      { field: "venue", message: "This field can't be set here." },
      { field: "registrationRequired", message: "Say whether attendees register for this event: true or false." },
      { field: "registrationOpensAt", message: "Give a date and time, such as 2026-12-01T09:00:00+08:00." },
      { field: "registrationClosesAt", message: "Give a date and time, such as 2026-12-01T09:00:00+08:00." },
      { field: "withdrawalDeadlineAt", message: "Give a date and time, such as 2026-12-01T09:00:00+08:00." },
    ]);
  });

  it("refuses a body that is not an object", () => {
    for (const body of [null, [valid], "settings", 3]) {
      expect(fieldsOf(body)).toEqual([{ field: "body", message: "Send the registration settings as a JSON object." }]);
    }
  });
});

describe("who and when", () => {
  it("lets only the owning organiser set them (R2-T11 step 4)", () => {
    const event = { ownerId: "owner" };
    expect(maySetRegistration({ userId: "owner", role: "EVENT_ORGANISER" }, event)).toBe(true);
    expect(maySetRegistration({ userId: "someone", role: "EVENT_ORGANISER" }, event)).toBe(false);
    expect(maySetRegistration({ userId: "owner", role: "EVENT_COORDINATOR" }, event)).toBe(false);
  });

  it("allows them from approval until the event is over, as G1's details are", () => {
    for (const status of ["APPROVED", "PLANNING", "SAFETY_REVIEW", "CONFIRMED"] as const) expect(registrationSettableIn(status)).toBe(true);
    for (const status of ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "AWAITING_CLARIFICATION", "COMPLETED", "CANCELLED", "REJECTED"] as const) {
      expect(registrationSettableIn(status)).toBe(false);
    }
    expect(notSettableMessage("CANCELLED")).toBe(
      "Registration settings can be changed only while the event is Approved, Planning, Safety Review or Confirmed. It is Cancelled.",
    );
  });
});

describe("changedSettings", () => {
  const current: RegistrationSettings = { ...valid, withdrawalDeadlineAt: null };

  it("records each changed setting with its before and after, as text", () => {
    const next = { ...current, registrationRequired: false, registrationOpensAt: null, withdrawalDeadlineAt: "2026-12-02T05:00:00.000Z" };
    expect(changedSettings(current, next)).toEqual([
      { fieldName: "registrationRequired", previousValue: "true", newValue: "false" },
      { fieldName: "registrationOpensAt", previousValue: valid.registrationOpensAt, newValue: null },
      { fieldName: "withdrawalDeadlineAt", previousValue: null, newValue: "2026-12-02T05:00:00.000Z" },
    ]);
  });

  it("records nothing when nothing changed", () => {
    expect(changedSettings(current, { ...current })).toEqual([]);
  });
});
