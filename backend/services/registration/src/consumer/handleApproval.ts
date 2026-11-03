import type { Sql } from "postgres";
import { bookingRequestApprovedPayloadSchema, parseCloudEvent } from "@connectsphere/contracts";
import { seatBasisOf } from "../domain/seatPlan.js";
import { createSeats, moveClaimedSeats, retireFreeSeatsOfBooking } from "../repo/seats.js";
import { recordVenue, replaceVenue } from "../repo/venues.js";

/**
 * What the registration service does with one Kafka message from the
 * venue-booking topic (EN-13, ADR-0005): an approval (M1) gives the event its
 * seats and, for R1, the venue attendees see. It never throws for a message
 * that can never succeed; it throws only when the database fails, and the
 * consumer then gets the message again.
 *
 * Every seat starts in the PUBLIC pool; the organiser's VIP pool (setVipSeats) moves free seats afterwards.
 *
 * There is no retry or dead-letter topic yet: a message that fails validation is
 * logged and skipped by the caller, and `registration.consumed_messages` makes a
 * redelivery safe.
 */

/** Recorded in the inbox, so a row says which consumer handled the message. */
export const INBOX_CONSUMER = "registration.seat-builder";
export const APPROVED = "venue-booking.request-approved";

export type Outcome =
  | { outcome: "built"; seats: number; retired: number; moved: number }
  | { outcome: "duplicate" }
  | { outcome: "ignored"; reason: "other-type" | "no-layout-capacity" }
  | { outcome: "invalid"; error: string };

export async function handleMessage(value: string | null, deps: { sql: Sql }): Promise<Outcome> {
  let event;
  try {
    event = parseCloudEvent(JSON.parse(value ?? ""));
  } catch (error) {
    // Validation never succeeds on a retry.
    return { outcome: "invalid", error: (error as Error).message };
  }
  if (event.type !== APPROVED) return { outcome: "ignored", reason: "other-type" };

  const approval = bookingRequestApprovedPayloadSchema.parse(event.data);
  const basis = seatBasisOf(approval);
  if (!basis) return { outcome: "ignored", reason: "no-layout-capacity" };

  return deps.sql.begin(async (tx) => {
    // The message id first, so a duplicate (or a second consumer racing this one) finds the key taken.
    const claimed = await tx`
      insert into registration.consumed_messages (message_id, consumer)
      values (${event.id}, ${INBOX_CONSUMER})
      on conflict (message_id) do nothing
      returning message_id
    `;
    if (claimed.length === 0) return { outcome: "duplicate" } as const;

    let moved = 0;
    let retired = 0;
    if (basis.replacedBookingId) {
      // CR-02, R2: attendees keep their places, on the new booking, and the new booking adds only
      // the rest of its capacity, so the event has the new venue's capacity, not that plus the held seats.
      moved = await moveClaimedSeats(tx, basis.replacedBookingId, basis.bookingId);
      retired = await retireFreeSeatsOfBooking(tx, basis.replacedBookingId);
      await replaceVenue(tx, basis.replacedBookingId);
    }
    // Seats 1 to `moved` are taken by the moved seats, and createSeats skips a number already used.
    const seats = await createSeats(tx, basis);
    await recordVenue(tx, {
      eventId: approval.eventId,
      bookingId: approval.bookingId,
      venueId: approval.venueId,
      venueName: approval.venueName,
      venueLocation: approval.venueLocation ?? null,
      layout: basis.layout,
      layoutCapacity: basis.capacity,
      startsAt: approval.startsAt,
      endsAt: approval.endsAt,
    });
    return { outcome: "built", seats, retired, moved } as const;
  });
}
