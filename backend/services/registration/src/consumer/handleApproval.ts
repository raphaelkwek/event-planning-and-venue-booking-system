import type { Sql } from "postgres";
import { bookingRequestApprovedPayloadSchema, parseCloudEvent } from "@connectsphere/contracts";
import { seatBasisOf } from "../domain/seatPlan.js";
import { createSeats, retireFreeSeatsOfBooking } from "../repo/seats.js";

/**
 * What the registration service does with one Kafka message from the
 * venue-booking topic (EN-13, ADR-0005): an approval (M1) gives the event its
 * seats. It never throws for a message that can never succeed; it throws only
 * when the database fails, and the consumer then gets the message again.
 *
 * Every seat starts in the PUBLIC pool; the organiser's VIP pool (setVipSeats) moves free seats afterwards.
 *
 * There is no retry or dead-letter topic yet: a message that fails validation is
 * logged and skipped by the caller, and `registration.consumed_messages` makes a
 * redelivery safe. The retry topics arrive with R2, with the registration outbox.
 */

/** Recorded in the inbox, so a row says which consumer handled the message. */
export const INBOX_CONSUMER = "registration.seat-builder";
export const APPROVED = "venue-booking.request-approved";

export type Outcome =
  | { outcome: "built"; seats: number; retired: number }
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

  const basis = seatBasisOf(bookingRequestApprovedPayloadSchema.parse(event.data));
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
    const retired = basis.replacedBookingId ? await retireFreeSeatsOfBooking(tx, basis.replacedBookingId) : 0;
    const seats = await createSeats(tx, basis);
    return { outcome: "built", seats, retired } as const;
  });
}
