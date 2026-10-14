import type { EventStatus, Role } from "@connectsphere/contracts";

/**
 * F2 — who may read an event's status history, and what each reader is shown.
 *
 * The current status is open to everyone who may see the event (A3). The history
 * is for the internal roles that work the event: an Event Organiser (the access
 * scope limits them to their own events) and Event Coordinators. An attendee is
 * never given it, whatever the scope says about the event itself.
 */
export const HISTORY_ROLES: readonly Role[] = ["EVENT_ORGANISER", "EVENT_COORDINATOR"];

export function canViewHistory(role: Role): boolean {
  return HISTORY_ROLES.includes(role);
}

/** A status-change row of event.event_history, as the repo reads it. */
export interface StatusHistoryRow {
  id: string;
  previousStatus: EventStatus | null;
  newStatus: EventStatus;
  actorUserId: string | null;
  actorRole: string;
  triggeringAction: string;
  occurredAt: Date;
}

export interface StatusHistoryEntry {
  id: string;
  previousStatus: EventStatus | null;
  newStatus: EventStatus;
  actorUserId: string | null;
  actorRole: string;
  triggeringAction: string;
  occurredAt: string;
}

export function toHistoryEntry(row: StatusHistoryRow): StatusHistoryEntry {
  return {
    id: row.id,
    previousStatus: row.previousStatus,
    newStatus: row.newStatus,
    actorUserId: row.actorUserId,
    actorRole: row.actorRole,
    triggeringAction: row.triggeringAction,
    occurredAt: row.occurredAt.toISOString(),
  };
}

/**
 * What every reader of the event gets: its id and current status. Nothing else
 * is copied across, so a rejection reason, a review comment or a coordinator
 * cannot reach an attendee through this view by being added to the event later.
 */
export function toStatusView(event: { id: string; status: EventStatus }): {
  eventId: string;
  status: EventStatus;
} {
  return { eventId: event.id, status: event.status };
}
