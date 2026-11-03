import type { Sql, TransactionSql } from "postgres";
import { conflictKey, type BufferConflict, type LiveSlot } from "../domain/occupancy.js";

/**
 * H3-T10, H3-T11 (CR-01) — the bookings, holds and pending requests a venue's
 * new setup or turnaround time makes overlap. SQL against the venue schema
 * only. Callers hold the venue row lock (implementation.md §4.6, rule 1), so
 * no slot is taken meanwhile.
 *
 * Nothing is removed, released or moved: each slot keeps the times it was
 * taken with, each request its period, and each is flagged Requires
 * Reconfirmation as I2 flags one. A conflict record is cleared, never deleted,
 * once later times make the pair fit.
 */

type Db = Sql | TransactionSql;

/** A live booking or hold (a CONFIRMED or HELD slot), or a pending request, that hasn't ended yet. */
export interface LiveVenueSlot extends LiveSlot {
  kind: "BOOKING" | "HOLD" | "REQUEST";
  eventId: string;
  /** A request's requesting coordinator, who is told of it (as I2 tells them); null for a slot. */
  requestedBy: string | null;
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
    requestedBy: null,
  }));
}

/** H3-T11: the venue's pending requests that haven't ended, soonest first. A request reserves nothing, so several may share a period. */
export async function listPendingRequests(tx: TransactionSql, venueId: string): Promise<LiveVenueSlot[]> {
  const rows = await tx<{ id: string; reference: string; starts_at: Date; ends_at: Date; event_id: string; requested_by: string }[]>`
    select id, reference, starts_at, ends_at, event_id, requested_by
    from venue.booking_requests
    where venue_id = ${venueId} and status = 'PENDING' and ends_at > now()
    order by starts_at, reference
  `;
  return rows.map((row) => ({
    id: row.id,
    reference: row.reference,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    pending: true,
    kind: "REQUEST" as const,
    eventId: row.event_id,
    requestedBy: row.requested_by,
  }));
}

/** The venue's uncleared conflict pairs, as `conflictKey`s, so a further change keeps those that still overlap. */
export async function openConflictKeys(tx: TransactionSql, venueId: string): Promise<Set<string>> {
  const rows = await tx<{ item_id: string; other_id: string }[]>`
    select coalesce(slot_id, booking_request_id) as item_id, coalesce(other_slot_id, other_booking_request_id) as other_id
    from venue.buffer_conflicts
    where venue_id = ${venueId} and cleared_at is null
  `;
  return new Set(rows.map((row) => conflictKey(row.item_id, row.other_id)));
}

/**
 * Makes the venue's open conflict records match `conflicts`, as found with its
 * new times: clears those that no longer hold, records the new ones, flags
 * every booking, hold and request in conflict, and clears the flag of one left
 * with no open conflict and no active I2 block. `requestIds` says which ids are
 * pending requests rather than slots. Returns the ids that now overlap
 * something they didn't before, whose coordinators are to be told.
 */
export async function recordBufferConflicts(
  tx: TransactionSql,
  venueId: string,
  conflicts: readonly BufferConflict[],
  requestIds: ReadonlySet<string>,
  times: { setupMinutes: number; turnaroundMinutes: number },
  actorUserId: string,
): Promise<Set<string>> {
  const itemIds = conflicts.map((c) => c.slotId);
  const otherIds = conflicts.map((c) => c.overlapsId);
  // Sent as uuid[], like the ids: postgres.js types a JS boolean array as one boolean, which won't cast to boolean[].
  const requests = [...requestIds];

  const cleared = await tx<{ slot_id: string | null; booking_request_id: string | null }[]>`
    update venue.buffer_conflicts set cleared_by = ${actorUserId}, cleared_at = now()
    where venue_id = ${venueId} and cleared_at is null
      and (coalesce(slot_id, booking_request_id), coalesce(other_slot_id, other_booking_request_id))
          not in (select * from unnest(${itemIds}::uuid[], ${otherIds}::uuid[]))
    returning slot_id, booking_request_id
  `;
  const added = await tx<{ item_id: string }[]>`
    insert into venue.buffer_conflicts
      (venue_id, slot_id, booking_request_id, other_slot_id, other_booking_request_id, setup_minutes, turnaround_minutes, created_by)
    select ${venueId},
           case when pair.item_id = any(${requests}::uuid[]) then null else pair.item_id end,
           case when pair.item_id = any(${requests}::uuid[]) then pair.item_id end,
           case when pair.other_id = any(${requests}::uuid[]) then null else pair.other_id end,
           case when pair.other_id = any(${requests}::uuid[]) then pair.other_id end,
           ${times.setupMinutes}, ${times.turnaroundMinutes}, ${actorUserId}
    from unnest(${itemIds}::uuid[], ${otherIds}::uuid[]) as pair (item_id, other_id)
    on conflict ((coalesce(slot_id, booking_request_id)), (coalesce(other_slot_id, other_booking_request_id)))
      where (cleared_at is null) do nothing
    returning coalesce(slot_id, booking_request_id) as item_id
  `;

  const flaggedSlots = itemIds.filter((id) => !requestIds.has(id));
  const flaggedRequests = itemIds.filter((id) => requestIds.has(id));
  // Requests before slots, here and below: the lock order every path takes (implementation.md §4.6).
  await tx`
    update venue.booking_requests set requires_reconfirmation = true, updated_at = now(), updated_by = ${actorUserId}
    where id = any(${flaggedRequests}::uuid[]) and not requires_reconfirmation
  `;
  await tx`
    update venue.venue_slots set requires_reconfirmation = true, updated_at = now(), updated_by = ${actorUserId}
    where id = any(${flaggedSlots}::uuid[]) and not requires_reconfirmation
  `;

  const clearedSlots = cleared.flatMap((row) => (row.slot_id ? [row.slot_id] : []));
  const clearedRequests = cleared.flatMap((row) => (row.booking_request_id ? [row.booking_request_id] : []));
  await tx`
    update venue.booking_requests r set requires_reconfirmation = false, updated_at = now(), updated_by = ${actorUserId}
    where r.id = any(${clearedRequests}::uuid[]) and r.requires_reconfirmation
      and not exists (select 1 from venue.buffer_conflicts c where c.booking_request_id = r.id and c.cleared_at is null and ${otherSideLive(tx)})
      and not exists (
        select 1 from venue.block_disruptions d join venue.unavailability_blocks b on b.id = d.block_id
        where d.booking_request_id = r.id and b.status = 'ACTIVE'
      )
  `;
  await tx`
    update venue.venue_slots s set requires_reconfirmation = false, updated_at = now(), updated_by = ${actorUserId}
    where s.id = any(${clearedSlots}::uuid[]) and s.requires_reconfirmation
      and not exists (select 1 from venue.buffer_conflicts c where c.slot_id = s.id and c.cleared_at is null and ${otherSideLive(tx)})
      and not exists (
        select 1 from venue.block_disruptions d join venue.unavailability_blocks b on b.id = d.block_id
        where d.slot_id = s.id and b.status = 'ACTIVE'
      )
  `;
  return new Set(added.map((row) => row.item_id));
}

/**
 * Whether the other side of the conflict record aliased `c` is still a live
 * arrangement: a HELD or CONFIRMED slot, a PENDING request, or an APPROVED one
 * whose booking is still HELD or CONFIRMED (it became that booking, so the
 * overlap stands). A record whose other side was released, expired, withdrawn
 * or rejected keeps nothing flagged. The record itself stays open: it says the
 * venue's times made the two overlap, and only a later change of times clears
 * it (migration 0013). M3 (audit, 2 Nov 2026).
 */
export function otherSideLive(db: Db) {
  return db`(
    exists (select 1 from venue.venue_slots o where o.id = c.other_slot_id and o.status in ('HELD', 'CONFIRMED'))
    or exists (
      select 1 from venue.booking_requests o left join venue.venue_slots ob on ob.id = o.booking_id
      where o.id = c.other_booking_request_id
        and (o.status = 'PENDING' or (o.status = 'APPROVED' and ob.status in ('HELD', 'CONFIRMED')))
    )
  )`;
}

/**
 * M3 (audit, 2 Nov 2026), H3, I6: when bookings, holds or requests end
 * (released, expired, withdrawn, rejected, or released by a cancellation), the
 * arrangements a buffer change had flagged against them are cleared of
 * Requires Reconfirmation, unless another live conflict or an active I2 block
 * still causes it. Without this the flag stayed until the venue's times changed
 * again, and F5 refused the other event for good.
 *
 * Call after the ended rows' statuses are written, in the same transaction,
 * holding the row lock of the venue they were at (§4.6 rule 1), so H3 can't
 * re-flag in between. Requests are updated before slots, the lock order every
 * path takes. `actorUserId` is null when the system ends them (L6's expiry).
 * Returns the ids whose flag was cleared.
 */
export async function clearFlagsOfEnded(tx: TransactionSql, endedIds: readonly string[], actorUserId: string | null): Promise<string[]> {
  if (endedIds.length === 0) return [];
  const ended = [...endedIds];
  const counterparts = tx`
    select coalesce(c.slot_id, c.booking_request_id) from venue.buffer_conflicts c
    where c.cleared_at is null and coalesce(c.other_slot_id, c.other_booking_request_id) = any(${ended}::uuid[])
  `;
  const requests = await tx<{ id: string }[]>`
    update venue.booking_requests r set requires_reconfirmation = false, updated_at = now(), updated_by = coalesce(${actorUserId}::uuid, r.updated_by)
    where r.id in (${counterparts}) and r.status = 'PENDING' and r.requires_reconfirmation
      and not exists (select 1 from venue.buffer_conflicts c where c.booking_request_id = r.id and c.cleared_at is null and ${otherSideLive(tx)})
      and not exists (
        select 1 from venue.block_disruptions d join venue.unavailability_blocks b on b.id = d.block_id
        where d.booking_request_id = r.id and b.status = 'ACTIVE'
      )
    returning r.id
  `;
  const slots = await tx<{ id: string }[]>`
    update venue.venue_slots s set requires_reconfirmation = false, updated_at = now(), updated_by = coalesce(${actorUserId}::uuid, s.updated_by)
    where s.id in (${counterparts}) and s.status in ('HELD', 'CONFIRMED') and s.requires_reconfirmation
      and not exists (select 1 from venue.buffer_conflicts c where c.slot_id = s.id and c.cleared_at is null and ${otherSideLive(tx)})
      and not exists (
        select 1 from venue.block_disruptions d join venue.unavailability_blocks b on b.id = d.block_id
        where d.slot_id = s.id and b.status = 'ACTIVE'
      )
    returning s.id
  `;
  return [...requests, ...slots].map((row) => row.id);
}
