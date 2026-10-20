import type { TransactionSql } from "postgres";
import type { BufferConflict, LiveSlot } from "../domain/occupancy.js";

/**
 * H3-T10 (CR-01) — the bookings and holds a venue's new setup or turnaround
 * time makes overlap. SQL against the venue schema only. Callers hold the venue
 * row lock (implementation.md §4.6, rule 1), so no slot is taken meanwhile.
 *
 * Nothing is removed, released or moved: each slot keeps the times it was
 * taken with, and is flagged Requires Reconfirmation as I2 flags one. A
 * conflict record is cleared, never deleted, once later times make the pair fit.
 */

/** A live booking or hold: a CONFIRMED or HELD slot that hasn't ended yet. */
export interface LiveVenueSlot extends LiveSlot {
  kind: "BOOKING" | "HOLD";
  eventId: string;
}

/** The venue's live bookings and holds, soonest first. One already over can't conflict with anything to come. */
export async function listLiveSlots(tx: TransactionSql, venueId: string): Promise<LiveVenueSlot[]> {
  const rows = await tx<{ id: string; reference: string; starts_at: Date; ends_at: Date; kind: "BOOKING" | "HOLD"; event_id: string }[]>`
    select id, reference, starts_at, ends_at, case status when 'HELD' then 'HOLD' else 'BOOKING' end as kind, event_id
    from venue.venue_slots
    where venue_id = ${venueId} and status in ('HELD', 'CONFIRMED') and ends_at > now()
    order by starts_at, reference
  `;
  return rows.map((row) => ({
    id: row.id,
    reference: row.reference,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    kind: row.kind,
    eventId: row.event_id,
  }));
}

/**
 * Makes the venue's open conflict records match `conflicts`, as found with its
 * new times: clears those that no longer hold, records the new ones, flags
 * every slot in conflict, and clears the flag of a slot left with no open
 * conflict and no active I2 block. Returns the ids of the slots that now
 * overlap something they didn't before, whose coordinators are to be told.
 */
export async function recordBufferConflicts(
  tx: TransactionSql,
  venueId: string,
  conflicts: readonly BufferConflict[],
  times: { setupMinutes: number; turnaroundMinutes: number },
  actorUserId: string,
): Promise<Set<string>> {
  const slotIds = conflicts.map((c) => c.slotId);
  const otherIds = conflicts.map((c) => c.overlapsId);

  const cleared = await tx<{ slot_id: string }[]>`
    update venue.buffer_conflicts set cleared_by = ${actorUserId}, cleared_at = now()
    where venue_id = ${venueId} and cleared_at is null
      and (slot_id, other_slot_id) not in (select * from unnest(${slotIds}::uuid[], ${otherIds}::uuid[]))
    returning slot_id
  `;
  const added = await tx<{ slot_id: string }[]>`
    insert into venue.buffer_conflicts (venue_id, slot_id, other_slot_id, setup_minutes, turnaround_minutes, created_by)
    select ${venueId}, pair.slot_id, pair.other_slot_id, ${times.setupMinutes}, ${times.turnaroundMinutes}, ${actorUserId}
    from unnest(${slotIds}::uuid[], ${otherIds}::uuid[]) as pair (slot_id, other_slot_id)
    on conflict (slot_id, other_slot_id) where (cleared_at is null) do nothing
    returning slot_id
  `;
  await tx`
    update venue.venue_slots set requires_reconfirmation = true, updated_at = now(), updated_by = ${actorUserId}
    where id = any(${slotIds}::uuid[]) and not requires_reconfirmation
  `;
  await tx`
    update venue.venue_slots s set requires_reconfirmation = false, updated_at = now(), updated_by = ${actorUserId}
    where s.id = any(${cleared.map((row) => row.slot_id)}::uuid[]) and s.requires_reconfirmation
      and not exists (select 1 from venue.buffer_conflicts c where c.slot_id = s.id and c.cleared_at is null)
      and not exists (
        select 1 from venue.block_disruptions d join venue.unavailability_blocks b on b.id = d.block_id
        where d.slot_id = s.id and b.status = 'ACTIVE'
      )
  `;
  return new Set(added.map((row) => row.slot_id));
}
