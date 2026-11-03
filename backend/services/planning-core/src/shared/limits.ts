import { MAX_VENUE_CAPACITY } from "@connectsphere/contracts";

/**
 * Upper bounds for whole numbers a caller sends that end up in an `int` column.
 * Postgres `int` stops at 2 147 483 647; a larger value raises 22003 from the
 * driver, which used to be an unhandled rejection. Each bound is far above any
 * real use and far below that limit, so it can be named in the refusal.
 */

/** Seats, capacities and attendance: no venue or event here holds a million people. Shared with the approval message (contracts), which the registration service turns into that many seat rows. */
export const MAX_HEADCOUNT = MAX_VENUE_CAPACITY;

/** Units of one equipment type, held, requested or unavailable. */
export const MAX_QUANTITY = 1_000_000;

/** Setup and turnaround minutes a venue needs: at most a week. */
export const MAX_SETUP_MINUTES = 10_080;

/** How long before a hold expires to remind the coordinator: at most a year. */
export const MAX_REMINDER_LEAD_MINUTES = 525_600;

/** True for a whole number from `min` to `max`, both included. */
export function isWholeBetween(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}
