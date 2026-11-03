import type { Sql } from "postgres";
import { mayWithdraw, placesRemaining, withdrawalDeadline } from "../domain/registrationRules.js";
import { withdrawalOpensPlace } from "../domain/waitlistRules.js";
import { writeRegistrationOutbox } from "../outbox/write.js";
import { findListing, type Listing } from "../repo/listings.js";
import { findRegistrationOfAttendee, withdrawRegistration, type Registration } from "../repo/registrations.js";
import { lockPlaces, placeCountsOf, releaseSeat, seatUnseated } from "../repo/seats.js";
import { notifyWaitlist } from "./waitlist.js";

/**
 * R4 — an attendee withdraws their own registration while it is Registered and
 * the deadline has not passed. One transaction holds the withdrawal, its seat
 * freed and the registration.withdrawn message (the attendee's confirmation).
 * The record is kept, Withdrawn, with its time.
 *
 * R7: when an addition above capacity holds no seat, the freed seat goes to the
 * earliest such registration before the transaction commits, so places
 * remaining never shows a place that isn't free. R6: when the seat does become
 * a free place, every waiting attendee is told in the same transaction. Both
 * happen under the event's exclusive places lock (repo/seats.ts).
 */

export type WithdrawOutcome =
  | { ok: true; registration: Registration; listing: Listing | null }
  | { ok: false; code: "NOT_FOUND" }
  | { ok: false; code: "NOT_ACTIVE"; registration: Registration }
  | { ok: false; code: "DEADLINE_PASSED"; registration: Registration; listing: Listing; deadline: { at: string; isEventStart: boolean } };

export async function withdraw(
  sql: Sql,
  input: { registrationId: string; attendeeId: string; now: Date; correlationId: string | null },
): Promise<WithdrawOutcome> {
  const found = await findRegistrationOfAttendee(sql, input.registrationId, input.attendeeId);
  if (!found) return { ok: false, code: "NOT_FOUND" };
  if (found.status !== "REGISTERED") return { ok: false, code: "NOT_ACTIVE", registration: found };

  const listing = await findListing(sql, found.eventId);
  if (listing && !mayWithdraw(listing, input.now)) {
    return { ok: false, code: "DEADLINE_PASSED", registration: found, listing, deadline: withdrawalDeadline(listing)! };
  }

  const done = await sql.begin(async (tx) => {
    await lockPlaces(tx, found.eventId, "exclusive");
    const withdrawn = await withdrawRegistration(tx, input.registrationId, input.attendeeId, input.now);
    if (!withdrawn) return null;
    const actor = { userId: input.attendeeId, role: "ATTENDEE" as const };
    if (withdrawn.seatId) {
      const freedPool = await releaseSeat(tx, withdrawn.seatId);
      const handedOn = await seatUnseated(tx, withdrawn.eventId);
      if (withdrawalOpensPlace(freedPool, handedOn)) {
        const counts = (await placeCountsOf(tx, [withdrawn.eventId])).get(withdrawn.eventId)!;
        await notifyWaitlist(tx, listing!, {
          placesRemaining: placesRemaining(counts.freeSeats, counts.unseatedRegistrations),
          at: input.now,
          actor,
          correlationId: input.correlationId,
        });
      }
    }
    await writeRegistrationOutbox(tx, {
      messageType: "registration.withdrawn",
      subjectId: withdrawn.id,
      actor,
      correlationId: input.correlationId,
      data: {
        registrationId: withdrawn.id,
        registrationReference: withdrawn.reference,
        eventId: withdrawn.eventId,
        // A registration is only ever made for a listed event, so its listing is there.
        eventReference: listing!.eventReference,
        eventName: listing!.name,
        attendeeId: input.attendeeId,
        registeredAt: withdrawn.registeredAt,
        withdrawnAt: withdrawn.withdrawnAt!,
      },
    });
    return withdrawn;
  });

  if (done) return { ok: true, registration: done, listing };
  // It changed between the read and the update: withdrawn twice at once, or cancelled with the event.
  const current = (await findRegistrationOfAttendee(sql, input.registrationId, input.attendeeId))!;
  return { ok: false, code: "NOT_ACTIVE", registration: current };
}
