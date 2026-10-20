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
