/**
 * H3 (CR-01): the period an event occupies a venue, setup and turnaround
 * included, and whether two such periods overlap. Availability, holds,
 * booking approval, conflict flags and unavailability blocks (I1, I2, J1, L3,
 * M1, N1, N2) compare these, never the advertised start and end.
 */

export interface Period {
  start: Date;
  end: Date;
}

const MINUTE = 60_000;

/** From the start minus the setup time to the end plus the turnaround time. */
export function occupiedPeriod(
  event: Period,
  venue: { setupMinutes: number; turnaroundMinutes: number },
): Period {
  return {
    start: new Date(event.start.getTime() - venue.setupMinutes * MINUTE),
    end: new Date(event.end.getTime() + venue.turnaroundMinutes * MINUTE),
  };
}

/** Half-open periods: ones that merely touch do not overlap. */
export function periodsOverlap(a: Period, b: Period): boolean {
  return a.start < b.end && b.start < a.end;
}

export interface LiveSlot {
  id: string;
  reference: string;
  startsAt: Date;
  endsAt: Date;
}

/** One booking or hold, and one other whose occupied period now overlaps its own. */
export interface BufferConflict {
  slotId: string;
  overlapsId: string;
  overlapsReference: string;
}

/**
 * H3-T10: which of a venue's live bookings and holds overlap one another once
 * the venue's setup and turnaround time are applied to every one of them. Each
 * booking keeps the times it was made with, so a changed venue can leave two
 * that no longer fit. Listed per booking, soonest first, each naming the others
 * it overlaps; occupied periods that merely touch don't overlap.
 */
export function bufferConflicts(slots: readonly LiveSlot[], venue: { setupMinutes: number; turnaroundMinutes: number }): BufferConflict[] {
  // No two live slots at one venue start together: the exclusion constraint keeps them apart.
  const ordered = [...slots].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  const occupied = new Map(ordered.map((slot) => [slot.id, occupiedPeriod({ start: slot.startsAt, end: slot.endsAt }, venue)]));
  return ordered.flatMap((slot) =>
    ordered
      .filter((other) => other.id !== slot.id && periodsOverlap(occupied.get(slot.id)!, occupied.get(other.id)!))
      .map((other) => ({ slotId: slot.id, overlapsId: other.id, overlapsReference: other.reference })),
  );
}
