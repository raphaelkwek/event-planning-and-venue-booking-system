import { Router } from "express";
import type { Sql, TransactionSql } from "postgres";
import type { AccessScope, EventStatus } from "@connectsphere/contracts";
import { draftsRouter } from "./api/drafts.js";
import { eventsRouter } from "./api/events.js";
import { leadAssignmentsRouter } from "./api/leadAssignments.js";
import { clarificationsRouter } from "./api/clarifications.js";
import { decisionsRouter } from "./api/decisions.js";
import { reassignmentsRouter } from "./api/reassignments.js";
import { eventDetailsRouter } from "./api/eventDetails.js";
import { statusHistoryRouter } from "./api/statusHistory.js";
import { findEventInScope, findReferences } from "./repo/events.js";
import type { ChangeableEvent } from "./domain/proposedChange.js";

export { checkProposedChange, type ChangeableEvent, type ProposedChanges } from "./domain/proposedChange.js";

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
  router.use(leadAssignmentsRouter(sql));
  router.use(eventDetailsRouter(sql));
  router.use(statusHistoryRouter(sql));
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
  name: string;
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
    name: event.name,
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

/** S1 — what the change module needs to check and snapshot a change request. */
export interface EventForChange {
  id: string;
  reference: string | null;
  name: string;
  status: EventStatus;
  ownerId: string;
  assignedCoordinatorId: string | null;
  current: ChangeableEvent;
}

/**
 * The event under the A3 scope rule, with its current values; null when absent or out of scope (404).
 * With `lock`, called inside a transaction, the event row is locked ("share" or "update") until it
 * ends, so the values checked and snapshotted are the ones the request is stored against.
 */
export async function findEventForChange(
  sql: Sql | TransactionSql,
  eventId: string,
  scope: AccessScope,
  callerId: string,
  options: { lock?: "share" | "update" } = {}
): Promise<EventForChange | null> {
  const event = await findEventInScope(sql, eventId, scope, callerId, options);
  if (!event) return null;

  return {
    id: event.id,
    reference: event.reference,
    name: event.name,
    status: event.status,
    ownerId: event.ownerId,
    assignedCoordinatorId: event.assignedCoordinatorId,
    current: {
      name: event.name,
      purpose: event.purpose,
      description: event.description,
      proposedStartAt: event.proposedStartAt,
      proposedEndAt: event.proposedEndAt,
      expectedAttendance: event.expectedAttendance,
      registrationRequired: event.registrationRequired,
      registrationOpensAt: event.registrationOpensAt,
      registrationClosesAt: event.registrationClosesAt,
      equipmentRequired: event.equipmentRequired,
      venueRequirements: event.venueRequirements,
      equipmentRequirements: event.equipmentRequirements,
    },
  };
}

/**
 * I1 — the reference of each event among `eventIds` that exists, so the venue
 * calendar can label a booking with its event reference. Only the reference:
 * the calendar is open to every internal role, so it carries nothing an
 * organiser outside the event's scope (A3) should not see.
 */
export function findEventReferences(sql: Sql, eventIds: readonly string[]): Promise<Map<string, string | null>> {
  return findReferences(sql, eventIds);
}

/** S2 — writes an approved change's values and field history inside the caller's transaction. */
export { applyApprovedChange } from "./repo/events.js";

/** F5 — the change module checks readiness, then moves the event to Safety Review through these. */
export {
  arrangementsConfirmationRefusal,
  confirmEventArrangements,
  type ArrangementsNotice,
  type ConfirmArrangementsOutcome,
  type ConfirmedArrangements,
} from "./api/confirmArrangements.js";
/** I3 — a block over confirmed bookings returns their Confirmed events to Planning. */
export { blockReturnsToPlanning, returnBlockedEventsToPlanning } from "./api/venueBlocked.js";
/** F3 — the change module checks who may cancel and frees the arrangements, then cancels the event through these. */
export {
  cancellationRefusal,
  cancelEventRecord,
  type CancellationNotice,
  type CancelEventOutcome,
  type CancelledEvent,
} from "./api/cancelEvent.js";
/** EN-11 — the completion workflow's step: complete one event if its end has passed (ADR-0009). */
export { completeEventIfDue, type CompletionAttempt } from "./jobs/completeEvents.js";
