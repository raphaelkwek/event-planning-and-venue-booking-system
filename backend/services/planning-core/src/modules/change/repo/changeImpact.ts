import type { TransactionSql } from "postgres";
import { KAFKA_TOPICS, type Role } from "@connectsphere/contracts";
import { findEventForChange, returnToPlanningAfterChange, type EventForChange, type ProposedChanges } from "../../event/index.js";
import { resolveAccessScope } from "../../identity/index.js";
import { bookingsForImpact, flagBookings } from "../../venue/index.js";
import { flagReservations, reservationsForImpact } from "../../equipment/index.js";
import { assessProposedChange, type ChangeImpact } from "../domain/changeImpact.js";
import { proposedChanges } from "../domain/changeRequests.js";
import { writeOutbox } from "../events/outbox.js";
import { findRequest } from "./changeRequests.js";

/**
 * S3 (SPM-59) — applies an approved change's impact on the event's
 * arrangements, inside the approval's transaction: reads the confirmed
 * bookings, held holds, pending booking requests and reservations, assesses them against the event's new values
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
  const impact = assessProposedChange({ bookings, reservations, current: event.current, changes });

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
          return {
            arrangement: booking.arrangement,
            reference: booking.reference,
            venueName: booking.venueName,
            flag: flag.flag,
            reason: flag.reason,
            staffIds: booking.staffIds,
          };
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

/**
 * G2 (SPM-31) — what approving `changes` would do to the event's arrangements (AC2, AC3): the
 * same reads and the same assessment as `flagArrangementsForChange`, without locking a row or
 * writing anything (AC4). Run it in a `read only` transaction.
 */
export async function previewChangeImpact(
  tx: TransactionSql,
  event: Pick<EventForChange, "id" | "current">,
  changes: ProposedChanges
): Promise<ChangeImpact> {
  const bookings = await bookingsForImpact(tx, event.id, { lock: false });
  const reservations = await reservationsForImpact(tx, event.id, { lock: false });
  return assessProposedChange({ bookings, reservations, current: event.current, changes });
}

export type PreviewOutcome =
  | { ok: true; impact: ChangeImpact }
  | { ok: false; code: "NOT_FOUND" }
  | { ok: false; code: "ALREADY_DECIDED"; status: "APPROVED" | "REJECTED"; decidedAt: string };

/** Who may see a request's preview: its event's owner, and Event Coordinators (the assigned one among them). */
const PREVIEWERS: readonly Role[] = ["EVENT_ORGANISER", "EVENT_COORDINATOR"];

/**
 * G2 — a change request's preview, for an actor who can see the request (S1's rule: the event in
 * the actor's A3 scope, so the owning organiser and Event Coordinators; anyone else, as for a
 * request that does not exist, gets NOT_FOUND). Only a Pending request has one: a decided request
 * answers ALREADY_DECIDED, since S3 already reported what approval did.
 */
export async function previewChangeRequest(
  tx: TransactionSql,
  requestId: string,
  actor: { userId: string; role: Role }
): Promise<PreviewOutcome> {
  if (!PREVIEWERS.includes(actor.role)) return { ok: false, code: "NOT_FOUND" };
  const request = await findRequest(tx, requestId);
  if (!request) return { ok: false, code: "NOT_FOUND" };
  const scope = resolveAccessScope(actor.role, actor.userId, "events");
  const event = await findEventForChange(tx, request.eventId, scope, actor.userId);
  if (!event) return { ok: false, code: "NOT_FOUND" };
  if (request.status !== "PENDING") {
    // The check constraint gives every decided request a decision time.
    return { ok: false, code: "ALREADY_DECIDED", status: request.status, decidedAt: request.decidedAt! };
  }
  return { ok: true, impact: await previewChangeImpact(tx, event, proposedChanges(request.fields)) };
}
