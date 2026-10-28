import { describe, expect, it } from "vitest";
import { flagsBody } from "../../../src/modules/change/api/arrangementFlags.js";

// S3 (AC8) — the shape of the flags list; no database needed.

describe("flagsBody", () => {
  const booking = (reference: string, flag: "REQUIRES_RECONFIRMATION" | "UNSUITABLE") => ({
    bookingId: `id-${reference}-${flag}`,
    reference,
    venueName: "Venue One",
    flag,
    reason: "Because.",
    flaggedAt: "2026-10-28T01:00:00.000Z",
  });
  const reservation = {
    reservationId: "r1",
    equipmentTypeName: "Projectors",
    flag: "FLAGGED_FOR_REVIEW" as const,
    reason: "Review it.",
    flaggedAt: "2026-10-28T01:00:01.000Z",
  };

  it("lists bookings first, then equipment, each in the order given", () => {
    const body = flagsBody([booking("BKR-2", "UNSUITABLE"), booking("BKR-1", "REQUIRES_RECONFIRMATION")], [reservation]);
    expect(body.flags.map((f) => [f.arrangement, f.reference, f.flag])).toEqual([
      ["BOOKING", "BKR-2", "UNSUITABLE"],
      ["BOOKING", "BKR-1", "REQUIRES_RECONFIRMATION"],
      ["EQUIPMENT", "r1", "FLAGGED_FOR_REVIEW"],
    ]);
  });

  it("names a booking by its venue and a reservation by its equipment type, with its id as reference", () => {
    expect(flagsBody([booking("BKR-1", "UNSUITABLE")], [reservation]).flags).toEqual([
      {
        arrangement: "BOOKING",
        id: "id-BKR-1-UNSUITABLE",
        reference: "BKR-1",
        name: "Venue One",
        flag: "UNSUITABLE",
        reason: "Because.",
        flaggedAt: "2026-10-28T01:00:00.000Z",
      },
      {
        arrangement: "EQUIPMENT",
        id: "r1",
        reference: "r1",
        name: "Projectors",
        flag: "FLAGGED_FOR_REVIEW",
        reason: "Review it.",
        flaggedAt: "2026-10-28T01:00:01.000Z",
      },
    ]);
  });

  it("is an empty list when nothing is flagged", () => {
    expect(flagsBody([], [])).toEqual({ flags: [] });
  });
});
