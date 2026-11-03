import type { AccountKey } from "./accounts.js";
import { must } from "./api.js";
import { standardVenue, type VenueRow } from "./seed.js";

/**
 * Venue-side setup for the venue journeys (H, I, J, K, L, M): booking requests, approvals,
 * holds and blocks, done through the API as the user who would do each, and the reads a card
 * otherwise does in the SQL editor.
 */

/** Tuesday 2 March 2027, 14:00 to 18:00 Singapore time: the cards' 2 December 2026 period, moved into 2027. */
export const PERIOD = { startsAt: "2027-03-02T06:00:00.000Z", endsAt: "2027-03-02T10:00:00.000Z" };
export const PERIOD_TEXT = "Tuesday 2 March 2027, 14:00–18:00";

export interface BookingRequestRow {
  id: string;
  reference: string;
  eventReference: string | null;
  venueName: string;
  startsAt: string;
  endsAt: string;
  layout: string;
  expectedAttendance: number;
  status: string;
  requestedBy: string;
  requestedAt: string;
  decidedBy: string | null;
  decidedAt: string | null;
  bookingId: string | null;
  rejectionReason: string | null;
  justification: string | null;
}

export interface EventBookingRow {
  id: string;
  reference: string;
  venueId: string;
  venueName: string;
  startsAt: string;
  endsAt: string;
  status: string;
  requiresReconfirmation: boolean;
  disruptions: { blockId: string; reasonType: string; description: string }[];
}

export interface HoldRow {
  id: string;
  reference: string;
  status: string;
  requestedBy: string;
  requestedAt: string;
  placedBy: string | null;
  placedAt: string | null;
  expiresAt: string | null;
  reminderLeadMinutes: number;
  slotId: string | null;
}

export interface BlockRow {
  id: string;
  venueId: string;
  startsAt: string;
  endsAt: string | null;
  reasonType: string;
  description: string;
  status: string;
  createdBy: string;
  createdAt: string;
}

/** L1: the assigned coordinator asks for the venue, Theatre, with the event's own period and attendance. */
export function requestBooking(
  eventId: string,
  venueId: string,
  overrides: Record<string, unknown> = {},
  as: AccountKey = "coordinator",
) {
  return must<BookingRequestRow>(as, "POST", "/api/v1/booking-requests", {
    eventId,
    venueId,
    ...PERIOD,
    layout: "Theatre",
    expectedAttendance: 150,
    facilities: [],
    accessibilityFeatures: [],
    ...overrides,
  });
}

/** M1: the venue's Venue Staff approve it, which confirms the booking. */
export function approveBooking(requestId: string) {
  return must<unknown>("venuestaff", "POST", `/api/v1/booking-requests/${requestId}/approve`, {});
}

/** What the event's "Venue requests" screen reads: its requests and its bookings. */
export function eventBookings(eventId: string, as: AccountKey = "coordinator") {
  return must<{ items: BookingRequestRow[]; bookings: EventBookingRow[] }>(
    as,
    "GET",
    `/api/v1/booking-requests?eventId=${eventId}`,
  );
}

export function eventHolds(eventId: string, as: AccountKey = "coordinator") {
  return must<{ items: HoldRow[] }>(as, "GET", `/api/v1/holds?eventId=${eventId}`);
}

export function venueBlocks(venueId: string) {
  return must<{ items: BlockRow[] }>("venuestaff", "GET", `/api/v1/venues/${venueId}/unavailability`);
}

/** H1: Venue Staff untick "Active". The record and its history stay. */
export function makeInactive(venue: VenueRow, overrides: Record<string, unknown> = {}) {
  return must<VenueRow>("venuestaff", "PUT", `/api/v1/venues/${venue.id}`, {
    ...standardVenue({ name: venue.name, ...overrides }),
    isActive: false,
  });
}

/** True when an instant is within the last few minutes, the cards' "within the last minute" with slack for a slow runner. */
export function isRecent(instant: string | null, withinMs = 5 * 60_000): boolean {
  if (!instant) return false;
  const age = Date.now() - Date.parse(instant);
  return age >= -60_000 && age <= withinMs;
}
