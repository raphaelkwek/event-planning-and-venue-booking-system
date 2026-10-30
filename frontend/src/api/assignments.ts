import { request } from "./client.js";
import type { EventStatus } from "./types.js";

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

/** E4 — the Lead's reassignment, which takes effect at once. */
export interface Reassignment {
  eventId: string;
  coordinatorId: string;
  previousCoordinatorId: string;
  reassignedBy: string;
  reassignedAt: string;
}

export function reassignCoordinator(token: string, eventId: string, coordinatorId: string) {
  return request<Reassignment>(`${EVENT}/events/${eventId}/reassignment`, { token, method: "POST", body: { coordinatorId } });
}

/** E5 — an active event in the Lead's overview. */
export interface OverviewEvent {
  id: string;
  reference: string | null;
  name: string;
  status: EventStatus;
  assignedCoordinatorId: string | null;
}

/** E5 — one assignment in an event's history; `assignedBy` is null for one E1 made automatically. */
export interface AssignmentHistoryEntry {
  coordinatorId: string;
  assignedBy: string | null;
  rule: string;
  assignedAt: string;
  endedAt: string | null;
}

export function listAssignments(token: string, coordinatorId?: string) {
  const query = coordinatorId ? `?coordinatorId=${encodeURIComponent(coordinatorId)}` : "";
  return request<{ items: OverviewEvent[]; coordinators: Coordinator[] }>(`${EVENT}/assignments${query}`, { token });
}

export function listAssignmentHistory(token: string, eventId: string) {
  return request<{ items: AssignmentHistoryEntry[] }>(`${EVENT}/events/${eventId}/assignments`, { token });
}
