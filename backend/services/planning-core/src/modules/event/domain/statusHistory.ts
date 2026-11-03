import type { EventStatus } from "@connectsphere/contracts";

/**
 * F2 — what each reader of an event's status history is shown.
 *
 * The current status is open to everyone who may see the event (A3). Who may read
 * the history is the policies' to say (EN-07, policies/resources/event.yaml,
 * `view_history`): the owning Event Organiser and the assigned Event Coordinator.
 * An attendee is never given it, whatever the scope says about the event itself.
 */

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
