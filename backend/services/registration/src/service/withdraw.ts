import type { Sql } from "postgres";
import { mayWithdraw, withdrawalDeadline } from "../domain/registrationRules.js";
import { writeRegistrationOutbox } from "../outbox/write.js";
import { findListing, type Listing } from "../repo/listings.js";
import { findRegistrationOfAttendee, withdrawRegistration, type Registration } from "../repo/registrations.js";
import { releaseSeat } from "../repo/seats.js";

/**
 * R4 — an attendee withdraws their own registration while it is Registered and
 * the deadline has not passed. The withdrawal, its seat freed (places remaining
 * rises by exactly one) and the registration.withdrawn message (the attendee's
 * confirmation; R6 reads it to tell the waitlist) are one transaction. The
 * record is kept, Withdrawn, with its time.
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
    const withdrawn = await withdrawRegistration(tx, input.registrationId, input.attendeeId, input.now);
    if (!withdrawn) return null;
    if (withdrawn.seatId) await releaseSeat(tx, withdrawn.seatId);
    await writeRegistrationOutbox(tx, {
      messageType: "registration.withdrawn",
      registrationId: withdrawn.id,
      actor: { userId: input.attendeeId, role: "ATTENDEE" },
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
