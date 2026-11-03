import type { Sql } from "postgres";
import { eventCancelledPayloadSchema, eventListingChangedPayloadSchema, parseCloudEvent } from "@connectsphere/contracts";
import { applyListing, closeListing } from "../repo/listings.js";
import { cancelEventRegistrations } from "../service/cancel.js";

/**
 * What the registration service does with one Kafka message from the event
 * topic (R1, R3). Two types matter:
 *
 * - event.listing-changed (planning-core's event module, on every change to a
 *   published field or a registration setting): the event's copy is replaced by
 *   the snapshot, unless a newer one is applied already.
 * - event.cancelled (F3): the event is recorded as Cancelled, so R1 hides it
 *   and R2 refuses it.
 *
 * Either one saying the event is Cancelled cancels its Registered registrations,
 * retires its seats and tells each attendee (R3, F4). Both are written in the
 * cancellation's transaction; whichever arrives first does the work and the
 * second finds nothing left to do.
 *
 * Each message's id is recorded in the inbox in the same transaction as its
 * effect, so a redelivery changes nothing. A message that fails validation is
 * reported for the caller to log and skip; a database failure throws, and the
 * consumer gets the message again.
 */

export const LISTING_CONSUMER = "registration.event-listings";
export const LISTING_CHANGED = "event.listing-changed";
export const CANCELLED = "event.cancelled";

export type ListingOutcome =
  | { outcome: "applied"; stale: boolean; cancelled: number }
  | { outcome: "duplicate" }
  | { outcome: "ignored"; reason: "other-type" }
  | { outcome: "invalid"; error: string };

export async function handleListingMessage(value: string | null, deps: { sql: Sql }): Promise<ListingOutcome> {
  let event;
  try {
    event = parseCloudEvent(JSON.parse(value ?? ""));
  } catch (error) {
    return { outcome: "invalid", error: (error as Error).message };
  }
  if (event.type !== LISTING_CHANGED && event.type !== CANCELLED) return { outcome: "ignored", reason: "other-type" };

  return deps.sql.begin(async (tx): Promise<ListingOutcome> => {
    const claimed = await tx`
      insert into registration.consumed_messages (message_id, consumer)
      values (${event.id}, ${LISTING_CONSUMER})
      on conflict (message_id) do nothing
      returning message_id
    `;
    if (claimed.length === 0) return { outcome: "duplicate" };

    if (event.type === CANCELLED) {
      const data = eventCancelledPayloadSchema.parse(event.data);
      await closeListing(tx, data);
      const { cancelled } = await cancelEventRegistrations(tx, data);
      return { outcome: "applied", stale: false, cancelled };
    }

    const data = eventListingChangedPayloadSchema.parse(event.data);
    const applied = await applyListing(tx, data);
    if (data.status !== "CANCELLED") return { outcome: "applied", stale: !applied, cancelled: 0 };
    const { cancelled } = await cancelEventRegistrations(tx, { ...data, cancelledAt: data.changedAt });
    return { outcome: "applied", stale: !applied, cancelled };
  });
}
