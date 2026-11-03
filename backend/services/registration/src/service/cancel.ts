import type { Db } from "../repo/seats.js";
import { writeRegistrationOutbox } from "../outbox/write.js";
import { cancelRegistrationsOfEvent } from "../repo/registrations.js";
import { lockPlaces, retireSeatsOfEvent } from "../repo/seats.js";
import { cancelEntriesOfEvent } from "../repo/waitlist.js";

/**
 * R3, F4, R6 — the event was cancelled. Run inside the consumer's transaction,
 * after its inbox row: the event's Registered registrations become Cancelled at
 * the time of the cancellation, its seats are retired, its waiting waitlist
 * entries become Cancelled, and each attendee is told (registration.cancelled,
 * waitlist.cancelled). Idempotent: a second run finds nothing Registered or
 * waiting, and nothing to retire.
 */
export async function cancelEventRegistrations(
  tx: Db,
  event: { eventId: string; eventReference: string; eventName: string; cancelledAt: string },
): Promise<{ cancelled: number; retiredSeats: number; cancelledEntries: number }> {
  await lockPlaces(tx, event.eventId, "exclusive");
  const cancelled = await cancelRegistrationsOfEvent(tx, event.eventId, event.cancelledAt);
  const retiredSeats = await retireSeatsOfEvent(tx, event.eventId);
  const actor = { userId: null, role: "SYSTEM" as const };
  const named = { eventId: event.eventId, eventReference: event.eventReference, eventName: event.eventName };
  for (const registration of cancelled) {
    await writeRegistrationOutbox(tx, {
      messageType: "registration.cancelled",
      subjectId: registration.id,
      actor,
      correlationId: null,
      data: {
        registrationId: registration.id,
        registrationReference: registration.reference,
        ...named,
        attendeeId: registration.attendeeId,
        cancelledAt: registration.cancelledAt!,
      },
    });
  }
  const entries = await cancelEntriesOfEvent(tx, event.eventId, event.cancelledAt);
  for (const entry of entries) {
    await writeRegistrationOutbox(tx, {
      messageType: "waitlist.cancelled",
      subjectId: entry.id,
      actor,
      correlationId: null,
      data: { waitlistEntryId: entry.id, waitlistReference: entry.reference, ...named, attendeeId: entry.attendeeId, cancelledAt: entry.cancelledAt! },
    });
  }
  return { cancelled: cancelled.length, retiredSeats, cancelledEntries: entries.length };
}
