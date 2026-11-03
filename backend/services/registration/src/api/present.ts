import type { RegistrationStatus, UserSummary } from "@connectsphere/contracts";
import { placesRemaining, withdrawalDeadline } from "../domain/registrationRules.js";
import type { Listing } from "../repo/listings.js";
import type { Registration } from "../repo/registrations.js";
import type { PlaceCounts } from "../repo/seats.js";
import type { PublicVenue } from "../repo/venues.js";
import type { WaitlistEntry } from "../repo/waitlist.js";
import { nameOf } from "./directory.js";

/**
 * What attendees are sent. Only published fields (R1): the event's name,
 * description, date and times, its venues' names and locations, the
 * registration window, the withdrawal deadline and the places remaining.
 * Nothing about bookings, layouts, owners or anything internal.
 */

export interface OpenEvent {
  eventId: string;
  reference: string;
  name: string;
  description: string | null;
  startsAt: string | null;
  endsAt: string | null;
  venues: PublicVenue[];
  registrationOpensAt: string | null;
  registrationClosesAt: string | null;
  /** R4: the last instant a registration may be withdrawn (the organiser's deadline, or the start). */
  withdrawalDeadline: string | null;
  placesRemaining: number;
  isFull: boolean;
  /** EN-19: registering needs a place in the waiting room first. */
  highDemand: boolean;
}

export function presentOpenEvent(listing: Listing, venues: PublicVenue[], counts: PlaceCounts): OpenEvent {
  const places = placesRemaining(counts.freeSeats, counts.unseatedRegistrations);
  return {
    eventId: listing.eventId,
    reference: listing.eventReference,
    name: listing.name,
    description: listing.description,
    startsAt: listing.startsAt,
    endsAt: listing.endsAt,
    venues,
    registrationOpensAt: listing.registrationOpensAt,
    registrationClosesAt: listing.registrationClosesAt,
    withdrawalDeadline: withdrawalDeadline(listing)?.at ?? null,
    placesRemaining: places,
    isFull: places === 0,
    highDemand: listing.highDemand,
  };
}

export interface RegistrationView {
  id: string;
  reference: string;
  status: RegistrationStatus;
  registeredAt: string;
  withdrawnAt: string | null;
  cancelledAt: string | null;
  event: {
    eventId: string;
    reference: string;
    name: string;
    startsAt: string | null;
    endsAt: string | null;
    venues: PublicVenue[];
    withdrawalDeadline: string | null;
  };
}

/** R3: one of the attendee's registrations, with what they need to know of its event. */
export function presentRegistration(registration: Registration, listing: Listing | undefined | null, venues: PublicVenue[]): RegistrationView {
  return {
    id: registration.id,
    reference: registration.reference,
    status: registration.status,
    registeredAt: registration.registeredAt,
    withdrawnAt: registration.withdrawnAt,
    cancelledAt: registration.cancelledAt,
    event: {
      eventId: registration.eventId,
      // A registration is only made for a listed event, so its listing is there; the fallbacks are never expected.
      reference: listing?.eventReference ?? "",
      name: listing?.name ?? "",
      startsAt: listing?.startsAt ?? null,
      endsAt: listing?.endsAt ?? null,
      venues,
      withdrawalDeadline: listing ? (withdrawalDeadline(listing)?.at ?? null) : null,
    },
  };
}

/** R5, R6: a person on the organiser's lists: their id, and their name and email as identity has them now. */
export interface Person {
  id: string;
  name: string | null;
  email: string | null;
}

export function personOf(id: string, names: Map<string, UserSummary>): Person {
  const user = names.get(id);
  return { id, name: nameOf(user), email: user?.email ?? null };
}

/** R5, R7: one row of the organiser's registration list. */
export interface ManagedRegistration {
  id: string;
  reference: string;
  attendee: Person;
  status: RegistrationStatus;
  registeredAt: string;
  withdrawnAt: string | null;
  cancelledAt: string | null;
  /** R7: null for a self-registration; who added it and why otherwise, and whether it went over capacity. */
  manualAddition: { addedBy: Person; reason: string | null; overCapacity: boolean } | null;
  /** R7: false only for an addition above capacity still waiting for a seat. */
  holdsSeat: boolean;
}

export function presentManagedRegistration(registration: Registration, names: Map<string, UserSummary>): ManagedRegistration {
  return {
    id: registration.id,
    reference: registration.reference,
    attendee: personOf(registration.attendeeId, names),
    status: registration.status,
    registeredAt: registration.registeredAt,
    withdrawnAt: registration.withdrawnAt,
    cancelledAt: registration.cancelledAt,
    manualAddition: registration.addedBy
      ? { addedBy: personOf(registration.addedBy, names), reason: registration.additionReason, overCapacity: registration.addedOverCapacity }
      : null,
    holdsSeat: registration.seatId !== null,
  };
}

/** R5, R6, R7: the event a staff list is for. */
export function presentManagedEvent(listing: Listing) {
  return { eventId: listing.eventId, reference: listing.eventReference, name: listing.name, status: listing.status, startsAt: listing.startsAt };
}

/** R6: the fields of an entry both the attendee and the organiser see. */
function entryFields(entry: WaitlistEntry) {
  return {
    id: entry.id,
    reference: entry.reference,
    status: entry.status,
    position: entry.position,
    joinedAt: entry.joinedAt,
    lastNotifiedAt: entry.lastNotifiedAt,
    registeredAt: entry.registeredAt,
    withdrawnAt: entry.withdrawnAt,
    cancelledAt: entry.cancelledAt,
  };
}

/** R6: one of the attendee's own waitlist entries, with its event as attendees see it. */
export function presentWaitlistEntry(entry: WaitlistEntry, listing: Listing | undefined | null) {
  return {
    ...entryFields(entry),
    event: {
      eventId: entry.eventId,
      reference: listing?.eventReference ?? "",
      name: listing?.name ?? "",
      startsAt: listing?.startsAt ?? null,
      endsAt: listing?.endsAt ?? null,
    },
  };
}

/** R6: one row of the organiser's view of the waitlist. */
export function presentManagedEntry(entry: WaitlistEntry, names: Map<string, UserSummary>) {
  return { ...entryFields(entry), attendee: personOf(entry.attendeeId, names) };
}
