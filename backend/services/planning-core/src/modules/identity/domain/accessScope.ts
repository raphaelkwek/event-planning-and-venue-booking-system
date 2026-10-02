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
      case "EVENT_COORDINATOR":
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
