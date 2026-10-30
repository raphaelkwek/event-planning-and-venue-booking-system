import { request } from "./client.js";

const EVENT = "/event/api/v1";

/** Mirrors `SIGNIFICANT_EVENT_FIELDS` in backend/packages/contracts. */
export type SignificantField =
  | "proposedStartAt"
  | "proposedEndAt"
  | "expectedAttendance"
  | "venueRequirements"
  | "equipmentRequired"
  | "equipmentRequirements";

export interface ChangeRequestField {
  fieldName: SignificantField;
  currentValue: unknown;
  proposedValue: unknown;
}

/** S1 — mirrors `ChangeRequest` in documentation/api/planning-core.openapi.yaml. */
export interface ChangeRequest {
  id: string;
  eventId: string;
  eventReference: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reason: string;
  requestedBy: string;
  requestedAt: string;
  fields: ChangeRequestField[];
  /** S2 — null while the request is pending. */
  decidedBy: string | null;
  decidedAt: string | null;
  rejectionReason: string | null;
}

/** Only the fields being changed are present. */
export interface ProposedChanges {
  proposedStartAt?: string;
  proposedEndAt?: string;
  expectedAttendance?: number;
  equipmentRequired?: boolean;
}

export function requestChange(token: string, eventId: string, body: { reason: string; changes: ProposedChanges }) {
  return request<ChangeRequest>(`${EVENT}/events/${eventId}/change-requests`, { method: "POST", token, body });
}

export function listChangeRequests(token: string, eventId: string) {
  return request<{ items: ChangeRequest[] }>(`${EVENT}/events/${eventId}/change-requests`, { token });
}

export type ChangeDecision = { decision: "APPROVE" } | { decision: "REJECT"; reason: string };

export type ArrangementFlag = "REQUIRES_RECONFIRMATION" | "UNSUITABLE" | "FLAGGED_FOR_REVIEW";

/** A confirmed booking, a held hold or a pending booking request at a venue, or an equipment reservation. */
export type FlaggedArrangement = "BOOKING" | "HOLD" | "BOOKING_REQUEST" | "EQUIPMENT";

export interface ImpactFlag {
  arrangement: FlaggedArrangement;
  id: string;
  reference: string;
  name: string;
  flag: ArrangementFlag;
  reason: string;
}

/** S3 — mirrors `ChangeImpact` in documentation/api/planning-core.openapi.yaml. */
export interface ChangeImpact {
  bookings: { arrangement: "BOOKING" | "HOLD" | "BOOKING_REQUEST"; id: string; reference: string; venueName: string; startsAt: string; endsAt: string }[];
  reservations: { id: string; equipmentTypeName: string; reservedQuantity: number; startsAt: string; endsAt: string }[];
  activeRegistrations: number;
  flags: ImpactFlag[];
}

/** S2 — only the event's assigned coordinator may decide; an approval also returns the changed event and (S3) its impact. */
export function decideChangeRequest(token: string, id: string, body: ChangeDecision) {
  return request<{ changeRequest: ChangeRequest; event?: unknown; impact?: ChangeImpact }>(`${EVENT}/change-requests/${id}/decision`, { method: "POST", token, body });
}

/** S3 — one outstanding flag on an event's arrangements. */
export interface OutstandingFlag extends ImpactFlag {
  flaggedAt: string;
}

/** S3 — the owner, assigned coordinator and Event Coordinators; anyone else gets 404. */
export function listArrangementFlags(token: string, eventId: string) {
  return request<{ flags: OutstandingFlag[] }>(`${EVENT}/events/${eventId}/arrangement-flags`, { token });
}
