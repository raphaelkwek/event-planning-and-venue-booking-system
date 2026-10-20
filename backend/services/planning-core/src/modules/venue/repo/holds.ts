import type { Sql, TransactionSql } from "postgres";
import type { HoldStatus } from "@connectsphere/contracts";
import { isLiveHoldDuplicate, type OverlappedPeriod } from "../domain/hold.js";
import { VenueSlotConflictError } from "../domain/slotConflict.js";
import { insertVenueSlot } from "./slots.js";

/**
 * L3 — tentative holds (migration venue/0012). SQL against the venue schema
 * only. Who gets a period is decided by the venue_slots exclusion constraint
 * when Venue Staff place a hold (insertVenueSlot); a second live hold for the
 * same event and venue by the holds_one_live_per_event_and_venue index.
 * Nothing here checks first and then writes.
 */

type Db = Sql | TransactionSql;

export interface Hold {
  id: string;
  reference: string;
  eventId: string;
  venueId: string;
  venueName: string;
  startsAt: string;
  endsAt: string;
  reminderLeadMinutes: number;
  status: HoldStatus;
  requestedBy: string;
  requestedAt: string;
  placedBy: string | null;
  placedAt: string | null;
  expiresAt: string | null;
  slotId: string | null;
  convertedRequestId: string | null;
  convertedBy: string | null;
  convertedAt: string | null;
  releasedBy: string | null;
  releasedAt: string | null;
}

export interface NewHold {
  eventId: string;
  venueId: string;
  startsAt: string;
  endsAt: string;
  reminderLeadMinutes: number;
  requestedBy: string;
}

/** A second requested or held hold for the same event and venue (L3-T11). */
export class DuplicateHoldError extends Error {
  constructor(readonly reference: string | null) {
    super("This event already has a live hold at this venue.");
    this.name = "DuplicateHoldError";
  }
}

/** Placing a hold whose occupied period overlaps another hold or booking (L3-T8). */
export class HoldConflictError extends Error {
  constructor(readonly overlapped: readonly OverlappedPeriod[]) {
    super("The period overlaps another hold or booking at the venue.");
    this.name = "HoldConflictError";
  }
}

interface Row {
  id: string;
  reference: string;
  event_id: string;
  venue_id: string;
  venue_name: string;
  starts_at: Date;
  ends_at: Date;
  reminder_lead_minutes: number;
  status: HoldStatus;
  requested_by: string;
  requested_at: Date;
  placed_by: string | null;
  placed_at: Date | null;
  expires_at: Date | null;
  slot_id: string | null;
  converted_request_id: string | null;
  converted_by: string | null;
  converted_at: Date | null;
  released_by: string | null;
  released_at: Date | null;
}

const iso = (value: Date | null) => value?.toISOString() ?? null;

function toHold(row: Row): Hold {
  return {
    id: row.id,
    reference: row.reference,
    eventId: row.event_id,
    venueId: row.venue_id,
    venueName: row.venue_name,
    startsAt: row.starts_at.toISOString(),
    endsAt: row.ends_at.toISOString(),
    reminderLeadMinutes: row.reminder_lead_minutes,
    status: row.status,
    requestedBy: row.requested_by,
    requestedAt: row.requested_at.toISOString(),
    placedBy: row.placed_by,
    placedAt: iso(row.placed_at),
    expiresAt: iso(row.expires_at),
    slotId: row.slot_id,
    convertedRequestId: row.converted_request_id,
    convertedBy: row.converted_by,
    convertedAt: iso(row.converted_at),
    releasedBy: row.released_by,
    releasedAt: iso(row.released_at),
  };
}

const COLUMNS = (db: Db) => db`
  h.id, h.reference, h.event_id, h.venue_id, v.name as venue_name, h.starts_at, h.ends_at, h.reminder_lead_minutes,
  h.status, h.requested_by, h.requested_at, h.placed_by, h.placed_at, h.expires_at, h.slot_id,
  h.converted_request_id, h.converted_by, h.converted_at, h.released_by, h.released_at
`;

/**
 * Stores a Requested hold, or refuses it when the event already has a requested
 * or held hold at the venue. The insert runs in a savepoint so that, when the
 * index refuses it, the transaction can still name the existing hold.
 */
export async function insertHold(tx: TransactionSql, hold: NewHold): Promise<Hold> {
  try {
    const [inserted] = await tx.savepoint(
      (sp) => sp<{ id: string }[]>`
        insert into venue.holds
          (event_id, venue_id, starts_at, ends_at, reminder_lead_minutes, requested_by, created_by, updated_by)
        values
          (${hold.eventId}, ${hold.venueId}, ${hold.startsAt}, ${hold.endsAt}, ${hold.reminderLeadMinutes},
           ${hold.requestedBy}, ${hold.requestedBy}, ${hold.requestedBy})
        returning id
      `,
    );
    return (await findHold(tx, inserted!.id))!;
  } catch (error) {
    if (!isLiveHoldDuplicate(error)) throw error;
    const [existing] = await tx<{ reference: string }[]>`
      select reference from venue.holds
      where event_id = ${hold.eventId} and venue_id = ${hold.venueId} and status in ('REQUESTED', 'HELD')
    `;
    throw new DuplicateHoldError(existing?.reference ?? null);
  }
}

export async function findHold(db: Db, id: string): Promise<Hold | null> {
  const rows = await db<Row[]>`
    select ${COLUMNS(db)} from venue.holds h join venue.venues v on v.id = h.venue_id where h.id = ${id}
  `;
  return rows[0] ? toHold(rows[0]) : null;
}

/** Holds the hold's row until the transaction ends, so two decisions on it can't both pass its status check. */
export async function lockHold(tx: TransactionSql, id: string): Promise<Hold | null> {
  const rows = await tx<Row[]>`
    select ${COLUMNS(tx)} from venue.holds h join venue.venues v on v.id = h.venue_id
    where h.id = ${id}
    for update of h
  `;
  return rows[0] ? toHold(rows[0]) : null;
}

/** Every hold of one event, oldest first. */
export async function listHoldsForEvent(db: Db, eventId: string): Promise<Hold[]> {
  const rows = await db<Row[]>`
    select ${COLUMNS(db)} from venue.holds h join venue.venues v on v.id = h.venue_id
    where h.event_id = ${eventId}
    order by h.requested_at, h.reference
  `;
  return rows.map(toHold);
}

/** The requested holds at the venues this Venue Staff member looks after, soonest first. */
export async function listRequestedForStaff(db: Db, staffUserId: string): Promise<Hold[]> {
  const rows = await db<Row[]>`
    select ${COLUMNS(db)} from venue.holds h join venue.venues v on v.id = h.venue_id
    where h.status = 'REQUESTED'
      and exists (select 1 from venue.venue_staff s where s.venue_id = h.venue_id and s.user_id = ${staffUserId})
    order by h.starts_at, h.reference
  `;
  return rows.map(toHold);
}

/** True when the user is one of the venue's Venue Staff (venue.venue_staff). */
export async function looksAfterVenue(db: Db, venueId: string, userId: string): Promise<boolean> {
  const rows = await db`select 1 from venue.venue_staff where venue_id = ${venueId} and user_id = ${userId}`;
  return rows.length === 1;
}

export interface Placement {
  expiresAt: string;
  /** The venue's setup and turnaround time now; the slot keeps its own copy (H3). */
  setupMinutes: number;
  turnaroundMinutes: number;
  actorUserId: string;
}

/**
 * Places a Requested hold: takes its period as a HELD slot under the hold's
 * reference, then records who placed it, when, and the expiry. When the
 * occupied period overlaps another hold or booking, insertVenueSlot refuses it
 * and nothing is written: the hold stays Requested (L3-T8). The caller locks
 * the hold first.
 */
export async function placeHold(tx: TransactionSql, hold: Hold, placement: Placement): Promise<Hold> {
  let slotId: string;
  try {
    const slot = await insertVenueSlot(tx, {
      venueId: hold.venueId,
      eventId: hold.eventId,
      reference: hold.reference,
      startsAt: new Date(hold.startsAt),
      endsAt: new Date(hold.endsAt),
      setupMinutes: placement.setupMinutes,
      turnaroundMinutes: placement.turnaroundMinutes,
      status: "HELD",
      actorUserId: placement.actorUserId,
    });
    slotId = slot.id;
  } catch (error) {
    if (!(error instanceof VenueSlotConflictError)) throw error;
    throw new HoldConflictError(await overlappedPeriods(tx, hold.venueId, error.conflictingReferences));
  }
  await tx`
    update venue.holds
    set status = 'HELD', slot_id = ${slotId}, placed_by = ${placement.actorUserId}, placed_at = now(),
        expires_at = ${placement.expiresAt}, updated_at = now(), updated_by = ${placement.actorUserId}
    where id = ${hold.id}
  `;
  return (await findHold(tx, hold.id))!;
}

/** Each overlapped hold's or booking's own period, for the refusal (L3-T8). */
async function overlappedPeriods(tx: TransactionSql, venueId: string, references: readonly string[]): Promise<OverlappedPeriod[]> {
  if (references.length === 0) return [];
  const rows = await tx<{ reference: string; starts_at: Date; ends_at: Date }[]>`
    select reference, starts_at, ends_at from venue.venue_slots
    where venue_id = ${venueId} and status in ('HELD', 'CONFIRMED') and reference in ${tx(references as string[])}
    order by starts_at, reference
  `;
  return rows.map((row) => ({ reference: row.reference, startsAt: row.starts_at.toISOString(), endsAt: row.ends_at.toISOString() }));
}

/** Frees a slot that is still HELD; true when it did. A confirmed or already released slot is left alone. */
async function releaseHeldSlot(tx: TransactionSql, slotId: string, actorUserId: string): Promise<boolean> {
  const rows = await tx`
    update venue.venue_slots set status = 'RELEASED', updated_at = now(), updated_by = ${actorUserId}
    where id = ${slotId} and status = 'HELD'
    returning id
  `;
  return rows.length === 1;
}

/**
 * Releases a Requested or Held hold (L3-T15): the hold becomes Released, and a
 * placed hold's slot RELEASED, so the period is free again. The record is kept.
 * The caller locks the hold and checks its status.
 */
export async function releaseHold(tx: TransactionSql, hold: Hold, actorUserId: string): Promise<Hold> {
  if (hold.slotId) await releaseHeldSlot(tx, hold.slotId, actorUserId);
  await tx`
    update venue.holds
    set status = 'RELEASED', released_by = ${actorUserId}, released_at = now(), updated_at = now(), updated_by = ${actorUserId}
    where id = ${hold.id}
  `;
  return (await findHold(tx, hold.id))!;
}

/**
 * L3-T13: the hold is superseded by the booking request it became. Its slot
 * stays HELD (implementation.md §4.6 rule 3), now under the request's
 * reference, so a refusal names the request until M1 or M2 decides it.
 */
export async function markHoldConverted(
  tx: TransactionSql,
  hold: Hold,
  request: { id: string; reference: string },
  actorUserId: string,
): Promise<Hold> {
  await tx`
    update venue.holds
    set status = 'CONVERTED', converted_request_id = ${request.id}, converted_by = ${actorUserId}, converted_at = now(),
        updated_at = now(), updated_by = ${actorUserId}
    where id = ${hold.id}
  `;
  await tx`
    update venue.venue_slots set reference = ${request.reference}, updated_at = now(), updated_by = ${actorUserId}
    where id = ${hold.slotId!}
  `;
  return (await findHold(tx, hold.id))!;
}

/** The held slot of the hold a booking request was converted from, locked; null when it wasn't converted from one. */
async function lockConvertedSlot(tx: TransactionSql, requestId: string): Promise<{ id: string; status: string } | null> {
  const rows = await tx<{ id: string; status: string }[]>`
    select s.id, s.status
    from venue.holds h join venue.venue_slots s on s.id = h.slot_id
    where h.converted_request_id = ${requestId}
    for update of s
  `;
  return rows[0] ?? null;
}

/** The request's converted hold no longer has a HELD slot to confirm. */
export class HeldSlotNotHeldError extends Error {
  constructor(readonly slotId: string, readonly status: string) {
    super(`The held period of this request is ${status}, not HELD, so it can't be confirmed.`);
    this.name = "HeldSlotNotHeldError";
  }
}

/**
 * M1 (api/bookingDecisions.ts). Approving a request that was converted from a
 * hold confirms the slot the hold took, instead of inserting a new one
 * (implementation.md §4.6 rule 3): never release and re-insert, which would
 * open a window for another hold. Returns the slot's id, which M1 records as
 * the request's booking, or null when the request wasn't converted from a hold
 * (M1 then inserts a CONFIRMED slot as before). Throws HeldSlotNotHeldError if
 * the slot is no longer HELD. Called inside M1's transaction, after the venue
 * row lock.
 */
export async function confirmHeldSlotForRequest(tx: TransactionSql, requestId: string, actorUserId: string): Promise<string | null> {
  const slot = await lockConvertedSlot(tx, requestId);
  if (!slot) return null;
  if (slot.status !== "HELD") throw new HeldSlotNotHeldError(slot.id, slot.status);
  await tx`
    update venue.venue_slots set status = 'CONFIRMED', updated_at = now(), updated_by = ${actorUserId}
    where id = ${slot.id}
  `;
  return slot.id;
}

/**
 * L2 (withdrawal) and M2 (rejection) call this. A request converted
 * from a hold frees the period the hold took. True when a HELD slot was
 * released; false when the request wasn't converted from a hold, or its slot
 * isn't HELD any more.
 */
export async function releaseHeldSlotForRequest(tx: TransactionSql, requestId: string, actorUserId: string): Promise<boolean> {
  const slot = await lockConvertedSlot(tx, requestId);
  if (!slot) return false;
  return releaseHeldSlot(tx, slot.id, actorUserId);
}

/**
 * For F4: cancelling an event releases its requested and held holds, as part of
 * the release run (L3). Returns the released holds' references. Converted holds
 * are left to their requests' own release.
 */
export async function releaseHoldsForEvent(tx: TransactionSql, eventId: string, actorUserId: string): Promise<string[]> {
  const live = await tx<{ id: string }[]>`
    select id from venue.holds where event_id = ${eventId} and status in ('REQUESTED', 'HELD')
    order by requested_at, reference
    for update
  `;
  const released: string[] = [];
  for (const { id } of live) released.push((await releaseHold(tx, (await findHold(tx, id))!, actorUserId)).reference);
  return released;
}
