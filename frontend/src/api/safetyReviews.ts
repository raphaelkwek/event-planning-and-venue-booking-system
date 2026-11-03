import { request } from "./client.js";
import type { EventStatus } from "./types.js";

const EVENT = "/event/api/v1";

export type SafetyDecisionKind = "APPROVE" | "REQUEST_CHANGES" | "REJECT";

/** U1 — mirrors `SafetyQueueEntry` in documentation/api/planning-core.openapi.yaml. */
export interface SafetyQueueEntry {
  id: string;
  reference: string | null;
  name: string;
  expectedAttendance: number | null;
  proposedStartAt: string | null;
  proposedEndAt: string | null;
  assignedCoordinatorId: string | null;
  enteredSafetyReviewAt: string;
  decision: SafetyDecisionKind | null;
}

export interface VenueFactor {
  bookingId: string;
  reference: string;
  status: "HELD" | "CONFIRMED";
  venueName: string;
  startsAt: string;
  endsAt: string;
  layout: string | null;
  layoutCapacity: number;
  venueMaxCapacity: number;
  layouts: { name: string; capacity: number }[];
}

export interface EquipmentFactor {
  lineId: string;
  equipmentTypeName: string;
  quantity: number;
  reservationId: string | null;
  reservedQuantity: number;
  placementNotes: string;
}

export interface SafetyDecisionRecord {
  id: string;
  decision: SafetyDecisionKind;
  reason: string | null;
  flagged: { bookings: string[]; reservations: string[] };
  decidedBy: string;
  decidedAt: string;
}

/** U1 — mirrors `SafetyReview`. */
export interface SafetyReview {
  event: {
    id: string;
    reference: string | null;
    name: string;
    status: EventStatus;
    assignedCoordinatorId: string | null;
    proposedStartAt: string | null;
    proposedEndAt: string | null;
  };
  factors: {
    expectedAttendance: number | null;
    accessibilityNeeds: string | null;
    venues: VenueFactor[];
    equipment: EquipmentFactor[];
  };
  flags: { what: string; name: string; flag: "REQUIRES_RECONFIRMATION" | "UNSUITABLE" | "FLAGGED_FOR_REVIEW" }[];
  decision: SafetyDecisionRecord | null;
}

export interface SafetyDecisionInput {
  decision: SafetyDecisionKind;
  reason?: string;
  flagBookingIds?: string[];
  flagReservationIds?: string[];
}

export function listSafetyReviews(token: string) {
  return request<{ events: SafetyQueueEntry[] }>(`${EVENT}/safety-reviews`, { token });
}

export function getSafetyReview(token: string, eventId: string) {
  return request<SafetyReview>(`${EVENT}/events/${eventId}/safety-review`, { token });
}

export function recordSafetyDecision(token: string, eventId: string, input: SafetyDecisionInput) {
  return request<{ decision: SafetyDecisionRecord; event: { id: string; status: EventStatus; previousStatus: EventStatus } }>(
    `${EVENT}/events/${eventId}/safety-decision`,
    { method: "POST", token, body: input }
  );
}

/** U1 — the assigned coordinator marks an event the Safety Officer approved Confirmed. */
export function markConfirmed(token: string, eventId: string) {
  return request<{ event: { id: string; status: EventStatus; previousStatus: EventStatus; confirmedAt: string } }>(
    `${EVENT}/events/${eventId}/mark-confirmed`,
    { method: "POST", token }
  );
}
