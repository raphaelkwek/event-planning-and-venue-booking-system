import type { AccessScope, Resource, Role } from "@connectsphere/contracts";

/**
 * Resolves the access-scope rule a consuming service's repo layer must
 * apply for the given role and resource (A3). This function does not
 * know about events, venues, or equipment records — only the rule. The
 * consuming service applies it as a query-time filter, never a
 * UI-level filter (implementation.md §6).
 */
export function resolveAccessScope(role: Role, userId: string, resource: Resource): AccessScope {
  if (resource === "events") {
    switch (role) {
      case "EVENT_ORGANISER":
        return { scopeType: "OWNED_BY_USER", userId };
      // A4 (CR-05): a coordinator works only on the events the Lead assigned to them,
      // and sees no other (CQ-11 is open; the story owner chose no read-only view).
      case "EVENT_COORDINATOR":
        return { scopeType: "ASSIGNED_TO_USER", userId };
      // E5: the Lead sees every event, to oversee every assignment.
      case "EVENT_COORDINATOR_LEAD":
        return { scopeType: "ALL" };
      case "ATTENDEE":
        return { scopeType: "PUBLISHED_OPEN_REGISTRATION" };
      default:
        return { scopeType: "NONE" };
    }
  }

  if (resource === "venue_bookings") {
    return role === "VENUE_STAFF"
      ? { scopeType: "STAFF_OWNED_VENUES", staffUserId: userId }
      : { scopeType: "NONE" };
  }

  if (resource === "equipment_requests") {
    return role === "TECH_SUPPORT_STAFF"
      ? { scopeType: "STAFF_OWNED_EQUIPMENT", staffUserId: userId }
      : { scopeType: "NONE" };
  }

  return { scopeType: "NONE" };
}

/** The records that belong to an event, which A4's refusal names in place of the event. */
export type EventRecordKind = "booking request" | "hold" | "equipment request line" | "change request";

/**
 * A4 — what a 404 says when the events scope found nothing. A coordinator is
 * told the event (or the record on it) is not assigned to them, in the same
 * words whether it exists or not, so the refusal reveals nothing
 * (implementation.md §6). Every other role keeps the module's own wording.
 */
export function notInScopeMessage(role: Role, otherwise: string, record?: EventRecordKind): string {
  if (role !== "EVENT_COORDINATOR") return otherwise;
  return record
    ? `No ${record} with that id is on an event assigned to you.`
    : "No event with that reference is assigned to you.";
}
