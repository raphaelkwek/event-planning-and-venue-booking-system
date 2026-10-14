import { request } from "./client.js";
import type { EventStatus } from "./types.js";

const EVENT = "/event/api/v1";

/** F2 — one status change in an event's history. */
export interface StatusHistoryEntry {
  id: string;
  previousStatus: EventStatus | null;
  newStatus: EventStatus;
  actorUserId: string | null;
  actorRole: string;
  triggeringAction: string;
  occurredAt: string;
}

export interface StatusHistory {
  eventId: string;
  status: EventStatus;
  items: StatusHistoryEntry[];
}

/** F2 — the event's status changes, oldest first. Internal roles only; read only. */
export function getStatusHistory(token: string, eventId: string) {
  return request<StatusHistory>(`${EVENT}/events/${eventId}/status-history`, { token });
}
