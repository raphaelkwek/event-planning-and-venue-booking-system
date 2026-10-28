import type { SignificantEventField } from "@connectsphere/contracts";
import type { ProposedChanges } from "../../event/index.js";
import { formatPeriod } from "./formatPeriod.js";

/**
 * S3 — which arrangements an approved significant change affects, and how each
 * is flagged (AC1–AC4): confirmed bookings, held holds and pending booking
 * requests at the venue, and equipment reservations. Pure: the change module
 * reads them, passes them in with the event's new values, and applies the
 * result. G2 reuses this read-only to preview a change's impact, so it holds no
 * I/O and no clock.
 */

export type ImpactFlag = "REQUIRES_RECONFIRMATION" | "UNSUITABLE" | "FLAGGED_FOR_REVIEW";

/** A confirmed booking or a held hold (venue slots), or a pending booking request. */
export type ImpactVenueArrangement = "BOOKING" | "HOLD" | "BOOKING_REQUEST";

export interface ImpactBooking {
  arrangement: ImpactVenueArrangement;
  /** The slot's id, or the request's. */
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

/** The event's values after the change; null where it has none, which skips the rule that needs it. */
export interface ImpactValues {
  proposedStartAt: string | null;
  proposedEndAt: string | null;
  expectedAttendance: number | null;
}

export interface BookingFlag {
  bookingId: string;
  arrangement: ImpactVenueArrangement;
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

const NOUNS: Record<ImpactVenueArrangement, string> = { BOOKING: "booking", HOLD: "hold", BOOKING_REQUEST: "booking request" };

export function assessChangeImpact(input: {
  bookings: readonly ImpactBooking[];
  reservations: readonly ImpactReservation[];
  after: ImpactValues;
  changedFields: readonly SignificantEventField[];
}): ChangeImpact {
  const { bookings, reservations, after, changedFields } = input;
  const { proposedStartAt: start, proposedEndAt: end, expectedAttendance: attendance } = after;
  // A rule whose value the event no longer has is skipped rather than failing the approval.
  const period = start !== null && end !== null && changedFields.some((f) => f === "proposedStartAt" || f === "proposedEndAt") ? { start, end } : null;
  const newAttendance = attendance !== null && changedFields.includes("expectedAttendance") ? attendance : null;
  const moved = (b: { startsAt: string; endsAt: string }) => period !== null && (differs(b.startsAt, period.start) || differs(b.endsAt, period.end));
  const movedReason = (noun: string, b: { startsAt: string; endsAt: string }) =>
    `The ${noun} is for ${formatPeriod(b.startsAt, b.endsAt)}, but the event is now ${formatPeriod(period!.start, period!.end)}.`;
  const movedDetails = (b: { startsAt: string; endsAt: string }) => ({
    bookedStartsAt: b.startsAt,
    bookedEndsAt: b.endsAt,
    eventStartsAt: period!.start,
    eventEndsAt: period!.end,
  });

  const bookingFlags: BookingFlag[] = [];
  for (const b of bookings) {
    if (moved(b)) {
      bookingFlags.push({
        bookingId: b.id,
        arrangement: b.arrangement,
        flag: "REQUIRES_RECONFIRMATION",
        reason: movedReason(NOUNS[b.arrangement], b),
        details: movedDetails(b),
      });
    }
    if (newAttendance !== null && b.layoutCapacity < newAttendance) {
      const where = b.layout === null ? "" : ` in the ${b.layout} layout`;
      bookingFlags.push({
        bookingId: b.id,
        arrangement: b.arrangement,
        flag: "UNSUITABLE",
        reason: `Expected attendance is now ${newAttendance}, but ${b.venueName} holds ${b.layoutCapacity}${where}.`,
        details: { expectedAttendance: newAttendance, capacity: b.layoutCapacity, layout: b.layout },
      });
    }
  }

  const reservationFlags: ReservationFlag[] = reservations.filter(moved).map((r) => ({
    reservationId: r.id,
    flag: "FLAGGED_FOR_REVIEW",
    reason: movedReason("reservation", r),
    details: movedDetails(r),
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

/** An instant from the event row or a change request's JSON, as ISO-8601; null when there is none. */
function instant(value: unknown): string | null {
  const readable = value instanceof Date || typeof value === "string" || typeof value === "number";
  const time = readable ? new Date(value).getTime() : NaN;
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}

function attendance(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * The event's significant timing and attendance after `changes` are applied over its current
 * values. A value the event is left without, or that cannot be read, is null, so the rule that
 * needs it is skipped and the approval does not fail on it.
 */
export function valuesAfterChange(
  current: { readonly proposedStartAt?: unknown; readonly proposedEndAt?: unknown; readonly expectedAttendance?: unknown },
  changes: ProposedChanges
): ImpactValues {
  const pick = (field: "proposedStartAt" | "proposedEndAt" | "expectedAttendance") =>
    field in changes ? changes[field] : current[field];
  return {
    proposedStartAt: instant(pick("proposedStartAt")),
    proposedEndAt: instant(pick("proposedEndAt")),
    expectedAttendance: attendance(pick("expectedAttendance")),
  };
}
