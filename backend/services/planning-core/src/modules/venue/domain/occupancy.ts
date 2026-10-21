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
  /** A pending request, which reserves nothing, rather than a booking or hold. */
  pending?: boolean;
}

/** One booking, hold or pending request, and one other whose occupied period now overlaps its own. */
export interface BufferConflict {
  slotId: string;
  overlapsId: string;
  overlapsReference: string;
}

type Buffers = { setupMinutes: number; turnaroundMinutes: number };

/** The venue's times before the change, and the pairs (`<id>:<other id>`) already recorded as conflicting. */
export interface BeforeChange {
  times: Buffers;
  open: ReadonlySet<string>;
}

export const conflictKey = (slotId: string, overlapsId: string) => `${slotId}:${overlapsId}`;

/**
 * H3-T10, H3-T11: which of a venue's live bookings, holds and pending requests
 * overlap one another once the venue's setup and turnaround time are applied
 * to every one of them. Each booking keeps the times it was made with, so a
 * changed venue can leave two that no longer fit. Listed per item, soonest
 * first, each naming the others it overlaps; occupied periods that merely
 * touch don't overlap.
 *
 * Pending requests may already clash before the change: two events can ask for
 * one period, and Venue Staff decide between them (N2). So a pair with a
 * pending request in it counts only when the change made it overlap, or when
 * it is already recorded, which keeps it open until the times fit again.
 */
export function bufferConflicts(slots: readonly LiveSlot[], venue: Buffers, before?: BeforeChange): BufferConflict[] {
  // No two live slots at one venue start together: the exclusion constraint keeps them apart. Requests may.
  const ordered = [...slots].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime() || a.reference.localeCompare(b.reference));
  const occupiedUnder = (times: Buffers) =>
    new Map(ordered.map((slot) => [slot.id, occupiedPeriod({ start: slot.startsAt, end: slot.endsAt }, times)]));
  const occupied = occupiedUnder(venue);
  const previously = before ? occupiedUnder(before.times) : null;
  const madeByChange = (slot: LiveSlot, other: LiveSlot) =>
    !(slot.pending || other.pending) ||
    !previously ||
    !periodsOverlap(previously.get(slot.id)!, previously.get(other.id)!) ||
    before!.open.has(conflictKey(slot.id, other.id));
  return ordered.flatMap((slot) =>
    ordered
      .filter((other) => other.id !== slot.id && periodsOverlap(occupied.get(slot.id)!, occupied.get(other.id)!) && madeByChange(slot, other))
      .map((other) => ({ slotId: slot.id, overlapsId: other.id, overlapsReference: other.reference })),
  );
}
