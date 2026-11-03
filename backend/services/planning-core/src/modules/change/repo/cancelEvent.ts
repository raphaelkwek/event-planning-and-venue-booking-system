import type { TransactionSql } from "postgres";
import type { Role } from "@connectsphere/contracts";
import { cancellationRefusal, cancelEventRecord, findEventForChange, type CancelledEvent } from "../../event/index.js";
import { equipmentArrangementsForEvent } from "../../equipment/index.js";
import { resolveAccessScope } from "../../identity/index.js";
import { venueArrangementsForEvent } from "../../venue/index.js";
import { closePendingForCancelledEvent, lockPendingForEvent, type ChangeRequestRecord } from "./changeRequests.js";

/**
 * F3 — the owning organiser or the assigned coordinator cancels an event. One
 * core transaction (ADR-0004), as F5's confirmation:
 *
 * 1. Lock the event's pending change request, then the event (`for update`), in
 *    the caller's A3 scope. S2 takes the same two locks in the same order.
 * 2. Refuse anyone but the owner or the assigned coordinator, and any status F1
 *    does not let move to Cancelled (AC1).
 * 3. Read the venue and equipment arrangements through their modules'
 *    interfaces (`for share`), for who to notify (AC6).
 * 4. Close the pending change request (AC8, W9-07).
 * 5. Apply the transition with the reason, user and time, and write
 *    `event.cancelled` (AC3, AC6).
 *
 * Every refusal returns before anything is written. Any error rolls the whole
 * transaction back. Lock order is the change request, the event, then venue rows,
 * then equipment rows, as in S2, S3 and F5, so this cannot deadlock with them.
 */

export type CancelOutcome =
  | { ok: true; event: CancelledEvent; closedChangeRequest: ChangeRequestRecord | null }
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

  const closedChangeRequest = await closePendingForCancelledEvent(tx, event.id, actor.userId);

  const cancelled = await cancelEventRecord(tx, event.id, actor, { reason, notice });
  // The event row is locked and its status was checked above, so the transition cannot be refused here.
  if (!cancelled.ok) throw new Error(`F3 transition refused under lock: ${cancelled.message}`);
  return { ok: true, event: cancelled.event, closedChangeRequest };
}
