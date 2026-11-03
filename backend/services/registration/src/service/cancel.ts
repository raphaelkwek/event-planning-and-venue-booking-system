import type { Db } from "../repo/seats.js";
import { writeRegistrationOutbox } from "../outbox/write.js";
import { cancelRegistrationsOfEvent } from "../repo/registrations.js";
import { retireSeatsOfEvent } from "../repo/seats.js";

/**
 * R3, F4 — the event was cancelled. Run inside the consumer's transaction, after
 * its inbox row: the event's Registered registrations become Cancelled at the
 * time of the cancellation, its seats are retired, and each attendee is told
 * (registration.cancelled). Idempotent: a second run finds nothing Registered
 * and nothing to retire. Waitlist entries are R6's.
 */
export async function cancelEventRegistrations(
  tx: Db,
  event: { eventId: string; eventReference: string; eventName: string; cancelledAt: string },
): Promise<{ cancelled: number; retiredSeats: number }> {
  const cancelled = await cancelRegistrationsOfEvent(tx, event.eventId, event.cancelledAt);
  const retiredSeats = await retireSeatsOfEvent(tx, event.eventId);
  for (const registration of cancelled) {
    await writeRegistrationOutbox(tx, {
      messageType: "registration.cancelled",
      registrationId: registration.id,
      actor: { userId: null, role: "SYSTEM" },
      correlationId: null,
      data: {
        registrationId: registration.id,
        registrationReference: registration.reference,
        eventId: event.eventId,
        eventReference: event.eventReference,
        eventName: event.eventName,
        attendeeId: registration.attendeeId,
        cancelledAt: registration.cancelledAt!,
      },
    });
  }
  return { cancelled: cancelled.length, retiredSeats };
}
