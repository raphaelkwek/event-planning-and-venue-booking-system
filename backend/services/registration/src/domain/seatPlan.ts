/**
 * The seat rules, pure (EN-13, ADR-0005). Seats are built from a confirmed
 * booking's layout capacity, so Registration never asks Venue for a ceiling.
 */

export const SEAT_POOLS = ["PUBLIC", "VIP"] as const;
export type SeatPool = (typeof SEAT_POOLS)[number];

/** What an approval message must say before seats can be built from it. */
export interface ApprovalData {
  eventId: string;
  bookingId: string;
  replacedBookingId: string | null;
  layout?: string | undefined;
  layoutCapacity?: number | undefined;
}

/** The booking the seats are for, and how many. */
export interface SeatBasis {
  eventId: string;
  bookingId: string;
  /** The confirmed booking this one replaced (CR-02), whose unclaimed seats are retired. */
  replacedBookingId: string | null;
  layout: string;
  capacity: number;
}

/**
 * The seats an approval gives an event, or null when it names no layout capacity:
 * an approval published before EN-13, or one whose venue no longer offered the
 * layout. No seats are built from a guess.
 */
export function seatBasisOf(approval: ApprovalData): SeatBasis | null {
  const { layout, layoutCapacity } = approval;
  if (layout === undefined || layoutCapacity === undefined) return null;
  return {
    eventId: approval.eventId,
    bookingId: approval.bookingId,
    replacedBookingId: approval.replacedBookingId,
    layout,
    capacity: layoutCapacity,
  };
}

/**
 * How a booking's seats are divided between the pools. The VIP pool is the
 * organiser's choice, and can't be negative or larger than the booking.
 */
export function splitPools(capacity: number, vipSeats: number): { publicSeats: number; vipSeats: number } {
  const vip = Math.min(Math.max(Math.trunc(vipSeats), 0), capacity);
  return { publicSeats: capacity - vip, vipSeats: vip };
}

/** A change of VIP pool size: how many seats move, and which way. */
export interface PoolShift {
  from: SeatPool;
  to: SeatPool;
  count: number;
}

/**
 * Moving the VIP pool from its current size to the size asked for. Null when it
 * already is that size. A target beyond what exists is held to the seats there are.
 */
export function poolShift(currentVip: number, targetVip: number, totalSeats: number): PoolShift | null {
  const target = Math.min(Math.max(Math.trunc(targetVip), 0), totalSeats);
  if (target === currentVip) return null;
  return target > currentVip
    ? { from: "PUBLIC", to: "VIP", count: target - currentVip }
    : { from: "VIP", to: "PUBLIC", count: currentVip - target };
}
