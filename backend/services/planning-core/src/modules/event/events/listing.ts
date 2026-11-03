import type { TransactionSql } from "postgres";
import { KAFKA_TOPICS } from "@connectsphere/contracts";
import { readListing } from "../repo/listing.js";
import { writeOutbox } from "./outbox.js";

/**
 * R1 to R4 — writes the event's `event.listing-changed` message: what an
 * attendee may see of it and its registration settings, as they stand now in
 * this transaction. The registration service keeps its own copy from these
 * messages (ADR-0005), so call this in the transaction of every change to a
 * published field or a registration setting: a status change (transitionEvent),
 * an approved change (S2), a description edit (G1) and the organiser's
 * registration settings. A draft has no reference and is never listed, so it
 * writes nothing; neither does an event that does not exist.
 */
export async function writeListingChanged(
  tx: TransactionSql,
  eventId: string,
  actor: { userId: string | null; role: string },
  correlationId: string | null,
): Promise<string | null> {
  const listing = await readListing(tx, eventId);
  if (!listing?.eventReference) return null;
  return writeOutbox(tx, {
    topic: KAFKA_TOPICS.event,
    messageType: "event.listing-changed",
    aggregateId: eventId,
    actor,
    correlationId,
    payload: { ...listing, eventReference: listing.eventReference, changedAt: new Date().toISOString() },
  });
}
