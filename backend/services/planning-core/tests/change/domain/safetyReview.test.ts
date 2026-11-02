import { describe, expect, it } from "vitest";
import {
  NOT_ASSIGNED_TO_CONFIRM_MESSAGE,
  REASON_REQUIRED_MESSAGE,
  UNKNOWN_ARRANGEMENT_MESSAGE,
  flagReason,
  normaliseReason,
  outstandingFlagsMessage,
  parseDecision,
  reasonRequired,
  unknownArrangements,
} from "../../../src/modules/change/domain/safetyReview.js";

// U1 — the Safety Officer's decision, checked without a database. The API cards (tests/U1,
// u1Cards.test.ts) check the same rules end to end.

const B1 = "0f100000-0000-4000-8000-000000000011";
const R1 = "0f100000-0000-4000-8000-000000000012";

describe("reasonRequired (U1 AC3)", () => {
  it("is needed to request changes or to reject, and not to approve", () => {
    expect(reasonRequired("APPROVE")).toBe(false);
    expect(reasonRequired("REQUEST_CHANGES")).toBe(true);
    expect(reasonRequired("REJECT")).toBe(true);
  });
});

describe("normaliseReason", () => {
  it("trims a reason and treats blank, missing and non-text as none", () => {
    expect(normaliseReason("  Move the chairs  ")).toBe("Move the chairs");
    expect(normaliseReason("   ")).toBeNull();
    expect(normaliseReason("")).toBeNull();
    expect(normaliseReason(undefined)).toBeNull();
    expect(normaliseReason(null)).toBeNull();
    expect(normaliseReason(42)).toBeNull();
  });
});

describe("parseDecision", () => {
  it("accepts an approval with no reason", () => {
    expect(parseDecision({ decision: "APPROVE" })).toEqual({
      ok: true,
      value: { decision: "APPROVE", reason: null, bookingIds: [], reservationIds: [] },
    });
  });

  it("keeps an approval's reason, trimmed", () => {
    expect(parseDecision({ decision: "APPROVE", reason: " Exits checked " })).toMatchObject({ ok: true, value: { reason: "Exits checked" } });
  });

  it("accepts a request for changes naming arrangements, once each", () => {
    expect(
      parseDecision({ decision: "REQUEST_CHANGES", reason: "Move chairs", flagBookingIds: [B1, B1], flagReservationIds: [R1] }),
    ).toEqual({ ok: true, value: { decision: "REQUEST_CHANGES", reason: "Move chairs", bookingIds: [B1], reservationIds: [R1] } });
  });

  it("accepts a request for changes naming nothing, and a rejection with a reason", () => {
    expect(parseDecision({ decision: "REQUEST_CHANGES", reason: "Rework" })).toMatchObject({ ok: true });
    expect(parseDecision({ decision: "REJECT", reason: "Unsafe" })).toEqual({
      ok: true,
      value: { decision: "REJECT", reason: "Unsafe", bookingIds: [], reservationIds: [] },
    });
  });

  it.each([
    ["no reason", { decision: "REQUEST_CHANGES" }],
    ["a blank reason", { decision: "REQUEST_CHANGES", reason: "   " }],
    ["a null reason", { decision: "REJECT", reason: null }],
    ["no reason for a rejection", { decision: "REJECT" }],
  ])("refuses %s, naming the reason field", (_name, body) => {
    expect(parseDecision(body)).toEqual({ ok: false, fields: [{ field: "reason", message: REASON_REQUIRED_MESSAGE }] });
  });

  it("refuses an unknown decision and a missing body", () => {
    const unknown = parseDecision({ decision: "MAYBE" });
    expect(unknown).toMatchObject({ ok: false, fields: [{ field: "decision", message: "Choose approve, request changes or reject." }] });
    expect(parseDecision(undefined)).toMatchObject({ ok: false, fields: [{ field: "body" }] });
  });

  it("refuses an over-long reason and ids that are not UUIDs", () => {
    expect(parseDecision({ decision: "APPROVE", reason: "x".repeat(2001) })).toMatchObject({
      ok: false,
      fields: [{ field: "reason", message: "Keep the reason under 2000 characters." }],
    });
    expect(parseDecision({ decision: "REQUEST_CHANGES", reason: "r", flagBookingIds: ["nope"] })).toMatchObject({
      ok: false,
      fields: [{ field: "flagBookingIds.0" }],
    });
  });

  it("accepts the largest list of named arrangements and refuses one more", () => {
    const ids = (n: number) => Array.from({ length: n }, (_, i) => `0f100000-0000-4000-8000-${String(i).padStart(12, "0")}`);
    expect(parseDecision({ decision: "REQUEST_CHANGES", reason: "r", flagBookingIds: ids(50) })).toMatchObject({ ok: true });
    expect(parseDecision({ decision: "REQUEST_CHANGES", reason: "r", flagBookingIds: ids(51) })).toMatchObject({ ok: false });
    expect(parseDecision({ decision: "REQUEST_CHANGES", reason: "r", flagReservationIds: ids(51) })).toMatchObject({ ok: false });
  });

  it("refuses naming arrangements with an approval or a rejection of the arrangement as a whole (CQ-08)", () => {
    const message = "Name arrangements only when you request changes.";
    expect(parseDecision({ decision: "APPROVE", flagBookingIds: [B1] })).toEqual({ ok: false, fields: [{ field: "flagBookingIds", message }] });
    expect(parseDecision({ decision: "REJECT", reason: "Unsafe", flagReservationIds: [R1] })).toEqual({
      ok: false,
      fields: [{ field: "flagBookingIds", message }],
    });
  });
});

describe("unknownArrangements", () => {
  it("returns the named ids that are not among the available ones", () => {
    expect(unknownArrangements([B1, R1], [B1])).toEqual([R1]);
    expect(unknownArrangements([B1], [B1, R1])).toEqual([]);
    expect(unknownArrangements([], [B1])).toEqual([]);
    expect(UNKNOWN_ARRANGEMENT_MESSAGE).toMatch(/does not belong to this event/);
  });
});

describe("outstandingFlagsMessage (commit 259050d)", () => {
  it("is null when nothing is flagged", () => {
    expect(outstandingFlagsMessage([])).toBeNull();
  });

  it("names every flagged arrangement and its flag", () => {
    expect(
      outstandingFlagsMessage([
        { what: "booking", name: "BKR-000001 at U1 Hall", flag: "REQUIRES_RECONFIRMATION" },
        { what: "booking", name: "BKR-000002 at U1 Annex", flag: "UNSUITABLE" },
        { what: "equipment", name: "U1 Chairs", flag: "FLAGGED_FOR_REVIEW" },
      ]),
    ).toBe(
      "The safety arrangements can't be approved while arrangement flags are outstanding: " +
        "booking BKR-000001 at U1 Hall requires reconfirmation; booking BKR-000002 at U1 Annex is flagged unsuitable; " +
        "equipment U1 Chairs is flagged for review.",
    );
  });
});

describe("flagReason and messages", () => {
  it("prefixes the officer's reason so S3's flag list shows where the flag came from", () => {
    expect(flagReason("Move the chairs")).toBe("Safety review: Move the chairs");
  });

  it("tells a coordinator who is not assigned why they cannot mark an event Confirmed", () => {
    expect(NOT_ASSIGNED_TO_CONFIRM_MESSAGE).toBe("Only the event's assigned coordinator can mark it Confirmed.");
  });
});
