import type { Sql } from "postgres";
import { assignSlot } from "../domain/waitingRoom.js";
import type { Db } from "./seats.js";

/**
 * EN-19 — the waiting room's SQL (migration 0009, ADR-0011). The registration
 * schema only, one function per query. Nothing is deleted.
 */

export interface WaitingRoomEntry {
  id: string;
  eventId: string;
  attendeeId: string;
  joinedAt: Date;
  admitAt: Date;
  consumedAt: Date | null;
}

interface EntryRow {
  id: string;
  event_id: string;
  attendee_id: string;
  joined_at: Date;
  admit_at: Date;
  consumed_at: Date | null;
}

const toEntry = (row: EntryRow): WaitingRoomEntry => ({
  id: row.id,
  eventId: row.event_id,
  attendeeId: row.attendee_id,
  joinedAt: row.joined_at,
  admitAt: row.admit_at,
  consumedAt: row.consumed_at,
});

/**
 * Locks the event's gate (creating it on the first join) and returns the
 * attendee's latest entry and the gate's next slot. Every join for the event
 * queues on this one row for the few statements that follow, which is what
 * makes the slots strictly spaced and a repeated join by one attendee safe.
 * Call inside a transaction.
 */
export async function lockGate(tx: Db, eventId: string, now: Date, attendeeId: string): Promise<{ nextSlotAt: Date; latest: WaitingRoomEntry | null }> {
  const sql = tx as Sql;
  await sql`
    insert into registration.waiting_room_gates (event_id, next_slot_at) values (${eventId}, ${now})
    on conflict (event_id) do nothing
  `;
  const [gate] = await sql<{ next_slot_at: Date }[]>`
    select next_slot_at from registration.waiting_room_gates where event_id = ${eventId} for update
  `;
  const [latest] = await sql<EntryRow[]>`
    select id, event_id, attendee_id, joined_at, admit_at, consumed_at
    from registration.waiting_room_entries
    where event_id = ${eventId} and attendee_id = ${attendeeId}
    order by seq desc limit 1
  `;
  return { nextSlotAt: gate!.next_slot_at, latest: latest ? toEntry(latest) : null };
}

/** Takes the next slot at the (locked) gate and writes the attendee's entry. */
export async function takeSlot(tx: Db, input: { eventId: string; attendeeId: string; now: Date; gateNextSlotAt: Date; intervalMs: number }): Promise<WaitingRoomEntry> {
  const sql = tx as Sql;
  const { admitAt, nextSlotAt } = assignSlot(input.now, input.gateNextSlotAt, input.intervalMs);
  await sql`
    update registration.waiting_room_gates
    set next_slot_at = ${nextSlotAt}, updated_at = now(), updated_by = ${input.attendeeId}
    where event_id = ${input.eventId}
  `;
  const [row] = await sql<EntryRow[]>`
    insert into registration.waiting_room_entries (event_id, attendee_id, joined_at, admit_at, created_by, updated_by)
    values (${input.eventId}, ${input.attendeeId}, ${input.now}, ${admitAt}, ${input.attendeeId}, ${input.attendeeId})
    returning id, event_id, attendee_id, joined_at, admit_at, consumed_at
  `;
  return toEntry(row!);
}

export async function findEntry(db: Db, entryId: string): Promise<WaitingRoomEntry | null> {
  const sql = db as Sql;
  const [row] = await sql<EntryRow[]>`
    select id, event_id, attendee_id, joined_at, admit_at, consumed_at
    from registration.waiting_room_entries where id = ${entryId}
  `;
  return row ? toEntry(row) : null;
}

/** How many entries of the event are still waiting and come before this slot. */
export async function waitingAhead(db: Db, eventId: string, admitAt: Date, now: Date): Promise<number> {
  const sql = db as Sql;
  const [row] = await sql<{ n: number }[]>`
    select count(*)::int as n from registration.waiting_room_entries
    where event_id = ${eventId} and admit_at > ${now} and admit_at < ${admitAt}
  `;
  return row!.n;
}

/**
 * Spends an entry's token on the registration it admits: true when this call
 * is the one that spent it, false when it was spent already (or is not that
 * attendee's, or that event's). Call in the registration's transaction.
 */
export async function spendEntry(tx: Db, input: { entryId: string; eventId: string; attendeeId: string; now: Date }): Promise<boolean> {
  const sql = tx as Sql;
  const spent = await sql`
    update registration.waiting_room_entries
    set consumed_at = ${input.now}, updated_at = now(), updated_by = ${input.attendeeId}
    where id = ${input.entryId} and event_id = ${input.eventId} and attendee_id = ${input.attendeeId} and consumed_at is null
    returning id
  `;
  return spent.length === 1;
}
