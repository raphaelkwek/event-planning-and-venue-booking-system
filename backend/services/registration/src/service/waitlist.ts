import type { Sql } from "postgres";
import type { ActorRole } from "@connectsphere/contracts";
import { placesRemaining } from "../domain/registrationRules.js";
import { mayJoinWaitlist, type JoinCheck } from "../domain/waitlistRules.js";
import { writeRegistrationOutbox } from "../outbox/write.js";
import { findListing, type Listing } from "../repo/listings.js";
import { findActiveRegistration, type Registration } from "../repo/registrations.js";
import { lockAttendee, lockPlaces, placeCountsOf, type Db } from "../repo/seats.js";
import {
  DuplicateWaitlistEntryError,
  findEntryOfAttendee,
  findWaitingEntry,
  insertWaitlistEntry,
  markWaitingNotified,
  withdrawEntry,
  type WaitlistEntry,
} from "../repo/waitlist.js";

/**
 * R6 — the waitlist: joining after a capacity refusal, leaving, and telling the
 * waiting attendees when a place opens. Promotion is not automatic: nobody is
 * registered for them.
 */

/** The event a notice names. */
interface NoticeEvent {
  eventId: string;
  eventReference: string;
  name: string;
}

/**
 * R6: a place opened, so every waiting entry is told (waitlist.place-opened) and
 * records when. Run in the transaction that opened it, under the event's
 * exclusive places lock, so an attendee joining at that moment is either told
 * here or finds the place and registers instead. Returns how many were told.
 */
export async function notifyWaitlist(
  tx: Db,
  event: NoticeEvent,
  input: { placesRemaining: number; at: Date; actor: { userId: string | null; role: ActorRole }; correlationId: string | null },
): Promise<number> {
  const entries = await markWaitingNotified(tx, event.eventId, input.at);
  for (const entry of entries) {
    await writeRegistrationOutbox(tx, {
      messageType: "waitlist.place-opened",
      subjectId: entry.id,
      actor: input.actor,
      correlationId: input.correlationId,
      data: {
        waitlistEntryId: entry.id,
        waitlistReference: entry.reference,
        eventId: event.eventId,
        eventReference: event.eventReference,
        eventName: event.name,
        attendeeId: entry.attendeeId,
        placesRemaining: input.placesRemaining,
        openedAt: input.at.toISOString(),
      },
    });
  }
  return entries.length;
}

export type JoinOutcome =
  | { ok: true; entry: WaitlistEntry; listing: Listing }
  | { ok: false; code: "EVENT_NOT_FOUND" }
  | (Exclude<JoinCheck, { ok: true } | { code: "EVENT_NOT_FOUND" }> & { listing: Listing })
  | { ok: false; code: "REGISTERED"; listing: Listing; registration: Registration }
  | { ok: false; code: "DUPLICATE"; listing: Listing; existing: WaitlistEntry };

/**
 * R6: the attendee joins the event's waitlist. Only where R2 would refuse them
 * for capacity, never while they hold a registration, and once. Under the
 * attendee's lock, and the places lock shared (repo/seats.ts).
 */
export async function joinWaitlist(sql: Sql, input: { eventId: string; attendeeId: string; now: Date }): Promise<JoinOutcome> {
  const listing = await findListing(sql, input.eventId);
  if (!listing) return { ok: false, code: "EVENT_NOT_FOUND" };

  try {
    return await sql.begin(async (tx): Promise<JoinOutcome> => {
      await lockAttendee(tx, listing.eventId, input.attendeeId);
      await lockPlaces(tx, listing.eventId, "shared");
      const counts = (await placeCountsOf(tx, [listing.eventId])).get(listing.eventId)!;
      const check = mayJoinWaitlist(listing, input.now, placesRemaining(counts.freeSeats, counts.unseatedRegistrations));
      if (!check.ok) return check.code === "EVENT_NOT_FOUND" ? { ok: false, code: "EVENT_NOT_FOUND" } : { ...check, listing };

      const registration = await findActiveRegistration(tx, listing.eventId, input.attendeeId);
      if (registration) return { ok: false, code: "REGISTERED", listing, registration };
      const waiting = await findWaitingEntry(tx, listing.eventId, input.attendeeId);
      if (waiting) return { ok: false, code: "DUPLICATE", listing, existing: waiting };

      const entry = await insertWaitlistEntry(tx, { eventId: listing.eventId, attendeeId: input.attendeeId, at: input.now });
      return { ok: true, entry: (await findEntryOfAttendee(tx, entry.id, input.attendeeId))!, listing };
    });
  } catch (error) {
    if (!(error instanceof DuplicateWaitlistEntryError)) throw error;
    // Defensive: the attendee's lock takes one attendee's joins in turn, so the index refusing one is not expected.
    const existing = await findWaitingEntry(sql, listing.eventId, input.attendeeId);
    if (!existing) throw error;
    return { ok: false, code: "DUPLICATE", listing, existing };
  }
}

export type LeaveOutcome =
  | { ok: true; entry: WaitlistEntry }
  | { ok: false; code: "NOT_FOUND" }
  | { ok: false; code: "NOT_ACTIVE"; entry: WaitlistEntry };

/** R6: the attendee leaves, at any time while waiting. The entry is kept, Withdrawn, and later openings skip it. */
export async function leaveWaitlist(sql: Sql, input: { entryId: string; attendeeId: string; now: Date }): Promise<LeaveOutcome> {
  const left = await withdrawEntry(sql, input.entryId, input.attendeeId, input.now);
  if (left) return { ok: true, entry: left };
  const entry = await findEntryOfAttendee(sql, input.entryId, input.attendeeId);
  return entry ? { ok: false, code: "NOT_ACTIVE", entry } : { ok: false, code: "NOT_FOUND" };
}
