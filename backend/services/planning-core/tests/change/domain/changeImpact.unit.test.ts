import { describe, expect, it } from "vitest";
import {
  assessChangeImpact,
  type ImpactBooking,
  type ImpactReservation,
  type ImpactValues,
  valuesAfterChange,
} from "../../../src/modules/change/domain/changeImpact.js";
import { formatPeriod } from "../../../src/modules/change/domain/formatPeriod.js";

// S3 — which arrangements an approved change affects, which needs no database.
// The API cards (tests/S3) check the same rules end to end.

const booking = (over: Partial<ImpactBooking> = {}): ImpactBooking => ({
  arrangement: "BOOKING",
  id: "B1",
  reference: "BKR-000001",
  venueId: "V1",
  venueName: "Venue One",
  startsAt: "2026-12-02T06:00:00.000Z", // 14:00 Singapore
  endsAt: "2026-12-02T10:00:00.000Z", // 18:00
  layout: "Theatre",
  layoutCapacity: 100,
  staffIds: ["S1"],
  ...over,
});

const reservation = (over: Partial<ImpactReservation> = {}): ImpactReservation => ({
  id: "R1",
  lineId: "L1",
  equipmentTypeName: "Projector",
  reservedQuantity: 2,
  startsAt: "2026-12-02T06:00:00.000Z",
  endsAt: "2026-12-02T10:00:00.000Z",
  reservedBy: "T1",
  ...over,
});

const after = (over: Partial<ImpactValues> = {}): ImpactValues => ({
  proposedStartAt: "2026-12-02T07:00:00.000Z", // 15:00
  proposedEndAt: "2026-12-02T10:00:00.000Z",
  expectedAttendance: 80,
  ...over,
});

describe("formatPeriod", () => {
  it("reads a period within one day in Singapore time", () => {
    expect(formatPeriod("2026-12-02T06:00:00.000Z", "2026-12-02T10:00:00.000Z")).toBe("Wednesday 2 December 2026, 14:00–18:00");
  });

  it("names both ends when the period crosses midnight", () => {
    expect(formatPeriod("2026-12-02T14:00:00.000Z", "2026-12-02T18:00:00.000Z")).toBe(
      "Wednesday 2 December 2026 22:00 to Thursday 3 December 2026 02:00",
    );
  });
});

describe("assessChangeImpact", () => {
  it("flags bookings and reservations whose period differs from the new one", () => {
    const b = [booking(), booking({ id: "B2", reference: "BKR-000002", venueId: "V2", venueName: "Venue Two" })];
    const r = [reservation()];
    const out = assessChangeImpact({ bookings: b, reservations: r, after: after(), changedFields: ["proposedStartAt"] });
    const reason = "The booking is for Wednesday 2 December 2026, 14:00–18:00, but the event is now Wednesday 2 December 2026, 15:00–18:00.";
    expect(out.bookingFlags).toEqual([
      {
        bookingId: "B1",
        arrangement: "BOOKING",
        flag: "REQUIRES_RECONFIRMATION",
        reason,
        details: {
          bookedStartsAt: "2026-12-02T06:00:00.000Z",
          bookedEndsAt: "2026-12-02T10:00:00.000Z",
          eventStartsAt: "2026-12-02T07:00:00.000Z",
          eventEndsAt: "2026-12-02T10:00:00.000Z",
        },
      },
      expect.objectContaining({ bookingId: "B2", flag: "REQUIRES_RECONFIRMATION", reason }),
    ]);
    expect(out.reservationFlags).toEqual([
      {
        reservationId: "R1",
        flag: "FLAGGED_FOR_REVIEW",
        reason: "The reservation is for Wednesday 2 December 2026, 14:00–18:00, but the event is now Wednesday 2 December 2026, 15:00–18:00.",
        details: {
          bookedStartsAt: "2026-12-02T06:00:00.000Z",
          bookedEndsAt: "2026-12-02T10:00:00.000Z",
          eventStartsAt: "2026-12-02T07:00:00.000Z",
          eventEndsAt: "2026-12-02T10:00:00.000Z",
        },
      },
    ]);
  });

  it("returns every arrangement, unchanged and in order, flagged or not", () => {
    const b = [booking({ id: "B1" }), booking({ id: "B2", startsAt: after().proposedStartAt! })];
    const r = [reservation({ id: "R1" }), reservation({ id: "R2" })];
    const out = assessChangeImpact({ bookings: b, reservations: r, after: after(), changedFields: ["proposedStartAt"] });
    expect(out.bookings).toEqual(b);
    expect(out.reservations).toEqual(r);
    expect(out.bookingFlags.map((f) => f.bookingId)).toEqual(["B1"]);
    expect(out.reservationFlags.map((f) => f.reservationId)).toEqual(["R1", "R2"]);
  });

  it("flags when only the end moves", () => {
    const out = assessChangeImpact({
      bookings: [booking()],
      reservations: [],
      after: after({ proposedStartAt: "2026-12-02T06:00:00.000Z", proposedEndAt: "2026-12-02T11:00:00.000Z" }),
      changedFields: ["proposedEndAt"],
    });
    expect(out.bookingFlags).toHaveLength(1);
  });

  it("does not flag a booking already at the new period when the time changed", () => {
    const out = assessChangeImpact({
      bookings: [booking({ startsAt: "2026-12-02T07:00:00.000Z" })],
      reservations: [reservation({ startsAt: "2026-12-02T07:00:00.000Z" })],
      after: after(),
      changedFields: ["proposedStartAt"],
    });
    expect(out.bookingFlags).toEqual([]);
    expect(out.reservationFlags).toEqual([]);
  });

  it("compares instants, so the same moment in another offset is not flagged", () => {
    const out = assessChangeImpact({
      bookings: [booking({ startsAt: "2026-12-02T15:00:00+08:00", endsAt: "2026-12-02T18:00:00+08:00" })],
      reservations: [],
      after: after(),
      changedFields: ["proposedStartAt"],
    });
    expect(out.bookingFlags).toEqual([]);
  });

  it("flags a booking when attendance exceeds its capacity", () => {
    const out = assessChangeImpact({
      bookings: [booking()],
      reservations: [reservation()],
      after: after({ expectedAttendance: 150 }),
      changedFields: ["expectedAttendance"],
    });
    expect(out.bookingFlags).toEqual([
      {
        bookingId: "B1",
        arrangement: "BOOKING",
        flag: "UNSUITABLE",
        reason: "Expected attendance is now 150, but Venue One holds 100 in the Theatre layout.",
        details: { expectedAttendance: 150, capacity: 100, layout: "Theatre" },
      },
    ]);
    expect(out.reservationFlags).toEqual([]);
  });

  it("does not flag attendance equal to or below capacity", () => {
    for (const expectedAttendance of [100, 99]) {
      const out = assessChangeImpact({ bookings: [booking()], reservations: [], after: after({ expectedAttendance }), changedFields: ["expectedAttendance"] });
      expect(out.bookingFlags).toEqual([]);
    }
  });

  it("words the reason without a layout when there is none", () => {
    const out = assessChangeImpact({
      bookings: [booking({ layout: null })],
      reservations: [],
      after: after({ expectedAttendance: 150 }),
      changedFields: ["expectedAttendance"],
    });
    expect(out.bookingFlags[0]).toMatchObject({
      reason: "Expected attendance is now 150, but Venue One holds 100.",
      details: { expectedAttendance: 150, capacity: 100, layout: null },
    });
  });

  it("gives one booking both flags, period first", () => {
    const out = assessChangeImpact({
      bookings: [booking()],
      reservations: [],
      after: after({ expectedAttendance: 150 }),
      changedFields: ["proposedStartAt", "expectedAttendance"],
    });
    expect(out.bookingFlags.map((f) => [f.bookingId, f.flag])).toEqual([
      ["B1", "REQUIRES_RECONFIRMATION"],
      ["B1", "UNSUITABLE"],
    ]);
  });

  it("assesses each venue on its own capacity", () => {
    const out = assessChangeImpact({
      bookings: [booking({ id: "B1", layoutCapacity: 100 }), booking({ id: "B2", venueId: "V2", venueName: "Venue Two", layoutCapacity: 200 })],
      reservations: [],
      after: after({ expectedAttendance: 150 }),
      changedFields: ["expectedAttendance"],
    });
    expect(out.bookingFlags.map((f) => f.bookingId)).toEqual(["B1"]);
  });

  it("ignores a differing period when no time field changed", () => {
    const out = assessChangeImpact({ bookings: [booking()], reservations: [reservation()], after: after(), changedFields: ["expectedAttendance"] });
    expect(out.bookingFlags).toEqual([]);
    expect(out.reservationFlags).toEqual([]);
  });

  it("ignores low capacity when attendance did not change", () => {
    const out = assessChangeImpact({ bookings: [booking()], reservations: [], after: after({ expectedAttendance: 500 }), changedFields: ["proposedStartAt"] });
    expect(out.bookingFlags.map((f) => f.flag)).toEqual(["REQUIRES_RECONFIRMATION"]);
  });

  it("flags nothing for changes to other significant fields", () => {
    const out = assessChangeImpact({
      bookings: [booking()],
      reservations: [reservation()],
      after: after({ expectedAttendance: 500 }),
      changedFields: ["venueRequirements", "equipmentRequired", "equipmentRequirements"],
    });
    expect(out.bookingFlags).toEqual([]);
    expect(out.reservationFlags).toEqual([]);
    expect(out.bookings).toHaveLength(1);
  });

  it("names a hold or a booking request in its reasons, and says which it flagged", () => {
    const out = assessChangeImpact({
      bookings: [booking({ id: "H1", arrangement: "HOLD" }), booking({ id: "Q1", arrangement: "BOOKING_REQUEST" })],
      reservations: [],
      after: after({ expectedAttendance: 150 }),
      changedFields: ["proposedStartAt", "expectedAttendance"],
    });
    expect(out.bookingFlags.map((f) => [f.bookingId, f.arrangement, f.flag, f.reason])).toEqual([
      ["H1", "HOLD", "REQUIRES_RECONFIRMATION", expect.stringMatching(/^The hold is for Wednesday 2 December 2026, 14:00–18:00, /)],
      ["H1", "HOLD", "UNSUITABLE", "Expected attendance is now 150, but Venue One holds 100 in the Theatre layout."],
      ["Q1", "BOOKING_REQUEST", "REQUIRES_RECONFIRMATION", expect.stringMatching(/^The booking request is for /)],
      ["Q1", "BOOKING_REQUEST", "UNSUITABLE", "Expected attendance is now 150, but Venue One holds 100 in the Theatre layout."],
    ]);
  });

  it("skips the period rule when the event has no start or end, and the capacity rule when it has no attendance", () => {
    for (const missing of [{ proposedStartAt: null }, { proposedEndAt: null }]) {
      const out = assessChangeImpact({
        bookings: [booking()],
        reservations: [reservation()],
        after: after(missing),
        changedFields: ["proposedStartAt", "proposedEndAt"],
      });
      expect(out.bookingFlags).toEqual([]);
      expect(out.reservationFlags).toEqual([]);
    }
    const out = assessChangeImpact({
      bookings: [booking({ layoutCapacity: 1 })],
      reservations: [],
      after: after({ expectedAttendance: null }),
      changedFields: ["expectedAttendance", "proposedStartAt"],
    });
    expect(out.bookingFlags.map((f) => f.flag)).toEqual(["REQUIRES_RECONFIRMATION"]);
  });

  it("handles no arrangements and counts no registrations", () => {
    const out = assessChangeImpact({ bookings: [], reservations: [], after: after(), changedFields: ["proposedStartAt", "expectedAttendance"] });
    expect(out).toEqual({ bookings: [], reservations: [], activeRegistrations: 0, bookingFlags: [], reservationFlags: [] });
  });
});

describe("valuesAfterChange (S3)", () => {
  const current = {
    proposedStartAt: "2026-12-02T06:00:00.000Z",
    proposedEndAt: "2026-12-02T10:00:00.000Z",
    expectedAttendance: 80,
  };

  it("keeps the current values a change leaves alone", () => {
    expect(valuesAfterChange(current, { venueRequirements: "Stage with a lectern" })).toEqual(current);
  });

  it("takes the changed values over the current ones", () => {
    expect(valuesAfterChange(current, { proposedStartAt: "2026-12-02T07:00:00.000Z", expectedAttendance: 150 })).toEqual({
      ...current,
      proposedStartAt: "2026-12-02T07:00:00.000Z",
      expectedAttendance: 150,
    });
  });

  it("writes every instant as ISO-8601, however it arrives, and attendance as a number", () => {
    expect(
      valuesAfterChange(
        { proposedStartAt: new Date("2026-12-02T06:00:00Z"), proposedEndAt: Date.parse("2026-12-02T10:00:00Z"), expectedAttendance: "80" },
        { proposedStartAt: "2026-12-02T15:00:00+08:00" }
      )
    ).toEqual({ proposedStartAt: "2026-12-02T07:00:00.000Z", proposedEndAt: "2026-12-02T10:00:00.000Z", expectedAttendance: 80 });
  });

  it("gives null for a start, an end or an attendance the event is left without, so its rule is skipped", () => {
    expect(valuesAfterChange({ ...current, proposedStartAt: null }, {})).toEqual({ ...current, proposedStartAt: null });
    expect(valuesAfterChange(current, { proposedEndAt: "not a date" })).toEqual({ ...current, proposedEndAt: null });
    expect(valuesAfterChange(current, { proposedEndAt: true })).toEqual({ ...current, proposedEndAt: null });
    expect(valuesAfterChange({ ...current, expectedAttendance: null }, {})).toEqual({ ...current, expectedAttendance: null });
    expect(valuesAfterChange(current, { expectedAttendance: "many" })).toEqual({ ...current, expectedAttendance: null });
    expect(valuesAfterChange({}, {})).toEqual({ proposedStartAt: null, proposedEndAt: null, expectedAttendance: null });
  });
});
