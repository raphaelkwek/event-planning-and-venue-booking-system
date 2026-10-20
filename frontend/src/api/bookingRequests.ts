import { request } from "./client.js";
import type { EventStatus, VenueRequirements } from "./types.js";
import type { SuitabilityCondition, SuitabilityStatus } from "./venues.js";

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
  /** K2: assessed when the request was submitted; null on requests made before K2. */
  suitabilityStatus: SuitabilityStatus | null;
  /** K2: the failing conditions as they were then. */
  suitabilityReasons: SuitabilityCondition[] | null;
  justification: string | null;
  /** N2: while pending, the requests and confirmed bookings at the venue it clashes with. */
  conflicts: RequestConflict[];
}

/** N2: another pending request, or a confirmed booking, whose occupied period overlaps the request's. */
export interface RequestConflict {
  kind: "REQUEST" | "BOOKING";
  reference: string;
  startsAt: string;
  endsAt: string;
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
  /** K2: sent once the server has found the venue not suitable. */
  justification?: string;
  /** L5 (CR-02): the disrupted booking this request replaces. */
  replacesBookingId?: string | null;
}

/** L5: one of the event's bookings, with the blocks that disrupt it and the replacements asked for. */
export interface EventBooking {
  id: string;
  reference: string;
  venueId: string;
  venueName: string;
  startsAt: string;
  endsAt: string;
  status: "HELD" | "CONFIRMED" | "RELEASED";
  requiresReconfirmation: boolean;
  releaseReason: string | null;
  disruptions: { blockId: string; reasonType: string; description: string; startsAt: string; endsAt: string }[];
  /** H3-T10: the bookings and holds the venue's new setup or turnaround time makes it overlap. */
  overlaps: string[];
  replacements: { id: string; reference: string; status: BookingRequestStatus; venueName: string }[];
}

/** An event can request venues once approved, and until it is over (L1). */
export const BOOKABLE_STATUSES: readonly EventStatus[] = ["APPROVED", "PLANNING", "SAFETY_REVIEW", "CONFIRMED"];

export function listEventBookingRequests(token: string, eventId: string) {
  return request<{ event: BookingEvent; items: BookingRequest[]; bookings: EventBooking[] }>(
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
