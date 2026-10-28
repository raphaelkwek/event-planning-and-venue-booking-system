import type { TransactionSql } from "postgres";
import { isSignificantEventField, KAFKA_TOPICS, type Role } from "@connectsphere/contracts";
import { returnToPlanningAfterChange, type EventForChange, type ProposedChanges } from "../../event/index.js";
import { bookingsForImpact, flagBookings } from "../../venue/index.js";
import { flagReservations, reservationsForImpact } from "../../equipment/index.js";
import { assessChangeImpact, valuesAfterChange, type ChangeImpact } from "../domain/changeImpact.js";
import { writeOutbox } from "../events/outbox.js";

/**
 * S3 (SPM-59) — applies an approved change's impact on the event's
 * arrangements, inside the approval's transaction: reads the confirmed
 * bookings and reservations, assesses them against the event's new values
 * (AC1–AC5), stores each flag through the owning module, returns a Confirmed
 * event to Planning (AC7, Week 9 W9-22) and writes one
 * `change-request.arrangements-flagged` message when anything was flagged
 * (AC10). Any error here rolls the whole approval back (AC11).
 */

export type AppliedChangeImpact = ChangeImpact & { returnedToPlanning: boolean };

export async function flagArrangementsForChange(
  tx: TransactionSql,
  event: EventForChange & { reference: string },
  changeRequestId: string,
  changes: ProposedChanges,
  actor: { userId: string; role: Role; correlationId?: string | null }
): Promise<AppliedChangeImpact> {
  const bookings = await bookingsForImpact(tx, event.id);
  const reservations = await reservationsForImpact(tx, event.id);

  const impact = assessChangeImpact({
    bookings,
    reservations,
    after: valuesAfterChange(event.current, changes),
    changedFields: Object.keys(changes).filter(isSignificantEventField),
  });

  await flagBookings(tx, event.id, changeRequestId, impact.bookingFlags);
  await flagReservations(tx, event.id, changeRequestId, impact.reservationFlags);

  // Week 9 W9-22: every significant field is material, so any approved change to a
  // Confirmed event returns it to Planning. No other status moves (AC6).
  let returnedToPlanning = false;
  if (event.status === "CONFIRMED") {
    const moved = await returnToPlanningAfterChange(tx, event.id, actor, { correlationId: actor.correlationId ?? null });
    // The event row is locked by the approval, so a refusal here means the table is wrong.
    if (!moved.ok) throw new Error(`Could not return event ${event.id} to Planning: ${moved.message}`);
    returnedToPlanning = true;
  }

  if (impact.bookingFlags.length + impact.reservationFlags.length > 0) {
    const bookingById = new Map(bookings.map((booking) => [booking.id, booking]));
    const reservationById = new Map(reservations.map((reservation) => [reservation.id, reservation]));
    await writeOutbox(tx, {
      topic: KAFKA_TOPICS.event,
      messageType: "change-request.arrangements-flagged",
      aggregateId: event.id,
      actor,
      correlationId: actor.correlationId ?? null,
      payload: {
        eventId: event.id,
        eventReference: event.reference,
        eventName: event.name,
        changeRequestId,
        bookings: impact.bookingFlags.map((flag) => {
          const booking = bookingById.get(flag.bookingId)!;
          return { reference: booking.reference, venueName: booking.venueName, flag: flag.flag, reason: flag.reason, staffIds: booking.staffIds };
        }),
        reservations: impact.reservationFlags.map((flag) => {
          const reservation = reservationById.get(flag.reservationId)!;
          return { equipmentTypeName: reservation.equipmentTypeName, flag: flag.flag, reason: flag.reason, reservedBy: reservation.reservedBy };
        }),
        returnedToPlanning,
      },
    });
  }

  return { ...impact, returnedToPlanning };
}
