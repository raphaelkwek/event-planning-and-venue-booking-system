import type { SignificantEventField } from "@connectsphere/contracts";
import { formatPeriod } from "./formatPeriod.js";

/**
 * S3 — which confirmed arrangements an approved significant change affects, and
 * how each is flagged (AC1–AC4). Pure: the change module reads the bookings and
 * reservations, passes them in with the event's new values, and applies the
 * result. G2 reuses this read-only to preview a change's impact, so it holds no
 * I/O and no clock.
 */

export type ImpactFlag = "REQUIRES_RECONFIRMATION" | "UNSUITABLE" | "FLAGGED_FOR_REVIEW";

export interface ImpactBooking {
  id: string;
  reference: string;
  venueId: string;
  venueName: string;
  startsAt: string;
  endsAt: string;
  layout: string | null;
  layoutCapacity: number;
  staffIds: string[];
}

export interface ImpactReservation {
  id: string;
  lineId: string;
  equipmentTypeName: string;
  reservedQuantity: number;
  startsAt: string;
  endsAt: string;
  reservedBy: string;
}

export interface ImpactValues {
  proposedStartAt: string;
  proposedEndAt: string;
  expectedAttendance: number;
}

export interface BookingFlag {
  bookingId: string;
  flag: "REQUIRES_RECONFIRMATION" | "UNSUITABLE";
  reason: string;
  details: Record<string, unknown>;
}

export interface ReservationFlag {
  reservationId: string;
  flag: "FLAGGED_FOR_REVIEW";
  reason: string;
  details: Record<string, unknown>;
}

export interface ChangeImpact {
  bookings: ImpactBooking[];
  reservations: ImpactReservation[];
  activeRegistrations: number;
  bookingFlags: BookingFlag[];
  reservationFlags: ReservationFlag[];
}

const differs = (a: string, b: string): boolean => Date.parse(a) !== Date.parse(b);

export function assessChangeImpact(input: {
  bookings: readonly ImpactBooking[];
  reservations: readonly ImpactReservation[];
  after: ImpactValues;
  changedFields: readonly SignificantEventField[];
}): ChangeImpact {
  const { bookings, reservations, after, changedFields } = input;
  const periodChanged = changedFields.includes("proposedStartAt") || changedFields.includes("proposedEndAt");
  const attendanceChanged = changedFields.includes("expectedAttendance");
  const moved = (b: { startsAt: string; endsAt: string }) =>
    periodChanged && (differs(b.startsAt, after.proposedStartAt) || differs(b.endsAt, after.proposedEndAt));
  const eventPeriod = formatPeriod(after.proposedStartAt, after.proposedEndAt);

  const bookingFlags: BookingFlag[] = [];
  for (const b of bookings) {
    if (moved(b)) {
      bookingFlags.push({
        bookingId: b.id,
        flag: "REQUIRES_RECONFIRMATION",
        reason: `The booking is for ${formatPeriod(b.startsAt, b.endsAt)}, but the event is now ${eventPeriod}.`,
        details: { bookedStartsAt: b.startsAt, bookedEndsAt: b.endsAt, eventStartsAt: after.proposedStartAt, eventEndsAt: after.proposedEndAt },
      });
    }
    if (attendanceChanged && b.layoutCapacity < after.expectedAttendance) {
      const where = b.layout === null ? "" : ` in the ${b.layout} layout`;
      bookingFlags.push({
        bookingId: b.id,
        flag: "UNSUITABLE",
        reason: `Expected attendance is now ${after.expectedAttendance}, but ${b.venueName} holds ${b.layoutCapacity}${where}.`,
        details: { expectedAttendance: after.expectedAttendance, capacity: b.layoutCapacity, layout: b.layout },
      });
    }
  }

  const reservationFlags: ReservationFlag[] = reservations.filter(moved).map((r) => ({
    reservationId: r.id,
    flag: "FLAGGED_FOR_REVIEW",
    reason: `The reservation is for ${formatPeriod(r.startsAt, r.endsAt)}, but the event is now ${eventPeriod}.`,
    details: { bookedStartsAt: r.startsAt, bookedEndsAt: r.endsAt, eventStartsAt: after.proposedStartAt, eventEndsAt: after.proposedEndAt },
  }));

  return {
    bookings: [...bookings],
    reservations: [...reservations],
    // No registrations exist until EN-13 (the registration service) does.
    activeRegistrations: 0,
    bookingFlags,
    reservationFlags,
  };
}
