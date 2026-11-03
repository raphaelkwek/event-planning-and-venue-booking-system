import { z } from "zod";

export const RESOURCES = ["events", "venue_bookings", "equipment_requests"] as const;
export type Resource = (typeof RESOURCES)[number];

export const ROLES = [
  "EVENT_ORGANISER",
  "EVENT_COORDINATOR",
  "VENUE_STAFF",
  "TECH_SUPPORT_STAFF",
  "ATTENDEE",
  // E3 to E5 (CR-05): assigns, reassigns and oversees coordinators; coordinates no event (W9-35).
  "EVENT_COORDINATOR_LEAD",
  // U1 (CR-06): records the operational safety decision on events in Safety Review.
  "SAFETY_OFFICER",
] as const;
export type Role = (typeof ROLES)[number];

export const accessScopeSchema = z.discriminatedUnion("scopeType", [
  z.object({ scopeType: z.literal("OWNED_BY_USER"), userId: z.string().uuid() }),
  z.object({ scopeType: z.literal("ALL") }),
  // A4 (CR-05): an Event Coordinator's events are the ones assigned to them.
  z.object({ scopeType: z.literal("ASSIGNED_TO_USER"), userId: z.string().uuid() }),
  z.object({ scopeType: z.literal("STAFF_OWNED_VENUES"), staffUserId: z.string().uuid() }),
  z.object({ scopeType: z.literal("STAFF_OWNED_EQUIPMENT"), staffUserId: z.string().uuid() }),
  z.object({ scopeType: z.literal("PUBLISHED_OPEN_REGISTRATION") }),
  z.object({ scopeType: z.literal("NONE") }),
]);

export type AccessScope = z.infer<typeof accessScopeSchema>;
