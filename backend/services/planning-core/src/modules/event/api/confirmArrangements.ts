import type { TransactionSql } from "postgres";
import { KAFKA_TOPICS, type EventStatus } from "@connectsphere/contracts";
import { evaluateTransition } from "../domain/statusMachine.js";
import { writeOutbox } from "../events/outbox.js";
import { latestStatusChangeAt } from "../repo/eventHistory.js";
import { transitionEvent } from "./transitionEvent.js";

/**
 * F5 — the event module's half of confirming the arrangements. The change module
 * decides whether the venue and equipment are ready; this applies F1's
 * CONFIRM_ARRANGEMENTS transition (Approved or Planning → Safety Review, CR-06),
 * which writes the history entry with the coordinator and the time, and writes
 * `event.arrangements-confirmed` in the same transaction (implementation.md §3.4).
 * Only the Safety Officer's approval (U1) moves the event on to Confirmed.
 */

/** F1's refusal for confirming an event in `status`, or null when the transition is permitted. */
export function arrangementsConfirmationRefusal(status: EventStatus): string | null {
  const outcome = evaluateTransition(status, "CONFIRM_ARRANGEMENTS");
  return outcome.permitted ? null : outcome.message;
}

/** Who F5 notifies besides the owner, as the venue and equipment modules read them. */
export interface ArrangementsNotice {
  bookings: { bookingId: string; reference: string; venueName: string; startsAt: string; endsAt: string; staffIds: string[] }[];
  reservations: { reservationId: string; equipmentTypeName: string; reservedQuantity: number; reservedBy: string }[];
}

export interface ConfirmedArrangements {
  id: string;
  reference: string | null;
  status: EventStatus;
  previousStatus: EventStatus;
  confirmedBy: string;
  confirmedAt: string;
}

export type ConfirmArrangementsOutcome =
  | { ok: true; event: ConfirmedArrangements }
  | { ok: false; message: string };

/** Call inside the transaction that locked the event and read its arrangements. */
export async function confirmEventArrangements(
  tx: TransactionSql,
  eventId: string,
  actor: { userId: string; role: string; correlationId?: string | null },
  notice: ArrangementsNotice
): Promise<ConfirmArrangementsOutcome> {
  const moved = await transitionEvent(tx, eventId, "CONFIRM_ARRANGEMENTS", { userId: actor.userId, role: actor.role });
  if (!moved.ok) return { ok: false, message: moved.message };

  const confirmedAt = await latestStatusChangeAt(tx, eventId);
  await writeOutbox(tx, {
    topic: KAFKA_TOPICS.event,
    messageType: "event.arrangements-confirmed",
    aggregateId: eventId,
    actor,
    correlationId: actor.correlationId ?? null,
    payload: {
      eventId,
      eventReference: moved.event.reference,
      eventName: moved.event.name,
      ownerId: moved.event.ownerId,
      confirmedBy: actor.userId,
      confirmedAt,
      bookings: notice.bookings,
      reservations: notice.reservations,
    },
  });

  return {
    ok: true,
    event: {
      id: eventId,
      reference: moved.event.reference,
      status: moved.event.status,
      previousStatus: moved.previousStatus,
      confirmedBy: actor.userId,
      confirmedAt,
    },
  };
}
