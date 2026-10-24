import { describe, expect, it } from "vitest";
import {
  bookingConflictMessage,
  NOT_VENUE_STAFF,
  readRejection,
  singaporePeriod,
  unavailableMessage,
} from "../../../src/modules/venue/domain/bookingDecision.js";

/** M1, M2 — a decision's rules: what a rejection needs, and how a refused approval is explained. */

/** A time on Wednesday 2 Dec 2026, Singapore time, as a UTC instant. */
const at = (hhmm: string, day = "02") => new Date(`2026-12-${day}T${hhmm}:00+08:00`).toISOString();

describe("readRejection (M2-T1, M2-T3)", () => {
  it("takes a trimmed reason, and a trimmed suggestion or none", () => {
    expect(readRejection({ reason: "  Closed for exams  ", suggestion: "  Seminar Room 2-1 " })).toEqual({
      ok: true,
      reason: "Closed for exams",
      suggestion: "Seminar Room 2-1",
    });
    expect(readRejection({ reason: "X" })).toEqual({ ok: true, reason: "X", suggestion: null });
    expect(readRejection({ reason: "X", suggestion: "   " })).toEqual({ ok: true, reason: "X", suggestion: null });
    expect(readRejection({ reason: "X", suggestion: null })).toEqual({ ok: true, reason: "X", suggestion: null });
  });

  it("refuses a missing, empty or blank reason", () => {
    const required = { ok: false, fields: [{ field: "reason", message: "Enter the reason for rejecting the request." }] };
    for (const reason of [undefined, "", "   ", "\n\t", 42]) {
      expect(readRejection({ reason }), String(reason)).toEqual(required);
    }
  });

  it("refuses a reason or suggestion over 1000 characters, and a suggestion that isn't text", () => {
    expect(readRejection({ reason: "x".repeat(1000) }).ok).toBe(true);
    expect(readRejection({ reason: "x".repeat(1001) })).toEqual({
      ok: false,
      fields: [{ field: "reason", message: "Keep the reason to 1000 characters or fewer." }],
    });
    expect(readRejection({ reason: "X", suggestion: "y".repeat(1000) }).ok).toBe(true);
    expect(readRejection({ reason: "X", suggestion: "y".repeat(1001) })).toEqual({
      ok: false,
      fields: [{ field: "suggestion", message: "Keep the suggestion to 1000 characters or fewer." }],
    });
    expect(readRejection({ reason: "X", suggestion: 7 })).toEqual({
      ok: false,
      fields: [{ field: "suggestion", message: "The suggestion must be text." }],
    });
    expect(readRejection({ reason: "", suggestion: 7 })).toMatchObject({ ok: false, fields: [{ field: "reason" }, { field: "suggestion" }] });
  });

  it("refuses a body that isn't an object", () => {
    for (const body of [null, "reason", [], undefined]) {
      expect(readRejection(body)).toEqual({ ok: false, fields: [{ field: "body", message: "Send the rejection as a JSON object." }] });
    }
  });
});

describe("singaporePeriod", () => {
  it("names the day once when the period is within it", () => {
    expect(singaporePeriod(at("13:00"), at("15:00"))).toBe("Wednesday 2 December 2026, 13:00–15:00");
  });

  it("names both days when the period crosses midnight", () => {
    expect(singaporePeriod(at("22:00"), at("01:00", "03"))).toBe("Wednesday 2 December 2026 22:00 to Thursday 3 December 2026 01:00");
  });

  it("names only the start, and says it is open-ended, when there is no end (I5)", () => {
    expect(singaporePeriod(at("13:00"), null)).toBe("from Wednesday 2 December 2026, 13:00, open-ended");
  });
});

describe("bookingConflictMessage (M1-T4, M1-T6)", () => {
  const confirmed = (eventReference: string | null, from: string, until: string) => ({
    eventReference,
    status: "CONFIRMED" as const,
    occupiedFrom: at(from),
    occupiedUntil: at(until),
  });

  it("names the other event and its occupied period, and says nothing was approved", () => {
    expect(bookingConflictMessage("BKR-000001", "Lee Kong Chian Auditorium", [confirmed("EVT-000456", "09:30", "12:45")])).toBe(
      "BKR-000001 wasn't approved: Lee Kong Chian Auditorium is already booked for EVT-000456 " +
        "(Wednesday 2 December 2026, 09:30–12:45), counting setup and turnaround time. " +
        "Nothing was approved, and the request is still Pending.",
    );
  });

  it("names every booking and hold it overlaps", () => {
    const message = bookingConflictMessage("BKR-000001", "Hall", [
      confirmed("EVT-000001", "13:00", "15:00"),
      { eventReference: "EVT-000002", status: "HELD", occupiedFrom: at("15:00"), occupiedUntil: at("16:00") },
    ]);
    expect(message).toContain(
      "Hall is already booked for EVT-000001 (Wednesday 2 December 2026, 13:00–15:00) and held for EVT-000002 (Wednesday 2 December 2026, 15:00–16:00),",
    );
  });

  it("joins three or more with commas", () => {
    const message = bookingConflictMessage("BKR-000001", "Hall", [
      confirmed("EVT-000001", "10:00", "11:00"),
      confirmed("EVT-000002", "11:00", "12:00"),
      confirmed("EVT-000003", "12:00", "13:00"),
    ]);
    expect(message).toContain("EVT-000001 (Wednesday 2 December 2026, 10:00–11:00), booked for EVT-000002");
    expect(message).toContain("11:00–12:00) and booked for EVT-000003");
  });

  it("says another event when the event has no reference", () => {
    expect(bookingConflictMessage("BKR-000001", "Hall", [confirmed(null, "13:00", "15:00")])).toContain("already booked for another event (");
  });

  it("still refuses when the overlapped booking was released before it could be named", () => {
    expect(bookingConflictMessage("BKR-000001", "Hall", [])).toBe(
      "BKR-000001 wasn't approved: the period overlaps another booking at Hall, counting setup and turnaround time. " +
        "Nothing was approved, and the request is still Pending.",
    );
  });
});

describe("unavailableMessage (M1-T5)", () => {
  const block = (reasonType: "MAINTENANCE" | "SAFETY", description: string, from: string, until: string) => ({
    reasonType,
    description,
    startsAt: at(from),
    endsAt: at(until),
  });

  it("names the unavailability's type, reason and period, and says nothing was approved", () => {
    expect(unavailableMessage("BKR-000001", "Lee Kong Chian Auditorium", [block("MAINTENANCE", "Stage rigging inspection", "16:00", "19:00")])).toBe(
      "BKR-000001 wasn't approved: Lee Kong Chian Auditorium is unavailable for Maintenance, “Stage rigging inspection” " +
        "(Wednesday 2 December 2026, 16:00–19:00). Nothing was approved, and the request is still Pending.",
    );
  });

  it("names a block with no end by its start, as open-ended (I5)", () => {
    expect(unavailableMessage("BKR-000001", "Hall", [{ reasonType: "MAINTENANCE", description: "Roof leak repair", startsAt: at("13:00"), endsAt: null }])).toBe(
      "BKR-000001 wasn't approved: Hall is unavailable for Maintenance, “Roof leak repair” " +
        "(from Wednesday 2 December 2026, 13:00, open-ended). Nothing was approved, and the request is still Pending.",
    );
  });

  it("names every block it overlaps", () => {
    const message = unavailableMessage("BKR-000001", "Hall", [
      block("MAINTENANCE", "Rigging", "13:00", "15:00"),
      block("SAFETY", "Fire drill", "16:00", "17:00"),
    ]);
    expect(message).toContain("Maintenance, “Rigging” (Wednesday 2 December 2026, 13:00–15:00) and Safety concern, “Fire drill” (");
  });
});

describe("NOT_VENUE_STAFF (M1-T11, M2-T7)", () => {
  it("says only the venue's Venue Staff decide its requests", () => {
    expect(NOT_VENUE_STAFF).toBe("Only the venue's Venue Staff can decide its requests.");
  });
});
