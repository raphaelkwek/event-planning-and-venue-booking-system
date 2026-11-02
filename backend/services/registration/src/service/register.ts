import type { Sql } from "postgres";
import { takesRegistrations, windowState, type WindowState } from "../domain/registrationRules.js";
import { writeRegistrationOutbox } from "../outbox/write.js";
import { findListing, type Listing } from "../repo/listings.js";
import { DuplicateRegistrationError, findActiveRegistration, insertRegistration, type Registration } from "../repo/registrations.js";
import { claimSeat, lockAttendee, lockPlaces } from "../repo/seats.js";
import { closeEntryRegistered } from "../repo/waitlist.js";

/**
 * R2 — an attendee registers for an event. The seat claim (FOR UPDATE SKIP
 * LOCKED) and the registration are one transaction, with the confirmation
 * message in the outbox, so the check of capacity and the registration cannot
 * be separated (ADR-0005) and a refusal leaves nothing behind: no record, no
 * claimed seat, no message.
 *
 * R6: an invited attendee registers here like anyone else, first come first
 * served, and their waiting entry ends in the same transaction. The attendee's
 * lock keeps a waitlist join for the same event from slipping in beside it; the
 * shared places lock lets registrations run together while an addition above
 * capacity or a withdrawal (exclusive) waits for them (repo/seats.ts).
 */

export type RegisterOutcome =
  | { ok: true; registration: Registration; listing: Listing }
  | { ok: false; code: "EVENT_NOT_FOUND" }
  | { ok: false; code: "OUTSIDE_WINDOW"; listing: Listing; state: Exclude<WindowState, "OPEN"> }
  | { ok: false; code: "DUPLICATE"; listing: Listing; existing: Registration }
  | { ok: false; code: "FULL"; listing: Listing };

export async function register(
  sql: Sql,
  input: { eventId: string; attendeeId: string; now: Date; correlationId: string | null },
): Promise<RegisterOutcome> {
  const listing = await findListing(sql, input.eventId);
  if (!listing || !takesRegistrations(listing)) return { ok: false, code: "EVENT_NOT_FOUND" };
  const state = windowState(listing, input.now);
  if (state !== "OPEN") return { ok: false, code: "OUTSIDE_WINDOW", listing, state };

  try {
    return await sql.begin(async (tx): Promise<RegisterOutcome> => {
      await lockAttendee(tx, listing.eventId, input.attendeeId);
      await lockPlaces(tx, listing.eventId, "shared");
      // For the message only: the unique index is what stops a second registration.
      const existing = await findActiveRegistration(tx, listing.eventId, input.attendeeId);
      if (existing) return { ok: false, code: "DUPLICATE", listing, existing };

      const seat = await claimSeat(tx, { eventId: listing.eventId, pool: "PUBLIC", attendeeId: input.attendeeId });
      if (!seat) return { ok: false, code: "FULL", listing };

      const registration = await insertRegistration(tx, {
        eventId: listing.eventId,
        attendeeId: input.attendeeId,
        seatId: seat.id,
        at: input.now,
      });
      await closeEntryRegistered(tx, {
        eventId: listing.eventId,
        attendeeId: input.attendeeId,
        registrationId: registration.id,
        at: input.now,
        by: input.attendeeId,
      });
      await writeRegistrationOutbox(tx, {
        messageType: "registration.confirmed",
        subjectId: registration.id,
        actor: { userId: input.attendeeId, role: "ATTENDEE" },
        correlationId: input.correlationId,
        data: {
          registrationId: registration.id,
          registrationReference: registration.reference,
          eventId: listing.eventId,
          eventReference: listing.eventReference,
          eventName: listing.name,
          attendeeId: input.attendeeId,
          registeredAt: registration.registeredAt,
          eventStartsAt: listing.startsAt,
          eventEndsAt: listing.endsAt,
        },
      });
      return { ok: true, registration, listing };
    });
  } catch (error) {
    if (!(error instanceof DuplicateRegistrationError)) throw error;
    // Defensive: the attendee's lock serialises one attendee's requests, so the index refusing one is not expected.
    const existing = await findActiveRegistration(sql, listing.eventId, input.attendeeId);
    if (!existing) throw error;
    return { ok: false, code: "DUPLICATE", listing, existing };
  }
}
