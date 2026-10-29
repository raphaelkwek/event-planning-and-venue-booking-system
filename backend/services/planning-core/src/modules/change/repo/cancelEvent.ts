import type { TransactionSql } from "postgres";
import type { Role } from "@connectsphere/contracts";
import { cancellationRefusal, cancelEventRecord, findEventForChange, type CancelledEvent } from "../../event/index.js";
import { equipmentArrangementsForEvent, releaseEventReservations } from "../../equipment/index.js";
import { resolveAccessScope } from "../../identity/index.js";
import {
  EVENT_CANCELLED,
  lockVenuesForEvent,
  releaseVenueArrangementsForEvent,
  venueArrangementsForEvent,
} from "../../venue/index.js";
import { closePendingForCancelledEvent, lockPendingForEvent, type ChangeRequestRecord } from "./changeRequests.js";

/**
 * F3 — the owning organiser or the assigned coordinator cancels an event. One
 * core transaction (ADR-0004), as F5's confirmation:
 *
 * 1. Lock the event's pending change request, then the event (`for update`), in
 *    the caller's A3 scope. S2 takes the same two locks in the same order.
 * 2. Refuse anyone but the owner or the assigned coordinator, and any status F1
 *    does not let move to Cancelled (AC1).
 * 3. Lock the event's venues, then read the venue and equipment arrangements
 *    through their modules' interfaces (`for share`), for who to notify (AC6).
 * 4. F4: release the bookings and holds, withdraw the pending venue requests,
 *    and release the reservations, each recording "event cancelled", the user
 *    and the time (F4 AC1–AC3, AC6). Anything already released is skipped (AC7).
 * 5. Close the pending change request (AC8, W9-07).
 * 6. Apply the transition with the reason, user and time, and write
 *    `event.cancelled` (AC3, AC6).
 *
 * Every refusal returns before anything is written. Any error rolls the whole
 * transaction back, so a failed release leaves the event in its status and
 * nothing released (F4 AC5). Lock order is the change request, the event, its
 * venues, their slots and requests, then equipment rows: the same order as S2,
 * M1 (venue, then slot) and Q1 (event, line, type), so this cannot deadlock with them.
 *
 * Registrations (F4 AC4) wait for EN-13: there is no registration service yet,
 * so `released.registrations` is always 0 and no attendee is notified. ADR-0009's
 * CancelEvent workflow exists only to hold registrations in that service while
 * this transaction runs, and joins with EN-13.
 */

/** F4 — what the cancellation released, by reference, for the response. */
export interface ReleasedOnCancellation {
  bookings: string[];
  holds: string[];
  requests: string[];
  reservations: { reservationId: string; equipmentTypeName: string; reservedQuantity: number }[];
  /** Always 0 until EN-13's registration service exists. */
  registrations: number;
}

export type CancelOutcome =
  | { ok: true; event: CancelledEvent; closedChangeRequest: ChangeRequestRecord | null; released: ReleasedOnCancellation }
  | { ok: false; code: "NOT_FOUND" }
  | { ok: false; code: "NOT_PERMITTED" }
  | { ok: false; code: "STATUS_NOT_PERMITTED"; message: string };

export async function cancelEvent(
  tx: TransactionSql,
  eventId: string,
  reason: string,
  actor: { userId: string; role: Role; correlationId?: string | null }
): Promise<CancelOutcome> {
  await lockPendingForEvent(tx, eventId);
  const scope = resolveAccessScope(actor.role, actor.userId, "events");
  const event = await findEventForChange(tx, eventId, scope, actor.userId, { lock: "update" });
  if (!event) return { ok: false, code: "NOT_FOUND" };
  if (event.ownerId !== actor.userId && event.assignedCoordinatorId !== actor.userId) {
    return { ok: false, code: "NOT_PERMITTED" };
  }

  const refusal = cancellationRefusal(event.status);
  if (refusal) return { ok: false, code: "STATUS_NOT_PERMITTED", message: refusal };

  // AC6 — the Venue Staff of each booked venue and whoever reserved each reservation.
  await lockVenuesForEvent(tx, event.id);
  const venue = await venueArrangementsForEvent(tx, event.id);
  const lines = await equipmentArrangementsForEvent(tx, event.id);
  const notice = {
    bookings: venue.bookings
      .filter((booking) => booking.status === "CONFIRMED")
      .map((booking) => ({
        reference: booking.reference,
        venueName: booking.venueName,
        startsAt: booking.startsAt,
        endsAt: booking.endsAt,
        staffIds: booking.staffIds,
      })),
    reservations: lines.flatMap((line) =>
      line.reservation
        ? [
            {
              equipmentTypeName: line.reservation.reservedTypeName,
              reservedQuantity: line.reservation.reservedQuantity,
              reservedBy: line.reservation.reservedBy,
            },
          ]
        : []
    ),
  };

  // F4 — every release in this transaction, so a failure leaves nothing released (AC5).
  const venueReleased = await releaseVenueArrangementsForEvent(tx, event.id, actor.userId);
  const reservations = await releaseEventReservations(tx, event.id, actor, EVENT_CANCELLED);
  const released: ReleasedOnCancellation = {
    ...venueReleased,
    reservations: lines.flatMap((line) =>
      line.reservation && reservations.some((outcome) => outcome.reservation.id === line.reservation!.id)
        ? [
            {
              reservationId: line.reservation.id,
              equipmentTypeName: line.reservation.reservedTypeName,
              reservedQuantity: line.reservation.reservedQuantity,
            },
          ]
        : []
    ),
    registrations: 0,
  };

  const closedChangeRequest = await closePendingForCancelledEvent(tx, event.id, actor.userId);

  const cancelled = await cancelEventRecord(tx, event.id, actor, { reason, notice });
  // The event row is locked and its status was checked above, so the transition cannot be refused here.
  if (!cancelled.ok) throw new Error(`F3 transition refused under lock: ${cancelled.message}`);
  return { ok: true, event: cancelled.event, closedChangeRequest, released };
}
