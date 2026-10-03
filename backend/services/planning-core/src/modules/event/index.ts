import { Router } from "express";
import type { Sql } from "postgres";
import type { AccessScope, EventStatus } from "@connectsphere/contracts";
import { draftsRouter } from "./api/drafts.js";
import { eventsRouter } from "./api/events.js";
import { clarificationsRouter } from "./api/clarifications.js";
import { decisionsRouter } from "./api/decisions.js";
import { reassignmentsRouter } from "./api/reassignments.js";
import { findEventInScope } from "./repo/events.js";

/** The module's outbox table, for the outbox relay (implementation.md §3.4). */
export { EVENT_OUTBOX_TABLE } from "./events/outbox.js";

/**
 * The event module's public interface (ADR-0004). Other modules import this
 * file and nothing else under modules/event; `npm run lint:boundaries` fails
 * the build if they reach past it.
 */

export function eventRouter(sql: Sql): Router {
  const router = Router();
  router.use(draftsRouter(sql));
  router.use(clarificationsRouter(sql));
  router.use(decisionsRouter(sql));
  router.use(reassignmentsRouter(sql));
  // Last, so that its `/api/v1/events/:id` cannot shadow a more specific path above.
  router.use(eventsRouter(sql));
  return router;
}

/**
 * What another module may know about an event in order to plan for it: its
 * timing, attendance and requirements. K1 (venue suitability), J1 (prefilling
 * venue search) and O1 (defaulting equipment dates) read the event through this,
 * never through the event schema and never over HTTP.
 */
export interface EventPlanningView {
  id: string;
  reference: string | null;
  status: EventStatus;
  ownerId: string;
  assignedCoordinatorId: string | null;
  proposedStartAt: string | null;
  proposedEndAt: string | null;
  expectedAttendance: number | null;
  venueRequirements: unknown | null;
  accessibilityNeeds: string | null;
  equipmentRequired: boolean | null;
  equipmentRequirements: unknown | null;
}

/**
 * The event, if the caller may see it under the A3 scope rule; null when it does
 * not exist or is outside the caller's scope, which the caller turns into a 404.
 */
export async function findEventForPlanning(
  sql: Sql,
  eventId: string,
  scope: AccessScope,
  callerId: string
): Promise<EventPlanningView | null> {
  const event = await findEventInScope(sql, eventId, scope, callerId);
  if (!event) return null;

  return {
    id: event.id,
    reference: event.reference,
    status: event.status,
    ownerId: event.ownerId,
    assignedCoordinatorId: event.assignedCoordinatorId,
    proposedStartAt: event.proposedStartAt,
    proposedEndAt: event.proposedEndAt,
    expectedAttendance: event.expectedAttendance,
    venueRequirements: event.venueRequirements,
    accessibilityNeeds: event.accessibilityNeeds,
    equipmentRequired: event.equipmentRequired,
    equipmentRequirements: event.equipmentRequirements,
  };
}
