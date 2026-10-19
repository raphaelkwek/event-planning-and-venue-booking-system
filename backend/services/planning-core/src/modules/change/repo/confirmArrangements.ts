import type { TransactionSql } from "postgres";
import type { Role } from "@connectsphere/contracts";
import {
  arrangementsConfirmationRefusal,
  confirmEventArrangements,
  findEventForChange,
  type ConfirmedArrangements,
} from "../../event/index.js";
import { equipmentArrangementsForEvent, type EquipmentArrangementLine } from "../../equipment/index.js";
import { resolveAccessScope } from "../../identity/index.js";
import { venueArrangementsForEvent, type VenueArrangements } from "../../venue/index.js";
import {
  assessReadiness,
  type EquipmentOutstanding,
  type FlagOutstanding,
  type VenueOutstanding,
} from "../domain/readiness.js";

/**
 * F5 — the assigned coordinator confirms the event's arrangements. One core
 * transaction (implementation.md §4.7, ADR-0004):
 *
 * 1. Lock the event row (`for update`), in the caller's A3 scope.
 * 2. Refuse anyone but the assigned coordinator, and any status F1 does not let
 *    move to Safety Review.
 * 3. Read the venue and equipment arrangements live, through their modules'
 *    interfaces, which take the rows `for share` (AC4).
 * 4. Assess them (AC2, AC3, AC7) and, only when nothing is outstanding, apply the
 *    transition with its history entry and message.
 *
 * Every refusal returns before anything is written (AC10). Lock order is event,
 * then venue rows, then equipment rows; no other path locks those rows and then
 * the event, so this cannot deadlock with them.
 */

/** AC5 — the venue or equipment records could not be read; the caller's transaction rolls back. */
export class ArrangementsUnavailableError extends Error {
  constructor(cause: unknown) {
    super("The event's venue or equipment arrangements could not be read.", { cause });
    this.name = "ArrangementsUnavailableError";
  }
}

export type ConfirmOutcome =
  | { ok: true; event: ConfirmedArrangements }
  | { ok: false; code: "NOT_FOUND" }
  | { ok: false; code: "NOT_ASSIGNED" }
  | { ok: false; code: "STATUS_NOT_PERMITTED"; message: string }
  | {
      ok: false;
      code: "NOT_READY";
      message: string;
      venue: VenueOutstanding[];
      equipment: EquipmentOutstanding[];
      flags: FlagOutstanding[];
    };

async function readArrangements(
  tx: TransactionSql,
  eventId: string
): Promise<{ venue: VenueArrangements; lines: EquipmentArrangementLine[] }> {
  try {
    const venue = await venueArrangementsForEvent(tx, eventId);
    const lines = await equipmentArrangementsForEvent(tx, eventId);
    return { venue, lines };
  } catch (cause) {
    throw new ArrangementsUnavailableError(cause);
  }
}

export async function confirmArrangements(
  tx: TransactionSql,
  eventId: string,
  actor: { userId: string; role: Role; correlationId?: string | null }
): Promise<ConfirmOutcome> {
  const scope = resolveAccessScope(actor.role, actor.userId, "events");
  const event = await findEventForChange(tx, eventId, scope, actor.userId, { lock: "update" });
  if (!event) return { ok: false, code: "NOT_FOUND" };
  if (event.assignedCoordinatorId !== actor.userId) return { ok: false, code: "NOT_ASSIGNED" };

  const refusal = arrangementsConfirmationRefusal(event.status);
  if (refusal) return { ok: false, code: "STATUS_NOT_PERMITTED", message: refusal };

  const { venue, lines } = await readArrangements(tx, event.id);
  const readiness = assessReadiness({
    equipmentRequired: event.current.equipmentRequired ?? null,
    bookings: venue.bookings,
    requests: venue.requests,
    lines,
  });
  if (!readiness.ready) {
    const { message, venue: venueItems, equipment, flags } = readiness;
    return { ok: false, code: "NOT_READY", message, venue: venueItems, equipment, flags };
  }

  // AC9 — the Venue Staff of each booked venue and whoever reserved each reservation.
  const confirmed = await confirmEventArrangements(tx, event.id, actor, {
    bookings: venue.bookings.map((booking) => ({
      bookingId: booking.id,
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
              reservationId: line.reservation.id,
              equipmentTypeName: line.reservation.reservedTypeName,
              reservedQuantity: line.reservation.reservedQuantity,
              reservedBy: line.reservation.reservedBy,
            },
          ]
        : []
    ),
  });
  // The event row is locked and its status was checked above, so the transition cannot be refused here.
  if (!confirmed.ok) throw new Error(`F5 transition refused under lock: ${confirmed.message}`);
  return { ok: true, event: confirmed.event };
}
