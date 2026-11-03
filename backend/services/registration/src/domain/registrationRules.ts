/**
 * R1 to R4 — the registration rules, pure: no database, no clock of their own.
 * The caller passes the instant to judge by, so a boundary can be tested at
 * the exact millisecond.
 */

/** What the rules need to know about an event, from the registration service's own copy of it. */
export interface ListingFacts {
  status: string;
  registrationRequired: boolean;
  registrationOpensAt: string | null;
  registrationClosesAt: string | null;
  /** The organiser's withdrawal deadline, or null when none was set (R4). */
  withdrawalDeadlineAt: string | null;
  startsAt: string | null;
}

const at = (iso: string) => Date.parse(iso);

/**
 * R2: an event takes registrations at all only while it is Confirmed with
 * registration enabled. Anything else (a draft, an event in planning, a
 * cancelled one) is not offered to attendees, so it is answered as not found.
 */
export function takesRegistrations(listing: ListingFacts): boolean {
  return listing.status === "CONFIRMED" && listing.registrationRequired;
}

/**
 * R1: the attendee list holds Confirmed events with registration enabled whose
 * closing has not passed. At the closing instant itself it has not passed yet.
 */
export function isListed(listing: ListingFacts, now: Date): boolean {
  return takesRegistrations(listing) && listing.registrationClosesAt !== null && now.getTime() <= at(listing.registrationClosesAt);
}

export type WindowState = "OPEN" | "NOT_YET_OPEN" | "CLOSED";

/**
 * R2: registration is accepted from the opening instant up to and including the
 * closing instant. An event with registration enabled always has both (B2); one
 * that somehow lacks either is treated as closed rather than guessed at.
 */
export function windowState(listing: ListingFacts, now: Date): WindowState {
  const { registrationOpensAt: opens, registrationClosesAt: closes } = listing;
  if (opens === null || closes === null) return "CLOSED";
  const t = now.getTime();
  if (t < at(opens)) return "NOT_YET_OPEN";
  return t <= at(closes) ? "OPEN" : "CLOSED";
}

/**
 * R4: the last instant a registration may be withdrawn. The organiser's
 * deadline, or the event's start where none is set. A deadline later than the
 * start (possible only if an approved change moved the start earlier after the
 * deadline was set) is held to the start: nobody withdraws from an event that
 * has begun. Null only for an event with neither, which has no limit.
 */
export function withdrawalDeadline(listing: ListingFacts): { at: string; isEventStart: boolean } | null {
  const { withdrawalDeadlineAt: deadline, startsAt: start } = listing;
  if (deadline === null) return start === null ? null : { at: start, isEventStart: true };
  if (start !== null && at(start) < at(deadline)) return { at: start, isEventStart: true };
  return { at: deadline, isEventStart: false };
}

/** R4: withdrawal is allowed up to and including the deadline, and refused after it. */
export function mayWithdraw(listing: ListingFacts, now: Date): boolean {
  const deadline = withdrawalDeadline(listing);
  return deadline === null || now.getTime() <= at(deadline.at);
}

/**
 * R2 (D-01): the places an attendee can still take. Each free seat is one,
 * less any active registration that holds no seat: an addition above capacity
 * (R7). It is never negative. With no such additions it is the number of free
 * seats, and the seat claim is what enforces it.
 */
export function placesRemaining(freeSeats: number, unseatedRegistrations: number): number {
  return Math.max(0, freeSeats - unseatedRegistrations);
}
