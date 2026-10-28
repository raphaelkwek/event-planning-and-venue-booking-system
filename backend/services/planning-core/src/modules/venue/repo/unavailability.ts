import type { Sql, TransactionSql } from "postgres";
import type { DisruptedKind, StillFlaggedCause, UnavailabilityBlockStatus, UnavailabilityReasonType } from "@connectsphere/contracts";

/**
 * I2 — periods when a venue can't be used. SQL against the venue schema only.
 *
 * A block never refuses or releases what it overlaps (C-12, implementation.md
 * §4.6): each confirmed booking, hold or pending request it disrupts is flagged
 * Requires Reconfirmation and keeps its period. venue.block_disruptions records
 * which block flagged what, so removing a block clears only the flags no other
 * active block still causes. Callers take the venue row lock first (rule 1).
 */

type Db = Sql | TransactionSql;

export interface Block {
  id: string;
  venueId: string;
  startsAt: string;
  /** Null for a block with no end, which lasts until Venue Staff remove it (I5). */
  endsAt: string | null;
  reasonType: UnavailabilityReasonType;
  description: string;
  status: UnavailabilityBlockStatus;
  createdBy: string;
  createdAt: string;
  removedBy: string | null;
  removedAt: string | null;
}

export interface NewBlock {
  venueId: string;
  startsAt: Date;
  endsAt: Date | null;
  reasonType: UnavailabilityReasonType;
  description: string;
  actorUserId: string;
}

/** Something a block disrupts: a confirmed booking or hold (a venue slot), or a pending request. */
export interface Disrupted {
  kind: DisruptedKind;
  /** The slot's id, or the request's. */
  id: string;
  reference: string;
  eventId: string;
  /** A request's requesting coordinator; null for a booking or hold. */
  requestedBy: string | null;
  /** Where the block's period meets the booking's occupied period (CR-01) or the request's period. */
  overlapFrom: string;
  overlapUntil: string;
}

interface BlockRow {
  id: string;
  venue_id: string;
  starts_at: Date;
  ends_at: Date | null;
  reason_type: UnavailabilityReasonType;
  description: string;
  status: UnavailabilityBlockStatus;
  created_by: string;
  created_at: Date;
  removed_by: string | null;
  removed_at: Date | null;
}

function toBlock(row: BlockRow): Block {
  return {
    id: row.id,
    venueId: row.venue_id,
    startsAt: row.starts_at.toISOString(),
    endsAt: row.ends_at?.toISOString() ?? null,
    reasonType: row.reason_type,
    description: row.description,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at.toISOString(),
    removedBy: row.removed_by,
    removedAt: row.removed_at?.toISOString() ?? null,
  };
}

const BLOCK_COLUMNS = (db: Db) => db`
  id, venue_id, starts_at, ends_at, reason_type, description, status, created_by, created_at, removed_by, removed_at
`;

export async function insertBlock(tx: TransactionSql, block: NewBlock): Promise<Block> {
  const [row] = await tx<BlockRow[]>`
    insert into venue.unavailability_blocks (venue_id, starts_at, ends_at, reason_type, description, created_by, updated_by)
    values (${block.venueId}, ${block.startsAt}, ${block.endsAt}, ${block.reasonType}, ${block.description},
            ${block.actorUserId}, ${block.actorUserId})
    returning ${BLOCK_COLUMNS(tx)}
  `;
  return toBlock(row!);
}

export async function findBlock(db: Db, id: string): Promise<Block | null> {
  const rows = await db<BlockRow[]>`select ${BLOCK_COLUMNS(db)} from venue.unavailability_blocks where id = ${id}`;
  return rows[0] ? toBlock(rows[0]) : null;
}

/** Holds the block's row until the transaction ends, so two removals can't both pass the Active check. */
export async function lockBlock(tx: TransactionSql, id: string): Promise<Block | null> {
  const rows = await tx<BlockRow[]>`select ${BLOCK_COLUMNS(tx)} from venue.unavailability_blocks where id = ${id} for update`;
  return rows[0] ? toBlock(rows[0]) : null;
}

/** A venue's active blocks, soonest first. */
export async function listActiveBlocks(db: Db, venueId: string): Promise<Block[]> {
  const rows = await db<BlockRow[]>`
    select ${BLOCK_COLUMNS(db)} from venue.unavailability_blocks
    where venue_id = ${venueId} and status = 'ACTIVE'
    order by starts_at, id
  `;
  return rows.map(toBlock);
}

/**
 * What a block from `startsAt` to `endsAt` would disrupt at the venue: confirmed
 * bookings and holds whose occupied period it overlaps (CR-01), and pending
 * requests whose period it overlaps, soonest overlap first. `&&` on `[)` ranges,
 * so what only touches the block is left alone. With no end (I5) the block runs
 * from its start for ever, so it disrupts whatever ends after it starts.
 */
export async function disruptedBy(db: Db, venueId: string, startsAt: Date, endsAt: Date | null): Promise<Disrupted[]> {
  const rows = await db<
    { kind: DisruptedKind; id: string; reference: string; event_id: string; requested_by: string | null; overlap_from: Date; overlap_until: Date }[]
  >`
    with block as (select tstzrange(${startsAt}::timestamptz, ${endsAt}::timestamptz, '[)') as period),
    disrupted as (
      select case s.status when 'HELD' then 'HOLD' else 'BOOKING' end as kind, s.id, s.reference, s.event_id,
             null::uuid as requested_by, s.blocked_period * block.period as overlap
      from venue.venue_slots s, block
      where s.venue_id = ${venueId} and s.status in ('HELD', 'CONFIRMED') and s.blocked_period && block.period
      union all
      select 'REQUEST', r.id, r.reference, r.event_id, r.requested_by, r.period * block.period
      from venue.booking_requests r, block
      where r.venue_id = ${venueId} and r.status = 'PENDING' and r.period && block.period
    )
    select kind, id, reference, event_id, requested_by, lower(overlap) as overlap_from, upper(overlap) as overlap_until
    from disrupted
    order by lower(overlap), kind, reference
  `;
  return rows.map((row) => ({
    kind: row.kind,
    id: row.id,
    reference: row.reference,
    eventId: row.event_id,
    requestedBy: row.requested_by,
    overlapFrom: row.overlap_from.toISOString(),
    overlapUntil: row.overlap_until.toISOString(),
  }));
}

/** I2: flags each disrupted booking, hold and request Requires Reconfirmation, recording which block, who and when. */
export async function flagDisruptions(tx: TransactionSql, blockId: string, disrupted: readonly Disrupted[], actorUserId: string): Promise<void> {
  const slotIds = disrupted.filter((d) => d.kind !== "REQUEST").map((d) => d.id);
  const requestIds = disrupted.filter((d) => d.kind === "REQUEST").map((d) => d.id);
  if (slotIds.length > 0) {
    await tx`
      insert into venue.block_disruptions (block_id, slot_id, created_by)
      select ${blockId}, unnest(${slotIds}::uuid[]), ${actorUserId}
    `;
    await tx`
      update venue.venue_slots set requires_reconfirmation = true, updated_at = now(), updated_by = ${actorUserId}
      where id = any(${slotIds}::uuid[])
    `;
  }
  if (requestIds.length > 0) {
    await tx`
      insert into venue.block_disruptions (block_id, booking_request_id, created_by)
      select ${blockId}, unnest(${requestIds}::uuid[]), ${actorUserId}
    `;
    await tx`
      update venue.booking_requests set requires_reconfirmation = true, updated_at = now(), updated_by = ${actorUserId}
      where id = any(${requestIds}::uuid[])
    `;
  }
}

/** I2: Removed, with who and when. The row is kept. */
export async function removeBlock(tx: TransactionSql, id: string, actorUserId: string): Promise<void> {
  await tx`
    update venue.unavailability_blocks
    set status = 'REMOVED', removed_by = ${actorUserId}, removed_at = now(), updated_at = now(), updated_by = ${actorUserId}
    where id = ${id}
  `;
}

export interface ClearedDisruption {
  kind: DisruptedKind;
  id: string;
  reference: string;
  eventId: string;
  requestedBy: string | null;
  /** True when another active block still disrupts it, or H3's buffer conflict remains, so its flag stays. */
  stillDisrupted: boolean;
  /** H3-T14: why the flag stays, another block before the venue's times; null when it clears. */
  stillCause: StillFlaggedCause | null;
}

/**
 * After a block is removed: for each booking, hold and pending request it had
 * disrupted that is still live, clears the flag unless another active block
 * still disrupts it, and says which. Soonest first. What was released, expired,
 * decided or withdrawn since is passed over.
 */
export async function clearDisruptions(tx: TransactionSql, blockId: string): Promise<ClearedDisruption[]> {
  const rows = await tx<
    {
      kind: DisruptedKind;
      id: string;
      reference: string;
      event_id: string;
      requested_by: string | null;
      starts_at: Date;
      still_cause: StillFlaggedCause | null;
    }[]
  >`
    select case s.status when 'HELD' then 'HOLD' else 'BOOKING' end as kind, s.id, s.reference, s.event_id,
           null::uuid as requested_by, s.starts_at,
           case
             when exists (
               select 1 from venue.block_disruptions o join venue.unavailability_blocks ob on ob.id = o.block_id
               where o.slot_id = s.id and o.block_id <> ${blockId} and ob.status = 'ACTIVE'
             ) then 'UNAVAILABILITY'
             -- H3-T10: the venue's times still make it overlap another booking, hold or request.
             when exists (select 1 from venue.buffer_conflicts c where c.slot_id = s.id and c.cleared_at is null) then 'BUFFER_CONFLICT'
           end as still_cause
    from venue.block_disruptions d join venue.venue_slots s on s.id = d.slot_id
    where d.block_id = ${blockId} and s.status in ('HELD', 'CONFIRMED')
    union all
    select 'REQUEST', r.id, r.reference, r.event_id, r.requested_by, r.starts_at,
           case
             when exists (
               select 1 from venue.block_disruptions o join venue.unavailability_blocks ob on ob.id = o.block_id
               where o.booking_request_id = r.id and o.block_id <> ${blockId} and ob.status = 'ACTIVE'
             ) then 'UNAVAILABILITY'
             -- H3-T11: the venue's times still make the request overlap another.
             when exists (select 1 from venue.buffer_conflicts c where c.booking_request_id = r.id and c.cleared_at is null) then 'BUFFER_CONFLICT'
           end
    from venue.block_disruptions d join venue.booking_requests r on r.id = d.booking_request_id
    where d.block_id = ${blockId} and r.status = 'PENDING'
    order by starts_at, kind, reference
  `;
  const clearSlots = rows.filter((r) => !r.still_cause && r.kind !== "REQUEST").map((r) => r.id);
  const clearRequests = rows.filter((r) => !r.still_cause && r.kind === "REQUEST").map((r) => r.id);
  if (clearSlots.length > 0) {
    await tx`update venue.venue_slots set requires_reconfirmation = false, updated_at = now() where id = any(${clearSlots}::uuid[])`;
  }
  if (clearRequests.length > 0) {
    await tx`update venue.booking_requests set requires_reconfirmation = false, updated_at = now() where id = any(${clearRequests}::uuid[])`;
  }
  return rows.map((row) => ({
    kind: row.kind,
    id: row.id,
    reference: row.reference,
    eventId: row.event_id,
    requestedBy: row.requested_by,
    stillDisrupted: row.still_cause !== null,
    stillCause: row.still_cause,
  }));
}
