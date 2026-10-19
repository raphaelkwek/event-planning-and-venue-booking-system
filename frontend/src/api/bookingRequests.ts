import { request } from "./client.js";
import type { EventStatus, VenueRequirements } from "./types.js";

/** L1, L2, M1, M2: venue booking requests, served by planning-core's venue module. */

const VENUE = "/venue/api/v1";

export type BookingRequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "WITHDRAWN";

export type BookingDifference =
  | { field: "startsAt" | "endsAt"; event: string; requested: string }
  | { field: "expectedAttendance"; event: number; requested: number };

export interface BookingRequest {
  id: string;
  reference: string;
  eventId: string;
  eventReference: string | null;
  venueId: string;
  venueName: string;
  startsAt: string;
  endsAt: string;
  layout: string;
  expectedAttendance: number;
  facilities: string[];
  accessibilityFeatures: string[];
  eventStartsAt: string;
  eventEndsAt: string;
  eventAttendance: number;
  differsFromEvent: boolean;
  differences: BookingDifference[];
  replacesBookingId: string | null;
  status: BookingRequestStatus;
  requestedBy: string;
  requestedAt: string;
  withdrawnBy: string | null;
  withdrawnAt: string | null;
  /** M1, M2: the Venue Staff member who decided, and when. */
  decidedBy: string | null;
  decidedAt: string | null;
  bookingId: string | null;
  rejectionReason: string | null;
  suggestedAlternative: string | null;
  /** I2: an active block overlaps this pending request. */
  requiresReconfirmation: boolean;
}

/** The event's values the request form starts from. */
export interface BookingEvent {
  id: string;
  reference: string | null;
  name: string;
  status: EventStatus;
  assignedCoordinatorId: string | null;
  proposedStartAt: string | null;
  proposedEndAt: string | null;
  expectedAttendance: number | null;
  venueRequirements: VenueRequirements | null;
  accessibilityNeeds: string | null;
}

export interface BookingRequestInput {
  eventId: string;
  venueId: string;
  startsAt: string;
  endsAt: string;
  layout: string;
  expectedAttendance: number | null;
  facilities: string[];
  accessibilityFeatures: string[];
}

/** An event can request venues once approved, and until it is over (L1). */
export const BOOKABLE_STATUSES: readonly EventStatus[] = ["APPROVED", "PLANNING", "SAFETY_REVIEW", "CONFIRMED"];

export function listEventBookingRequests(token: string, eventId: string) {
  return request<{ event: BookingEvent; items: BookingRequest[] }>(
    `${VENUE}/booking-requests?${new URLSearchParams({ eventId })}`,
    { token },
  );
}

export function createBookingRequest(token: string, body: BookingRequestInput) {
  return request<BookingRequest>(`${VENUE}/booking-requests`, { method: "POST", token, body });
}

export function withdrawBookingRequest(token: string, id: string) {
  return request<BookingRequest>(`${VENUE}/booking-requests/${id}/withdraw`, { method: "POST", token });
}

export function listBookingQueue(token: string) {
  return request<{ items: BookingRequest[] }>(`${VENUE}/booking-requests/queue`, { token });
}

/** M1: confirms the booking, unless the period now overlaps a booking or recorded unavailability. */
export function approveBookingRequest(token: string, id: string) {
  return request<BookingRequest>(`${VENUE}/booking-requests/${id}/approve`, { method: "POST", token });
}

/** M2: rejects with a reason and any suggested alternative dates or venues. */
export function rejectBookingRequest(token: string, id: string, body: { reason: string; suggestion: string | null }) {
  return request<BookingRequest>(`${VENUE}/booking-requests/${id}/reject`, { method: "POST", token, body });
}
