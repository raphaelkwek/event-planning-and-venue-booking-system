import type { Sql, TransactionSql } from "postgres";
import { findEventForPlanning, type EventPlanningView } from "../../event/index.js";
import type { ActorRequest } from "../auth/actor.js";
import { bufferConflicts } from "../domain/occupancy.js";
import { writeVenueOutbox } from "../events/outbox.js";
import { listLiveSlots, listPendingRequests, openConflictKeys, recordBufferConflicts } from "../repo/bufferConflicts.js";
import type { VenueRecord } from "../repo/venues.js";

/**
 * H3-T10, H3-T11 (CR-01) — after Venue Staff change a venue's setup or
 * turnaround time, in the same transaction and under the venue row lock: each
 * live booking, hold and pending request that now overlaps another is flagged
 * Requires Reconfirmation, naming it, and its coordinator is told: a booking's
 * or hold's event's assigned coordinator, a request's requesting coordinator
 * (as I2 tells them). Nothing is removed, released or moved. One already
 * flagged for the same overlap isn't told again.
 */

/** Flagged events are read whatever the caller's event scope: the change is scoped by venue. */
const ALL_EVENTS = { scopeType: "ALL" } as const;

/** One booking, hold or pending request the change newly made overlap another, as Venue Staff are shown it. */
export interface FlaggedBooking {
  kind: "BOOKING" | "HOLD" | "REQUEST";
  reference: string;
  eventReference: string | null;
  /** Every other booking's, hold's or request's reference it now overlaps, soonest first. */
  overlapsReferences: string[];
}

/** `previous` is the venue as it was before the change: a request's overlap counts only if the change made it. */
export async function flagBufferConflicts(
  sql: Sql,
  tx: TransactionSql,
  req: ActorRequest,
  venue: VenueRecord,
  previous: VenueRecord,
): Promise<FlaggedBooking[]> {
  const actor = req.actor!;
  const requests = await listPendingRequests(tx, venue.id);
  const slots = [...(await listLiveSlots(tx, venue.id)), ...requests];
  const open = await openConflictKeys(tx, venue.id);
  const conflicts = bufferConflicts(slots, venue, { times: previous, open });
  const requestIds = new Set(requests.map((r) => r.id));
  const newlyFlagged = await recordBufferConflicts(tx, venue.id, conflicts, requestIds, venue, actor.userId);

  const flagged: FlaggedBooking[] = [];
  const events = new Map<string, EventPlanningView | null>();
  // Soonest first, as bufferConflicts orders them; requests may start with a booking.
  const ordered = slots.filter((s) => newlyFlagged.has(s.id)).sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime() || a.reference.localeCompare(b.reference));
  for (const slot of ordered) {
    if (!events.has(slot.eventId)) events.set(slot.eventId, await findEventForPlanning(sql, slot.eventId, ALL_EVENTS, actor.userId));
    const event = events.get(slot.eventId) ?? null;
    const overlapsReferences = conflicts.filter((c) => c.slotId === slot.id).map((c) => c.overlapsReference);
    flagged.push({ kind: slot.kind, reference: slot.reference, eventReference: event?.reference ?? null, overlapsReferences });
    const coordinatorId = slot.kind === "REQUEST" ? slot.requestedBy : event?.assignedCoordinatorId;
    if (!event?.reference || !coordinatorId) continue;
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
        coordinatorId,
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
