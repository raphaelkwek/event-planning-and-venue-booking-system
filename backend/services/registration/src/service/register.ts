import type { Sql } from "postgres";
import { verifyAdmission } from "../domain/admissionToken.js";
import { takesRegistrations, windowState, type WindowState } from "../domain/registrationRules.js";
import { writeRegistrationOutbox } from "../outbox/write.js";
import { findListing, type Listing } from "../repo/listings.js";
import { DuplicateRegistrationError, findActiveRegistration, insertRegistration, type Registration } from "../repo/registrations.js";
import { claimSeat } from "../repo/seats.js";
import { spendEntry } from "../repo/waitingRoom.js";

/**
 * R2 — an attendee registers for an event. The seat claim (FOR UPDATE SKIP
 * LOCKED) and the registration are one transaction, with the confirmation
 * message in the outbox, so the check of capacity and the registration cannot
 * be separated (ADR-0005) and a refusal leaves nothing behind: no record, no
 * claimed seat, no message.
 *
 * EN-19: for a high-demand event the attendee must also hold an admission
 * token from the waiting room, signed, for this event and this attendee, and
 * not expired. The token is spent in the same transaction as the registration
 * it admits, so one admission is one registration, and a refusal for capacity
 * or a duplicate leaves it unspent.
 */

export type RegisterOutcome =
  | { ok: true; registration: Registration; listing: Listing }
  | { ok: false; code: "EVENT_NOT_FOUND" }
  | { ok: false; code: "OUTSIDE_WINDOW"; listing: Listing; state: Exclude<WindowState, "OPEN"> }
  | { ok: false; code: "DUPLICATE"; listing: Listing; existing: Registration }
  | { ok: false; code: "FULL"; listing: Listing }
  | { ok: false; code: "ADMISSION_REQUIRED" | "ADMISSION_EXPIRED" | "WAITING_ROOM_UNAVAILABLE"; listing: Listing };

/** Thrown inside the registration's transaction to undo the seat claim when the token turns out to be spent. */
class AdmissionSpentError extends Error {}

export async function register(
  sql: Sql,
  input: {
    eventId: string;
    attendeeId: string;
    now: Date;
    correlationId: string | null;
    /** EN-19: the X-Admission-Token the attendee sent, and the key tokens are signed with. */
    admission?: { token: string | null; signingKey: string };
  },
): Promise<RegisterOutcome> {
  const listing = await findListing(sql, input.eventId);
  if (!listing || !takesRegistrations(listing)) return { ok: false, code: "EVENT_NOT_FOUND" };
  const state = windowState(listing, input.now);
  if (state !== "OPEN") return { ok: false, code: "OUTSIDE_WINDOW", listing, state };

  let admissionEntryId: string | null = null;
  if (listing.highDemand) {
    const signingKey = input.admission?.signingKey ?? "";
    if (signingKey === "") return { ok: false, code: "WAITING_ROOM_UNAVAILABLE", listing };
    const admitted = verifyAdmission(input.admission?.token, signingKey, { eventId: listing.eventId, attendeeId: input.attendeeId }, input.now);
    if (!admitted.ok) return { ok: false, code: admitted.reason === "EXPIRED" ? "ADMISSION_EXPIRED" : "ADMISSION_REQUIRED", listing };
    admissionEntryId = admitted.claims.entryId;
  }

  try {
    return await sql.begin(async (tx): Promise<RegisterOutcome> => {
      // For the message only: the unique index is what stops a second registration.
      const existing = await findActiveRegistration(tx, listing.eventId, input.attendeeId);
      if (existing) return { ok: false, code: "DUPLICATE", listing, existing };

      const seat = await claimSeat(tx, { eventId: listing.eventId, pool: "PUBLIC", attendeeId: input.attendeeId });
      if (!seat) return { ok: false, code: "FULL", listing };

      if (admissionEntryId !== null) {
        const spent = await spendEntry(tx, { entryId: admissionEntryId, eventId: listing.eventId, attendeeId: input.attendeeId, now: input.now });
        if (!spent) throw new AdmissionSpentError();
      }

      const registration = await insertRegistration(tx, {
        eventId: listing.eventId,
        attendeeId: input.attendeeId,
        seatId: seat.id,
        at: input.now,
      });
      await writeRegistrationOutbox(tx, {
        messageType: "registration.confirmed",
        registrationId: registration.id,
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
    if (error instanceof AdmissionSpentError) return { ok: false, code: "ADMISSION_REQUIRED", listing };
    if (!(error instanceof DuplicateRegistrationError)) throw error;
    // Two requests from one attendee raced past the read; the index refused the second, and its claim rolled back.
    const existing = await findActiveRegistration(sql, listing.eventId, input.attendeeId);
    if (!existing) throw error;
    return { ok: false, code: "DUPLICATE", listing, existing };
  }
}
