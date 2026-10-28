import { describe, expect, it } from "vitest";
import { impactBody } from "../../../src/modules/change/api/decisions.js";
import type { AppliedChangeImpact } from "../../../src/modules/change/repo/changeImpact.js";

// S3 — what an approval's 200 says about the arrangements; no database needed.

const impact: AppliedChangeImpact = {
  bookings: [
    {
      id: "b1",
      reference: "BKR-000001",
      venueId: "v1",
      venueName: "Venue One",
      startsAt: "2026-12-02T06:00:00.000Z",
      endsAt: "2026-12-02T10:00:00.000Z",
      layout: "Theatre",
      layoutCapacity: 100,
      staffIds: ["staff-1"],
    },
  ],
  reservations: [
    {
      id: "r1",
      lineId: "l1",
      equipmentTypeName: "Folding Chairs",
      reservedQuantity: 4,
      startsAt: "2026-12-02T06:00:00.000Z",
      endsAt: "2026-12-02T10:00:00.000Z",
      reservedBy: "tech-1",
    },
  ],
  activeRegistrations: 0,
  bookingFlags: [
    { bookingId: "b1", flag: "REQUIRES_RECONFIRMATION", reason: "Moved.", details: {} },
    { bookingId: "b1", flag: "UNSUITABLE", reason: "Too small.", details: { capacity: 100 } },
  ],
  reservationFlags: [{ reservationId: "r1", flag: "FLAGGED_FOR_REVIEW", reason: "Moved too.", details: {} }],
  returnedToPlanning: true,
};

describe("impactBody (S3)", () => {
  it("lists the arrangements and the flags, bookings first, without staff or who reserved", () => {
    expect(impactBody(impact)).toEqual({
      bookings: [
        { id: "b1", reference: "BKR-000001", venueName: "Venue One", startsAt: "2026-12-02T06:00:00.000Z", endsAt: "2026-12-02T10:00:00.000Z" },
      ],
      reservations: [
        { id: "r1", equipmentTypeName: "Folding Chairs", reservedQuantity: 4, startsAt: "2026-12-02T06:00:00.000Z", endsAt: "2026-12-02T10:00:00.000Z" },
      ],
      activeRegistrations: 0,
      flags: [
        { arrangement: "BOOKING", id: "b1", reference: "BKR-000001", name: "Venue One", flag: "REQUIRES_RECONFIRMATION", reason: "Moved." },
        { arrangement: "BOOKING", id: "b1", reference: "BKR-000001", name: "Venue One", flag: "UNSUITABLE", reason: "Too small." },
        { arrangement: "EQUIPMENT", id: "r1", reference: "r1", name: "Folding Chairs", flag: "FLAGGED_FOR_REVIEW", reason: "Moved too." },
      ],
    });
  });

  it("gives an empty flag list when nothing was flagged", () => {
    expect(impactBody({ ...impact, bookingFlags: [], reservationFlags: [] }).flags).toEqual([]);
  });
});
