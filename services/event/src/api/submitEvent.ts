import type { Sql } from "postgres";
import { EVENT_TOPICS } from "@connectsphere/contracts";
import { config } from "../config.js";
import { allocateCoordinator } from "../domain/assignment.js";
import { insertSubmittedEvent, submitDraft, type EventFields, type EventRow } from "../repo/events.js";
import { insertAssignment, saveCursor, takeCursor } from "../repo/assignments.js";
import { insertHistory } from "../repo/statusHistory.js";
import { writeOutbox } from "../events/outbox.js";

/**
 * B1 + E1 — submission, whether the request was saved as a draft first (C2) or
 * submitted directly. Everything happens in one transaction: the event, its
 * history entry, the coordinator assignment, and the outbox rows that become
 * notifications. If any part fails none of it happened, and no submission
 * timestamp is recorded (B1's last acceptance criterion).
 *
 * A draft is submitted in place rather than copied: it is already the event.
 */
export async function submitEvent(
  sql: Sql,
  params: {
    ownerId: string;
    actorRole: string;
    correlationId: string | null;
  } & ({ draftId: string } | { fields: EventFields })
): Promise<EventRow | null> {
  return sql.begin(async (tx) => {
    const event =
      "draftId" in params
        ? await submitDraft(tx, params.draftId, params.ownerId)
        : await insertSubmittedEvent(tx, params.ownerId, params.fields);

    if (!event) return null;

    await insertHistory(tx, event.id, {
      previousStatus: "DRAFT",
      newStatus: "SUBMITTED",
      actorUserId: params.ownerId,
      actorRole: params.actorRole,
      triggeringAction: "draftId" in params ? "SUBMIT_FROM_DRAFT" : "SUBMIT",
    });

    await writeOutbox(tx, {
      topic: EVENT_TOPICS.submitted,
      messageType: "event.submitted",
      aggregateId: event.id,
      actor: { userId: params.ownerId, role: params.actorRole },
      correlationId: params.correlationId,
      payload: {
        eventId: event.id,
        eventReference: event.reference!,
        eventName: event.name,
        ownerId: event.ownerId,
        proposedStartAt: event.proposedStartAt!,
        proposedEndAt: event.proposedEndAt!,
        submittedAt: event.submittedAt!,
      },
    });

    // E1 — assignment is part of submission, not a separate user action.
    const allocation = allocateCoordinator(config.coordinatorPool, await takeCursor(tx));

    if (!allocation) {
      // E1 — with no eligible coordinator the event is still submitted and is
      // left awaiting assignment rather than refused.
      return event;
    }

    const assignment = await insertAssignment(
      tx,
      event.id,
      allocation.coordinatorId,
      allocation.assignmentRule,
      params.ownerId
    );
    await saveCursor(tx, allocation.nextCursor);

    await writeOutbox(tx, {
      topic: EVENT_TOPICS.coordinatorAssigned,
      messageType: "event.coordinator-assigned",
      aggregateId: event.id,
      actor: { userId: null, role: "SYSTEM" },
      correlationId: params.correlationId,
      payload: {
        eventId: event.id,
        eventReference: event.reference!,
        eventName: event.name,
        coordinatorId: assignment.coordinatorId,
        assignmentRule: assignment.assignmentRule,
        assignedAt: assignment.assignedAt,
      },
    });

    return { ...event, assignedCoordinatorId: assignment.coordinatorId };
  });
}
