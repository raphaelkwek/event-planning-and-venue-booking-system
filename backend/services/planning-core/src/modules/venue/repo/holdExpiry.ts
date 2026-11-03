import type { TransactionSql } from "postgres";
import { findEventForChange } from "../../event/index.js";
import { writeVenueOutbox } from "../events/outbox.js";
import { clearFlagsOfEnded } from "./bufferConflicts.js";

/**
 * L6 (CR-04) — expiring a Held hold whose expiry has passed. SQL against the
 * venue schema only. The HoldExpiry workflow (repo/holds.ts expireHoldIfDue),
 * the `jobs:expire-holds` sweep and every slot insert (repo/slots.ts) all
 * expire a hold through `expireLockedHold`, so each writes the same records and
 * the same `venue-booking.hold-expired` message.
 *
 * M4 (audit, 2 Nov 2026): the workflow alone left an expired hold blocking its
 * period whenever Temporal or Kafka was down. L6: "A hold expires at its expiry
 * time whether or not anyone is using the system", and an expired hold "blocks
 * no period". So a slot insert first expires the venue's overdue holds, under
 * the venue row lock, and the sweep catches the rest.
 *
 * This file imports neither holds.ts nor slots.ts, which both call it.
 */

/** What a reminder or expiry notice names. `Hold` (repo/holds.ts) has all of it. */
export interface NoticeHold {
  id: string;
  reference: string;
  venueId: string;
  venueName: string;
  eventId: string;
  requestedBy: string;
  startsAt: string;
  endsAt: string;
  expiresAt: string | null;
  slotId: string | null;
}

/**
 * L6: a hold's event can't be found, so its notice can't be written. Retrying
 * won't help; the HoldExpiry workflow lists this error's name as non-retryable.
 */
export class HoldEventMissingError extends Error {
  constructor(holdId: string, eventId: string) {
    super(`Hold ${holdId} names event ${eventId}, which could not be found`);
    this.name = "HoldEventMissingError";
  }
}

/** L6: what a reminder or expiry notice names; the holding coordinator is who requested the hold. */
export async function holdNoticePayload(tx: TransactionSql, hold: NoticeHold): Promise<Record<string, unknown>> {
  const event = await findEventForChange(tx, hold.eventId, { scopeType: "ALL" }, hold.requestedBy);
  if (!event) throw new HoldEventMissingError(hold.id, hold.eventId);
  return {
    holdId: hold.id,
    holdReference: hold.reference,
    venueId: hold.venueId,
    venueName: hold.venueName,
    eventId: hold.eventId,
    eventReference: event.reference ?? event.id,
    eventName: event.name,
    coordinatorId: hold.requestedBy,
    startsAt: hold.startsAt,
    endsAt: hold.endsAt,
    expiresAt: hold.expiresAt,
  };
}

/**
 * Expires a hold the caller has locked, after checking it is Held and due. The
 * hold and its slot become Expired, so the period is free again (L6); what a
 * buffer change had flagged against the slot is cleared (M3); and the
 * coordinator is told. The caller holds the venue row lock, then the hold's.
 */
export async function expireLockedHold(tx: TransactionSql, hold: NoticeHold): Promise<void> {
  await tx`
    update venue.holds set status = 'EXPIRED', expired_at = now(), updated_at = now()
    where id = ${hold.id}
  `;
  // A Held hold always has its slot (placeHold sets both together).
  await tx`
    update venue.venue_slots set status = 'EXPIRED', updated_at = now()
    where id = ${hold.slotId!} and status = 'HELD'
  `;
  await clearFlagsOfEnded(tx, [hold.slotId!], null);
  await writeVenueOutbox(tx, {
    messageType: "venue-booking.hold-expired",
    aggregateId: hold.id,
    actor: { userId: null, role: "SYSTEM" },
    correlationId: null,
    payload: await holdNoticePayload(tx, hold),
  });
}

/** True when the hold's expiry has been reached by the database's clock, compared at the column's full precision. */
export async function holdExpiryReached(tx: TransactionSql, holdId: string): Promise<boolean> {
  const [row] = await tx<{ due: boolean | null }[]>`select expires_at <= now() as due from venue.holds where id = ${holdId}`;
  return row?.due === true;
}

interface OverdueRow {
  id: string;
  reference: string;
  venue_id: string;
  venue_name: string;
  event_id: string;
  requested_by: string;
  starts_at: Date;
  ends_at: Date;
  expires_at: Date;
  slot_id: string | null;
}

/**
 * M4: expires every Held hold at the venue whose expiry has passed, oldest
 * expiry first, and returns their references. Call holding the venue row lock;
 * the holds are locked here, after it. Idempotent: an expired hold is not Held.
 */
export async function expireOverdueHoldsAtVenue(tx: TransactionSql, venueId: string): Promise<string[]> {
  const rows = await tx<OverdueRow[]>`
    select h.id, h.reference, h.venue_id, v.name as venue_name, h.event_id, h.requested_by, h.starts_at, h.ends_at,
           h.expires_at, h.slot_id
    from venue.holds h join venue.venues v on v.id = h.venue_id
    where h.venue_id = ${venueId} and h.status = 'HELD' and h.expires_at <= now()
    order by h.expires_at, h.reference
    for update of h
  `;
  for (const row of rows) {
    await expireLockedHold(tx, {
      id: row.id,
      reference: row.reference,
      venueId: row.venue_id,
      venueName: row.venue_name,
      eventId: row.event_id,
      requestedBy: row.requested_by,
      startsAt: row.starts_at.toISOString(),
      endsAt: row.ends_at.toISOString(),
      expiresAt: row.expires_at.toISOString(),
      slotId: row.slot_id,
    });
  }
  return rows.map((row) => row.reference);
}
