import { takesRegistrations, windowState, type ListingFacts, type WindowState } from "./registrationRules.js";

/**
 * R6 — the waitlist's rules, pure. The caller passes the instant to judge by
 * and the places remaining it counted under the event's places lock.
 */

export type JoinCheck =
  | { ok: true }
  | { ok: false; code: "EVENT_NOT_FOUND" }
  | { ok: false; code: "OUTSIDE_WINDOW"; state: Exclude<WindowState, "OPEN"> }
  | { ok: false; code: "PLACES_AVAILABLE"; placesRemaining: number };

/**
 * R6: an attendee may wait for a place only where R2 would refuse them for
 * capacity: the event takes registrations, its window is open, and no place
 * remains. An event that takes none is answered as not found, as R2 answers it.
 */
export function mayJoinWaitlist(listing: ListingFacts, now: Date, placesRemaining: number): JoinCheck {
  if (!takesRegistrations(listing)) return { ok: false, code: "EVENT_NOT_FOUND" };
  const state = windowState(listing, now);
  if (state !== "OPEN") return { ok: false, code: "OUTSIDE_WINDOW", state };
  if (placesRemaining > 0) return { ok: false, code: "PLACES_AVAILABLE", placesRemaining };
  return { ok: true };
}

/**
 * R6: a withdrawal opens a place when its seat was a public one and no
 * addition above capacity (R7) took it on. A VIP seat is not a place attendees
 * register for, and a seat handed on was never free.
 */
export function withdrawalOpensPlace(freedPool: "PUBLIC" | "VIP" | null, handedOn: number): boolean {
  return freedPool === "PUBLIC" && handedOn === 0;
}

/** R6: a further confirmed booking (a capacity increase) opens places when it leaves more remaining than before. */
export function capacityOpensPlaces(placesBefore: number, placesAfter: number): boolean {
  return placesAfter > placesBefore;
}
