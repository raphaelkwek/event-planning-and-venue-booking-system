import type { Sql, TransactionSql } from "postgres";
import { findEventForPlanning, type EventPlanningView } from "../../event/index.js";
import type { ActorRequest } from "../auth/actor.js";
import { bufferConflicts } from "../domain/occupancy.js";
import { writeVenueOutbox } from "../events/outbox.js";
import { listLiveSlots, recordBufferConflicts } from "../repo/bufferConflicts.js";
import type { VenueRecord } from "../repo/venues.js";

/**
 * H3-T10 (CR-01) — after Venue Staff change a venue's setup or turnaround time,
 * in the same transaction and under the venue row lock: each live booking and
 * hold that now overlaps another is flagged Requires Reconfirmation, naming it,
 * and the event's assigned coordinator is told. Nothing is removed, released or
 * moved. A booking already flagged for the same overlap isn't told again.
 */

/** Flagged events are read whatever the caller's event scope: the change is scoped by venue. */
const ALL_EVENTS = { scopeType: "ALL" } as const;

/** One booking or hold the change newly made overlap another, as Venue Staff are shown it. */
export interface FlaggedBooking {
  kind: "BOOKING" | "HOLD";
  reference: string;
  eventReference: string | null;
  /** Every other booking's or hold's reference it now overlaps, soonest first. */
  overlapsReferences: string[];
}

export async function flagBufferConflicts(sql: Sql, tx: TransactionSql, req: ActorRequest, venue: VenueRecord): Promise<FlaggedBooking[]> {
  const actor = req.actor!;
  const slots = await listLiveSlots(tx, venue.id);
  const conflicts = bufferConflicts(slots, venue);
  const newlyFlagged = await recordBufferConflicts(tx, venue.id, conflicts, venue, actor.userId);

  const flagged: FlaggedBooking[] = [];
  const events = new Map<string, EventPlanningView | null>();
  for (const slot of slots.filter((s) => newlyFlagged.has(s.id))) {
    if (!events.has(slot.eventId)) events.set(slot.eventId, await findEventForPlanning(sql, slot.eventId, ALL_EVENTS, actor.userId));
    const event = events.get(slot.eventId) ?? null;
    const overlapsReferences = conflicts.filter((c) => c.slotId === slot.id).map((c) => c.overlapsReference);
    flagged.push({ kind: slot.kind, reference: slot.reference, eventReference: event?.reference ?? null, overlapsReferences });
    if (!event?.reference || !event.assignedCoordinatorId) continue;
    await writeVenueOutbox(tx, {
      messageType: "venue-booking.buffer-conflict-flagged",
      aggregateId: slot.id,
      actor,
      correlationId: req.header("x-correlation-id") ?? null,
      payload: {
        venueId: venue.id,
        venueName: venue.name,
        kind: slot.kind,
        reference: slot.reference,
        eventId: event.id,
        eventReference: event.reference,
        eventName: event.name,
        coordinatorId: event.assignedCoordinatorId,
        overlapsReferences,
        setupMinutes: venue.setupMinutes,
        turnaroundMinutes: venue.turnaroundMinutes,
        actedBy: actor.userId,
        actedAt: venue.updatedAt,
      },
    });
  }
  return flagged;
}
