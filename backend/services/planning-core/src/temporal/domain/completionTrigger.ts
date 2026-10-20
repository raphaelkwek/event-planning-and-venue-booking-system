/**
 * EN-11 — which event messages start or reset an event's CompleteEvent
 * workflow (ADR-0009). Pure: the consumer parses the message, asks this, and
 * signal-with-starts the workflow it names.
 */

/** One workflow per event, so a second start for the same event finds the first. */
export function completeEventWorkflowId(eventId: string): string {
  return `complete-event-${eventId}`;
}

/** The parts of a parsed event message (contracts' parseCloudEvent) this reads. */
export interface EventMessage {
  type: string;
  data: Record<string, unknown>;
}

export interface CompletionSchedule {
  eventId: string;
  endsAt: string;
}

/**
 * Only a Confirmed event completes (F1), so the workflow is started when an
 * event becomes Confirmed, and reset when a Confirmed event's end moves. A
 * Confirmed event without an end has nothing to wait for. Every other message
 * is none of the workflow's business.
 */
export function completionScheduleFor(message: EventMessage): CompletionSchedule | null {
  const { data } = message;
  const confirmed =
    (message.type === "event.status-changed" && data.newStatus === "CONFIRMED") ||
    (message.type === "event.schedule-changed" && data.status === "CONFIRMED");
  if (!confirmed || typeof data.eventId !== "string" || typeof data.proposedEndAt !== "string") return null;
  return { eventId: data.eventId, endsAt: data.proposedEndAt };
}
