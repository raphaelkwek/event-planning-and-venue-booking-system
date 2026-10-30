import type { TransactionSql } from "postgres";
import { KAFKA_TOPICS, type EventStatus } from "@connectsphere/contracts";
import { evaluateTransition } from "../domain/statusMachine.js";
import { writeOutbox } from "../events/outbox.js";
import { cancellationColumns } from "../repo/events.js";
import { transitionEvent } from "./transitionEvent.js";

/**
 * F3 — the event module's half of cancelling an event. The change module checks
 * who may cancel and reads the arrangements (and, with F4, releases them); this
 * applies F1's CANCEL transition with the reason, user and time in the same
 * statement (AC3), and writes `event.cancelled` in the same transaction
 * (implementation.md §3.4).
 */

/** F1's refusal for cancelling an event in `status`, or null when the transition is permitted. */
export function cancellationRefusal(status: EventStatus): string | null {
  const outcome = evaluateTransition(status, "CANCEL");
  return outcome.permitted ? null : outcome.message;
}

/** Who F3 notifies besides the owner and the coordinator, as the venue and equipment modules read them (AC6). */
export interface CancellationNotice {
  bookings: { reference: string; venueName: string; startsAt: string; endsAt: string; staffIds: string[] }[];
  reservations: { equipmentTypeName: string; reservedQuantity: number; reservedBy: string }[];
}

export interface CancelledEvent {
  id: string;
  reference: string | null;
  status: EventStatus;
  previousStatus: EventStatus;
  cancellationReason: string;
  cancelledBy: string;
  cancelledAt: string;
}

export type CancelEventOutcome = { ok: true; event: CancelledEvent } | { ok: false; message: string };

/** Call inside the transaction that locked the event and read its arrangements. */
export async function cancelEventRecord(
  tx: TransactionSql,
  eventId: string,
  actor: { userId: string; role: string; correlationId?: string | null },
  input: { reason: string; notice: CancellationNotice }
): Promise<CancelEventOutcome> {
  const moved = await transitionEvent(
    tx,
    eventId,
    "CANCEL",
    { userId: actor.userId, role: actor.role },
    { set: cancellationColumns(tx, actor.userId, input.reason), correlationId: actor.correlationId ?? null }
  );
  if (!moved.ok) return { ok: false, message: moved.message };

  const cancelledAt = moved.event.cancelledAt!;
  // A draft has no reference, and nobody but its owner, who cancelled it, is related to it.
  if (moved.event.reference) {
    await writeOutbox(tx, {
      topic: KAFKA_TOPICS.event,
      messageType: "event.cancelled",
      aggregateId: eventId,
      actor,
      correlationId: actor.correlationId ?? null,
      payload: {
        eventId,
        eventReference: moved.event.reference,
        eventName: moved.event.name,
        ownerId: moved.event.ownerId,
        assignedCoordinatorId: moved.event.assignedCoordinatorId,
        reason: input.reason,
        cancelledBy: actor.userId,
        cancelledAt,
        bookings: input.notice.bookings,
        reservations: input.notice.reservations,
      },
    });
  }

  return {
    ok: true,
    event: {
      id: eventId,
      reference: moved.event.reference,
      status: moved.event.status,
      previousStatus: moved.previousStatus,
      cancellationReason: input.reason,
      cancelledBy: actor.userId,
      cancelledAt,
    },
  };
}
