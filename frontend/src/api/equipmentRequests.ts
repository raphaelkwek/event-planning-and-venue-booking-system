import { request } from "./client.js";

/** O1, O2 — the lines of an event's equipment request, served by planning-core's equipment module. */

const LINES = "/equipment/api/v1/equipment/request-lines";

/** Mirrors `EQUIPMENT_REQUEST_LINE_STATUSES` in backend/packages/contracts. */
export type LineStatus =
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "CONFIRMED"
  | "UNAVAILABLE"
  | "SUBSTITUTED"
  | "RESERVED"
  | "REMOVED";

/** The statuses Technical Support may set (O2). */
export type StaffLineStatus = "UNDER_REVIEW" | "CONFIRMED" | "UNAVAILABLE" | "SUBSTITUTED";

/** O1: only these lines can still be edited or removed by the coordinator. */
export const EDITABLE_LINE_STATUSES: readonly LineStatus[] = ["SUBMITTED", "UNDER_REVIEW"];

export interface RequestLine {
  id: string;
  eventId: string;
  eventReference: string;
  equipmentTypeId: string;
  equipmentTypeName: string;
  quantity: number;
  notes: string;
  requiredFrom: string;
  requiredTo: string;
  status: LineStatus;
  requestedBy: string;
  requestedAt: string;
  statusChangedBy: string | null;
  statusChangedAt: string | null;
  unavailableReason: string | null;
  substituteEquipmentTypeId: string | null;
  substituteEquipmentTypeName: string | null;
  substituteQuantity: number | null;
  /** Q1: the active reservation, or null. */
  reservation: {
    id: string;
    equipmentTypeId: string;
    /** The type reserved: the substitute's, for a Substituted line. */
    equipmentTypeName: string;
    requestedQuantity: number;
    reservedQuantity: number;
    reservedBy: string;
    reservedAt: string;
  } | null;
  updatedAt: string;
}

/** A line as sent: quantity and times pass through as the user entered them, so the server can refuse them. */
export interface LineInput {
  equipmentTypeId: string;
  quantity: number | null;
  notes: string;
  requiredFrom?: string | null;
  requiredTo?: string | null;
}

export interface StatusChangeInput {
  status: StaffLineStatus;
  reason?: string;
  substituteEquipmentTypeId?: string;
  substituteQuantity?: number | null;
}

/** The event a request belongs to, read without the side effect of opening it for review (D1). */
export interface RequestEvent {
  id: string;
  reference: string;
  name: string;
  status: string;
  proposedStartAt: string | null;
  proposedEndAt: string | null;
  assignedCoordinatorId: string | null;
}

export function listRequestLines(token: string, filter: { eventId?: string; status?: LineStatus } = {}) {
  const query = new URLSearchParams();
  if (filter.eventId) query.set("eventId", filter.eventId);
  if (filter.status) query.set("status", filter.status);
  query.set("limit", "100");
  return request<{ items: RequestLine[]; nextCursor: string | null; event?: RequestEvent }>(`${LINES}?${query}`, { token });
}

export function saveRequestLines(token: string, eventId: string, lines: LineInput[]) {
  return request<{ items: RequestLine[] }>(LINES, { method: "POST", token, body: { eventId, lines } });
}

export function updateRequestLine(token: string, id: string, line: LineInput) {
  return request<RequestLine>(`${LINES}/${encodeURIComponent(id)}`, { method: "PUT", token, body: line });
}

export function removeRequestLine(token: string, id: string) {
  return request<RequestLine>(`${LINES}/${encodeURIComponent(id)}/removal`, { method: "POST", token, body: {} });
}

export function changeLineStatus(token: string, id: string, change: StatusChangeInput) {
  return request<RequestLine>(`${LINES}/${encodeURIComponent(id)}/status`, { method: "POST", token, body: change });
}

/** Q1: leave `quantity` out to reserve the requested quantity; a quantity is passed through as entered, so the server can refuse it. */
export interface ReservationInput {
  quantity?: number;
  partial?: boolean;
}

export function reserveLine(token: string, id: string, input: ReservationInput) {
  return request<{ reservation: { id: string; reservedQuantity: number; requestedQuantity: number }; line: RequestLine }>(
    `${LINES}/${encodeURIComponent(id)}/reservation`,
    { method: "POST", token, body: input },
  );
}
