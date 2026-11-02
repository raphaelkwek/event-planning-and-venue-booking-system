import type { RegistrationStatus } from "@connectsphere/contracts";
import { placesRemaining, withdrawalDeadline } from "../domain/registrationRules.js";
import type { Listing } from "../repo/listings.js";
import type { Registration } from "../repo/registrations.js";
import type { PlaceCounts } from "../repo/seats.js";
import type { PublicVenue } from "../repo/venues.js";

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
