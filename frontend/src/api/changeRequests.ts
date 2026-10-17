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

/** S2 — only the event's assigned coordinator may decide; an approval also returns the changed event. */
export function decideChangeRequest(token: string, id: string, body: ChangeDecision) {
  return request<{ changeRequest: ChangeRequest; event?: unknown }>(`${EVENT}/change-requests/${id}/decision`, { method: "POST", token, body });
}
