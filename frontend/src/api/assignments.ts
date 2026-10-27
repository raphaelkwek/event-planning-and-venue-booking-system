import { request } from "./client.js";

const EVENT = "/event/api/v1";

/** E3 — a request waiting in the Lead's unassigned queue. */
export interface UnassignedRequest {
  id: string;
  reference: string | null;
  name: string;
  proposedStartAt: string | null;
  proposedEndAt: string | null;
  expectedAttendance: number | null;
  submittedAt: string | null;
  status: string;
}

/** E3, E5 — an active Event Coordinator, with their number of active assigned events. */
export interface Coordinator {
  id: string;
  displayName: string | null;
  email: string;
  activeAssignments: number;
}

export interface Assignment {
  eventId: string;
  coordinatorId: string;
  assignedBy: string;
  assignedAt: string;
}

export function listUnassigned(token: string) {
  return request<{ items: UnassignedRequest[] }>(`${EVENT}/assignments/unassigned`, { token });
}

export function listCoordinators(token: string) {
  return request<{ items: Coordinator[] }>(`${EVENT}/coordinators`, { token });
}

export function assignCoordinator(token: string, eventId: string, coordinatorId: string) {
  return request<Assignment>(`${EVENT}/events/${eventId}/assignment`, { token, method: "POST", body: { coordinatorId } });
}
