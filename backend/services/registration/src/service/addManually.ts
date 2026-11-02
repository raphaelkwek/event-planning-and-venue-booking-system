import type { Sql } from "postgres";
import type { Role, UserSummary } from "@connectsphere/contracts";
import { additionPreview, type AdditionPreview } from "../domain/management.js";
import { writeRegistrationOutbox } from "../outbox/write.js";
import type { Listing } from "../repo/listings.js";
import {
  DuplicateRegistrationError,
  findActiveRegistration,
  insertManualRegistration,
  registrationCountsOf,
  type Registration,
} from "../repo/registrations.js";
import { claimSeat, lockAttendee, lockPlaces } from "../repo/seats.js";
import { capacityOf } from "../repo/venues.js";
import { closeEntryRegistered } from "../repo/waitlist.js";

/**
 * R7 — the owning organiser or the assigned coordinator adds an attendee by
 * hand: allowed when no place remains and after the window closes. The caller
 * has checked who may add, the event's status and its confirmed booking, and
 * found the attendee's account.
 *
 * In one transaction, under the attendee's lock and the event's exclusive
 * places lock (repo/seats.ts): a duplicate is refused naming the registration
 * held; a free seat is taken (VIP first, then public); with none free the
 * addition is above capacity, saved only when the caller confirmed it (D-01),
 * and holds no seat until a withdrawal hands it one. An attendee waiting on the
 * waitlist stops waiting, and the attendee is told (registration.added).
 */

export type AdditionOutcome =
  | { ok: true; registration: Registration; preview: AdditionPreview }
  | { ok: false; code: "DUPLICATE"; existing: Registration }
  | { ok: false; code: "OVER_CAPACITY_UNCONFIRMED"; preview: AdditionPreview; registered: number };

export interface AdditionInput {
  listing: Listing;
  attendee: UserSummary;
  addedBy: { id: string; role: Role; name: string | null };
  reason: string | null;
  confirmOverCapacity: boolean;
  now: Date;
  correlationId: string | null;
}

export async function addManually(sql: Sql, input: AdditionInput): Promise<AdditionOutcome> {
  const { listing, attendee } = input;
  try {
    return await sql.begin(async (tx): Promise<AdditionOutcome> => {
      await lockAttendee(tx, listing.eventId, attendee.id);
      await lockPlaces(tx, listing.eventId, "exclusive");
      const existing = await findActiveRegistration(tx, listing.eventId, attendee.id);
      if (existing) return { ok: false, code: "DUPLICATE", existing };

      const { capacity } = await capacityOf(tx, listing.eventId);
      const { registered } = await registrationCountsOf(tx, listing.eventId);
      const preview = additionPreview(capacity, registered);
      const seat =
        (await claimSeat(tx, { eventId: listing.eventId, pool: "VIP", attendeeId: attendee.id })) ??
        (await claimSeat(tx, { eventId: listing.eventId, pool: "PUBLIC", attendeeId: attendee.id }));
      if (!seat && !input.confirmOverCapacity) return { ok: false, code: "OVER_CAPACITY_UNCONFIRMED", preview, registered };

      const registration = await insertManualRegistration(tx, {
        eventId: listing.eventId,
        attendeeId: attendee.id,
        seatId: seat?.id ?? null,
        at: input.now,
        addedBy: input.addedBy.id,
        reason: input.reason,
      });
      await closeEntryRegistered(tx, {
        eventId: listing.eventId,
        attendeeId: attendee.id,
        registrationId: registration.id,
        at: input.now,
        by: input.addedBy.id,
      });
      await writeRegistrationOutbox(tx, {
        messageType: "registration.added",
        subjectId: registration.id,
        actor: { userId: input.addedBy.id, role: input.addedBy.role },
        correlationId: input.correlationId,
        data: {
          registrationId: registration.id,
          registrationReference: registration.reference,
          eventId: listing.eventId,
          eventReference: listing.eventReference,
          eventName: listing.name,
          attendeeId: attendee.id,
          registeredAt: registration.registeredAt,
          eventStartsAt: listing.startsAt,
          eventEndsAt: listing.endsAt,
          addedBy: input.addedBy.id,
          addedByName: input.addedBy.name,
          addedOverCapacity: registration.addedOverCapacity,
        },
      });
      return { ok: true, registration, preview };
    });
  } catch (error) {
    if (!(error instanceof DuplicateRegistrationError)) throw error;
    // Defensive: the attendee's lock takes one attendee's registrations in turn.
    const existing = await findActiveRegistration(sql, listing.eventId, attendee.id);
    if (!existing) throw error;
    return { ok: false, code: "DUPLICATE", existing };
  }
}
