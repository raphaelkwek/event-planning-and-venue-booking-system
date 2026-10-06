import type { TransactionSql } from "postgres";
import type { BlockingSlotStatus, VenueSlotStatus } from "@connectsphere/contracts";
import { isSlotOverlap, VenueSlotConflictError } from "../domain/slotConflict.js";

/**
 * Venue slots and the venue row lock (EN-02.1, ADR-0006, implementation.md
 * §4.6). SQL for the venue schema only. L3's holds, M1's approvals and I2's
 * blocks build on these; nothing here reads availability and then writes.
 */

export interface NewVenueSlot {
  venueId: string;
  /** event.events.id. One event may hold slots at several venues (CR-03). */
  eventId: string;
  /** The hold's or booking request's reference, named in refusals. */
  reference: string;
  startsAt: Date;
  endsAt: Date;
  /** The venue's setup and turnaround time at the moment the slot is taken (H3). */
  setupMinutes: number;
  turnaroundMinutes: number;
  status: BlockingSlotStatus;
  actorUserId: string;
}

export interface VenueSlot {
  id: string;
  venueId: string;
  eventId: string;
  reference: string;
  startsAt: Date;
  endsAt: Date;
  setupMinutes: number;
  turnaroundMinutes: number;
  /** The occupied period: from the start minus setup to the end plus turnaround. */
  occupiedFrom: Date;
  occupiedUntil: Date;
  status: VenueSlotStatus;
  requiresReconfirmation: boolean;
}

interface SlotRow {
  id: string;
  venue_id: string;
  event_id: string;
  reference: string;
  starts_at: Date;
  ends_at: Date;
  setup_minutes: number;
  turnaround_minutes: number;
  occupied_from: Date;
  occupied_until: Date;
  status: VenueSlotStatus;
  requires_reconfirmation: boolean;
}

function toSlot(row: SlotRow): VenueSlot {
  return {
    id: row.id,
    venueId: row.venue_id,
    eventId: row.event_id,
    reference: row.reference,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    setupMinutes: row.setup_minutes,
    turnaroundMinutes: row.turnaround_minutes,
    occupiedFrom: row.occupied_from,
    occupiedUntil: row.occupied_until,
    status: row.status,
    requiresReconfirmation: row.requires_reconfirmation,
  };
}

/**
 * Takes the venue row lock (§4.6 rule 1). M1 approving a booking, I2 recording
 * a block and every slot insert call this first, so they serialise per venue
 * and whichever runs second sees the other's result. Held until the
 * transaction ends; taking it twice in one transaction is harmless. False when
 * there is no such venue.
 */
export async function lockVenue(tx: TransactionSql, venueId: string): Promise<boolean> {
  const rows = await tx`select id from venue.venues where id = ${venueId} for update`;
  return rows.length === 1;
}

/**
 * Inserts a HELD or CONFIRMED slot, or refuses it when its occupied period
 * overlaps another hold or booking at the venue. The exclusion constraint
 * decides: there is no availability check first, so two simultaneous attempts
 * can't both pass one.
 *
 * It takes the venue row lock before inserting. Without it, two conflicting
 * inserts in flight at once can each wait for the other on the constraint, and
 * Postgres aborts one as a deadlock (40P01) instead of an overlap. EN-02.3's
 * race of fifty attempts showed this. With the lock they queue, and each loser
 * meets an already committed winner and is refused cleanly.
 *
 * The insert runs in a savepoint so that, when the constraint refuses it, the
 * transaction can still look up what the period overlapped and name it. That
 * look-up only shapes the message; it never decides anything.
 */
export async function insertVenueSlot(tx: TransactionSql, slot: NewVenueSlot): Promise<VenueSlot> {
  await lockVenue(tx, slot.venueId);
  try {
    const [row] = await tx.savepoint(
      (sp) => sp<SlotRow[]>`
        insert into venue.venue_slots
          (venue_id, event_id, reference, starts_at, ends_at, setup_minutes, turnaround_minutes,
           status, created_by, updated_by)
        values
          (${slot.venueId}, ${slot.eventId}, ${slot.reference}, ${slot.startsAt}, ${slot.endsAt},
           ${slot.setupMinutes}, ${slot.turnaroundMinutes}, ${slot.status}, ${slot.actorUserId}, ${slot.actorUserId})
        returning id, venue_id, event_id, reference, starts_at, ends_at, setup_minutes, turnaround_minutes,
                  lower(blocked_period) as occupied_from, upper(blocked_period) as occupied_until,
                  status, requires_reconfirmation
      `,
    );
    return toSlot(row!);
  } catch (error) {
    if (!isSlotOverlap(error)) throw error;
    throw new VenueSlotConflictError(await overlappedReferences(tx, slot));
  }
}

async function overlappedReferences(tx: TransactionSql, slot: NewVenueSlot): Promise<string[]> {
  const rows = await tx<{ reference: string }[]>`
    select reference from venue.venue_slots
    where venue_id = ${slot.venueId}
      and status in ('HELD', 'CONFIRMED')
      and blocked_period && venue.occupied_period(
            ${slot.startsAt}::timestamptz, ${slot.endsAt}::timestamptz,
            ${slot.setupMinutes}::int, ${slot.turnaroundMinutes}::int)
    order by lower(blocked_period), reference
  `;
  return rows.map((row) => row.reference);
}
