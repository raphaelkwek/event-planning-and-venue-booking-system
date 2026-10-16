import type { TransactionSql } from "postgres";
import type { EquipmentRequestLineStatus } from "@connectsphere/contracts";
import { statusAfterRelease } from "../domain/reservations.js";
import { toReservation, type ReservationRecord, type ReservationRow } from "./reservations.js";
import { lockLine, markReleased, type Actor, type RequestLine } from "./requestLines.js";

/**
 * Q2 — releasing a reservation, in the caller's transaction. Nothing is
 * deleted (AC3): the reservation and the unit or bulk rows it groups become
 * RELEASED, and availability, which counts only RESERVED rows, has the stock
 * back at once (AC2).
 *
 * Locks: the line, then the reservation. A release never takes the type lock —
 * it only frees stock — so it cannot deadlock with Q1's line-then-type order.
 * The caller writes the coordinator's outbox message (AC5).
 */

export type ReleaseReservationOutcome = { ok: true; reservation: ReservationRecord } | { ok: false; code: "ALREADY_RELEASED" };

export type ReleaseLineOutcome =
  | { ok: true; reservation: ReservationRecord; line: RequestLine; previous: RequestLine }
  | { ok: false; code: "GONE" }
  | { ok: false; code: "LINE_NOT_RELEASABLE"; status: EquipmentRequestLineStatus }
  | { ok: false; code: "ALREADY_RELEASED" };

/** Releases one reservation. A released one is left exactly as it is (AC4). */
export async function releaseReservation(
  tx: TransactionSql,
  reservationId: string,
  actor: Actor,
  reason: string,
): Promise<ReleaseReservationOutcome> {
  // validateReleaseBody's job; a caller that skipped it would otherwise meet the table's check (23514).
  if (reason.trim() === "") throw new Error("A release needs a reason");
  const [locked] = await tx<{ status: string }[]>`
    select status from equipment.reservations where id = ${reservationId} for update
  `;
  if (!locked) throw new Error(`No such reservation: ${reservationId}`);
  if (locked.status === "RELEASED") return { ok: false, code: "ALREADY_RELEASED" };

  const [row] = await tx<ReservationRow[]>`
    update equipment.reservations
    set status = 'RELEASED', released_by = ${actor.userId}, released_at = clock_timestamp(),
        release_reason = ${reason}, updated_at = now(), updated_by = ${actor.userId}
    where id = ${reservationId}
    returning *
  `;
  await tx`
    update equipment.unit_reservations set status = 'RELEASED', updated_at = now(), updated_by = ${actor.userId}
    where reservation_id = ${reservationId}
  `;
  await tx`
    update equipment.bulk_reservations set status = 'RELEASED', updated_at = now(), updated_by = ${actor.userId}
    where reservation_id = ${reservationId}
  `;
  return { ok: true, reservation: toReservation(row!) };
}

/** Technical Support's release: the line must be Reserved; it goes back to Confirmed or Substituted. */
export async function releaseLine(tx: TransactionSql, lineId: string, reason: string, actor: Actor): Promise<ReleaseLineOutcome> {
  const current = await lockLine(tx, lineId);
  if (!current) return { ok: false, code: "GONE" };
  if (current.status !== "RESERVED" || !current.reservation) {
    return { ok: false, code: "LINE_NOT_RELEASABLE", status: current.status };
  }

  const released = await releaseReservation(tx, current.reservation.id, actor, reason);
  if (!released.ok) return released;

  const line = await markReleased(
    tx,
    current,
    { reservationId: released.reservation.id, reason, status: statusAfterRelease(current) },
    actor,
  );
  return { ok: true, reservation: released.reservation, line, previous: current };
}

/**
 * F4's release run (AC1): every Reserved line of the event, in list order,
 * released with F4's reason. F4 calls this through equipment's index.ts inside
 * its cancellation transaction and writes the notifications.
 */
export async function releaseEventReservations(
  tx: TransactionSql,
  eventId: string,
  actor: Actor,
  reason: string,
): Promise<Extract<ReleaseLineOutcome, { ok: true }>[]> {
  const lines = await tx<{ id: string }[]>`
    select id from equipment.equipment_request_lines
    where event_id = ${eventId} and status = 'RESERVED'
    order by seq
  `;
  const released: Extract<ReleaseLineOutcome, { ok: true }>[] = [];
  for (const { id } of lines) {
    const outcome = await releaseLine(tx, id, reason, actor);
    if (outcome.ok) released.push(outcome);
  }
  return released;
}
