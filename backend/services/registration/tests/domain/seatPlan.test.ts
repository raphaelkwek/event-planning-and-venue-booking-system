import { describe, expect, it } from "vitest";
import { poolShift, seatBasisOf, splitPools } from "../../src/domain/seatPlan.js";

const approval = {
  eventId: "22222222-2222-4222-8222-222222222222",
  bookingId: "55555555-5555-4555-8555-555555555555",
  replacedBookingId: null,
};

describe("seatBasisOf", () => {
  it("gives the event, booking, layout and capacity an approval names (EN-13-T1)", () => {
    expect(seatBasisOf({ ...approval, layout: "Theatre", layoutCapacity: 300 })).toEqual({
      eventId: approval.eventId,
      bookingId: approval.bookingId,
      replacedBookingId: null,
      layout: "Theatre",
      capacity: 300,
    });
  });

  it("carries the booking an approval replaced, so its seats can be retired (EN-13-T6)", () => {
    const replaced = "66666666-6666-4666-8666-666666666666";
    expect(seatBasisOf({ ...approval, replacedBookingId: replaced, layout: "Theatre", layoutCapacity: 80 })?.replacedBookingId).toBe(replaced);
  });

  it("gives null when the approval names no layout capacity, so no seats are built from a guess (EN-13-T7)", () => {
    expect(seatBasisOf(approval)).toBeNull();
    expect(seatBasisOf({ ...approval, layout: "Theatre" })).toBeNull();
    expect(seatBasisOf({ ...approval, layoutCapacity: 300 })).toBeNull();
  });
});

describe("splitPools", () => {
  it("puts every seat in the public pool when no VIP seats are asked for (EN-13-T2)", () => {
    expect(splitPools(100, 0)).toEqual({ publicSeats: 100, vipSeats: 0 });
  });

  it("takes the VIP pool's size out of the public pool (EN-13-T3)", () => {
    expect(splitPools(100, 10)).toEqual({ publicSeats: 90, vipSeats: 10 });
  });

  it("holds the VIP pool to the booking's size, and never below zero (EN-13-T3)", () => {
    expect(splitPools(100, 250)).toEqual({ publicSeats: 0, vipSeats: 100 });
    expect(splitPools(100, -4)).toEqual({ publicSeats: 100, vipSeats: 0 });
    expect(splitPools(100, 7.9)).toEqual({ publicSeats: 93, vipSeats: 7 });
  });
});

describe("poolShift", () => {
  it("does nothing when the VIP pool already is the size asked for (EN-13-T3)", () => {
    expect(poolShift(10, 10, 100)).toBeNull();
  });

  it("moves public seats into the VIP pool to grow it (EN-13-T3)", () => {
    expect(poolShift(10, 25, 100)).toEqual({ from: "PUBLIC", to: "VIP", count: 15 });
  });

  it("moves VIP seats back to the public pool to shrink it (EN-13-T3)", () => {
    expect(poolShift(25, 10, 100)).toEqual({ from: "VIP", to: "PUBLIC", count: 15 });
  });

  it("holds a target to the seats there are, and never below zero (EN-13-T3)", () => {
    expect(poolShift(10, 500, 100)).toEqual({ from: "PUBLIC", to: "VIP", count: 90 });
    expect(poolShift(10, -3, 100)).toEqual({ from: "VIP", to: "PUBLIC", count: 10 });
    expect(poolShift(0, -3, 100)).toBeNull();
    expect(poolShift(10, 4.9, 100)).toEqual({ from: "VIP", to: "PUBLIC", count: 6 });
  });
});
