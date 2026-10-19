import type { Sql } from "postgres";
import { KAFKA_TOPICS } from "@connectsphere/contracts";
import { eventConfig } from "../config.js";
import { allocateCoordinator } from "../domain/assignment.js";
import { submissionColumns, type EventFields, type EventRow } from "../repo/events.js";
import { insertDraft, isOwnedBy } from "../repo/drafts.js";
import { insertAssignment, saveCursor, takeCursor } from "../repo/assignments.js";
import { writeOutbox } from "../events/outbox.js";
import { transitionEvent } from "./transitionEvent.js";

/**
 * B1 + E1 — submission, whether the request was saved as a draft first (C2) or
 * submitted directly. Everything happens in one transaction: the event, its
 * history entry, the coordinator assignment, and the outbox rows that become
 * notifications. If any part fails none of it happened, and no submission
 * timestamp is recorded (B1's last acceptance criterion).
 *
 * A request comes into existence as a Draft, and the SUBMIT transition is the
 * only way out of Draft (F1) — so a direct submission is inserted as a draft
 * and submitted in the same transaction. The caller has already established
 * that a draft being submitted belongs to the submitting organiser.
 */
export type SubmitResult = { ok: true; event: EventRow } | { ok: false; message: string };

export async function submitEvent(
  sql: Sql,
  params: {
    ownerId: string;
    actorRole: string;
    correlationId: string | null;
  } & ({ draftId: string; fields?: EventFields } | { fields: EventFields })
): Promise<SubmitResult> {
  return sql.begin(async (tx) => {
    const fromDraft = "draftId" in params;
    if (fromDraft && !(await isOwnedBy(tx, params.draftId, params.ownerId))) {
      // Callers have already checked; this is defence in depth.
      return { ok: false as const, message: "No draft with that reference is available to you." };
    }
    const draftId = fromDraft
      ? params.draftId
      : (await insertDraft(tx, params.ownerId, params.fields)).id;

    const submitted = await transitionEvent(
      tx,
      draftId,
      "SUBMIT",
      { userId: params.ownerId, role: params.actorRole },
      { set: submissionColumns(tx, fromDraft ? params.fields : undefined) }
    );
    if (!submitted.ok) {
      // The draft was inserted in this transaction: returning normally would
      // commit an orphan Draft, so throw and let it roll back.
      if (!fromDraft) {
        throw new Error(
          "submitEvent: a request inserted in this transaction could not be submitted: " + submitted.message
        );
      }
      return { ok: false as const, message: submitted.message };
    }
    const event = submitted.event;

    await writeOutbox(tx, {
      topic: KAFKA_TOPICS.event,
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
    const allocation = allocateCoordinator(eventConfig.coordinatorPool, await takeCursor(tx));

    if (!allocation) {
      // E1 — with no eligible coordinator the event is still submitted and is
      // left awaiting assignment rather than refused.
      return { ok: true as const, event };
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
      topic: KAFKA_TOPICS.event,
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

    return { ok: true as const, event: { ...event, assignedCoordinatorId: assignment.coordinatorId } };
  });
}
