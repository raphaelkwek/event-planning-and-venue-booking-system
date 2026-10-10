import type { EventRecord, EventStatus } from "../api/types.js";

/**
 * G1 — who is offered "Edit details", and when. The server applies the same
 * rule whether or not the screen offered it; this only decides what to show.
 * Safety Review is editable for the time being (decided 11 Oct 2026).
 */
const EDITABLE: readonly EventStatus[] = ["APPROVED", "PLANNING", "SAFETY_REVIEW", "CONFIRMED"];

export function canEditDetails(event: EventRecord, session: { userId: string; role: string }): boolean {
  if (!EDITABLE.includes(event.status)) return false;
  if (session.role === "EVENT_ORGANISER") return session.userId === event.ownerId;
  if (session.role === "EVENT_COORDINATOR") return session.userId === event.assignedCoordinatorId;
  return false;
}
