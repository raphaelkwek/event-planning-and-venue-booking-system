import type { TransactionSql } from "postgres";
import type { Role } from "@connectsphere/contracts";
import { cancellationRefusal, cancelEventRecord, findEventForChange, type CancelledEvent } from "../../event/index.js";
import { equipmentArrangementsForEvent, releaseEventReservations } from "../../equipment/index.js";
import { resolveAccessScope } from "../../identity/index.js";
import { unlockedVenues } from "../domain/cancellation.js";
import {
  EVENT_CANCELLED,
  liveVenueIdsForEvent,
  lockVenuesForEvent,
  releaseVenueArrangementsForEvent,
  venueArrangementsForEvent,
} from "../../venue/index.js";
import { closePendingForCancelledEvent, lockPendingForEvent, type ChangeRequestRecord } from "./changeRequests.js";

/**
 * F3 — the owning organiser or the assigned coordinator cancels an event. One
 * core transaction (ADR-0004), as F5's confirmation:
 *
 * 1. Lock the event's pending change request (S2 takes it before the event too),
 *    then the row of every venue where the event has a live arrangement, in
 *    ascending id, then the event (`for update`), in the caller's A3 scope.
 * 2. Refuse anyone but the owner or the assigned coordinator, and any status F1
 *    does not let move to Cancelled (AC1).
 * 3. Read the venue and equipment arrangements through their modules'
 *    interfaces (`for share`), for who to notify (AC6).
 * 4. F4: release the bookings and holds, withdraw the pending venue requests,
 *    and release the reservations, each recording "event cancelled", the user
 *    and the time (F4 AC1–AC3, AC6). Anything already released is skipped (AC7).
 * 5. Close the pending change request (AC8, W9-07).
 * 6. Apply the transition with the reason, user and time, and write
 *    `event.cancelled` (AC3, AC6).
 *
 * Every refusal returns before anything is written. Any error rolls the whole
 * transaction back, so a failed release leaves the event in its status and
 * nothing released (F4 AC5).
 *
 * Lock order: the change request, the venues (ascending id), the event, then
 * the venue module's holds, requests and slots, then equipment rows. That is
 * the venue module's order (implementation.md §4.6: venue rows, then event
 * rows, then holds, requests and slots), so a block at one of the event's
 * venues (I2 locks the venue, then the events it returns to Planning) waits
 * for the cancellation or the cancellation waits for it; neither holds what the
 * other needs. It also matches S2 (change request, then event), M1 (venue, then
 * slot) and Q1 (event, line, type). The venues are locked before the scope and
 * status checks, so a refused cancellation can briefly hold them; it writes
 * nothing.
 *
 * A hold or request at a venue not locked yet can commit between the venue
 * locks and the event lock. Locking that venue now would put it after the
 * event, so a block there could deadlock with the cancellation. So once the
 * event is locked its venues are read again, and if it has gained one the
 * attempt returns `VENUES_CHANGED` having written nothing; the route ends the
 * transaction and tries again, locking the new venue first (at most
 * `CANCELLATION_ATTEMPTS` times, then 409 `CANCELLATION_CONTENDED`). The
 * re-read is complete: L1 and L3 create a request or hold only while holding
 * the event `for share`, so none commits once the cancellation holds it.
 *
 * Registrations (F4 AC4) are not released here. EN-13's registration service
 * builds seats from venue approvals, and R1–R4 (#80) and R5–R7 (#88) add the
 * consumer of `event.cancelled` (`connectsphere.event.v1`) that cancels the
 * event's registrations and waitlist and tells its attendees. So
 * `released.registrations` is 0: this transaction cannot read another
 * service's schema. ADR-0009's CancelEvent workflow is not built; that consumer
 * takes its place.
 */

/** F4 — what the cancellation released, by reference, for the response. */
export interface ReleasedOnCancellation {
  bookings: string[];
  holds: string[];
  requests: string[];
  reservations: { reservationId: string; equipmentTypeName: string; reservedQuantity: number }[];
  /** Always 0: the registration service releases registrations when it consumes `event.cancelled`. */
  registrations: number;
}

export type CancelOutcome =
  | { ok: true; event: CancelledEvent; closedChangeRequest: ChangeRequestRecord | null; released: ReleasedOnCancellation }
  | { ok: false; code: "NOT_FOUND" }
  /** The event gained a venue arrangement after its venues were locked; nothing was written, so try again. */
  | { ok: false; code: "VENUES_CHANGED" }
  | { ok: false; code: "NOT_PERMITTED" }
  | { ok: false; code: "STATUS_NOT_PERMITTED"; message: string };

export async function cancelEvent(
  tx: TransactionSql,
  eventId: string,
  reason: string,
  actor: { userId: string; role: Role; correlationId?: string | null }
): Promise<CancelOutcome> {
  await lockPendingForEvent(tx, eventId);
  // Venues before the event (§4.6): I2's block locks the venue, then the events it returns to Planning.
  const lockedVenues = await lockVenuesForEvent(tx, eventId);
  const scope = resolveAccessScope(actor.role, actor.userId, "events");
  const event = await findEventForChange(tx, eventId, scope, actor.userId, { lock: "update" });
  if (!event) return { ok: false, code: "NOT_FOUND" };
  if (event.ownerId !== actor.userId && event.assignedCoordinatorId !== actor.userId) {
    return { ok: false, code: "NOT_PERMITTED" };
  }

  const refusal = cancellationRefusal(event.status);
  if (refusal) return { ok: false, code: "STATUS_NOT_PERMITTED", message: refusal };

  // §4.6: no venue is locked after the event. One the event gained meanwhile means starting over.
  if (unlockedVenues(lockedVenues, await liveVenueIdsForEvent(tx, event.id)).length > 0) return { ok: false, code: "VENUES_CHANGED" };

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
