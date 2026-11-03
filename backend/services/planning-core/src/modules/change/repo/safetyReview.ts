import { randomUUID } from "node:crypto";
import type { Sql, TransactionSql } from "postgres";
import type { EventStatus, Role } from "@connectsphere/contracts";
import {
  currentReviewStartedAt,
  decisionForReview,
  findEventForChange,
  findEventForPlanning,
  markEventConfirmed,
  recordSafetyDecision,
  safetyDecisionRefusal,
  type SafetyDecisionRecord,
} from "../../event/index.js";
import { equipmentSafetyFactors, flagReservations, outstandingReservationFlags, reservationsForImpact, type EquipmentSafetyFactor } from "../../equipment/index.js";
import { bookingsForImpact, flagBookings, outstandingBookingFlags, venueSafetyFactors, type VenueSafetyFactor } from "../../venue/index.js";
import { resolveAccessScope } from "../../identity/index.js";
import {
  flagReason,
  outstandingFlagsMessage,
  unknownArrangements,
  UNKNOWN_ARRANGEMENT_MESSAGE,
  type OutstandingFlag,
  type SafetyDecisionBody,
} from "../domain/safetyReview.js";

/**
 * U1 (CR-06) — the Safety Officer's review and decision, and the coordinator's Mark Confirmed. Both
 * writes run in one core transaction (implementation.md §4.7, ADR-0004):
 *
 * 1. Lock the event row (`for update`).
 * 2. Refuse what the event's status, an earlier decision or an outstanding flag forbids, before
 *    anything is written (a refusal leaves nothing behind).
 * 3. A request for changes flags the arrangements it names, through the venue and equipment
 *    modules (S3's machinery), then the event module applies F1's transition, records the decision
 *    and writes its message.
 *
 * The Safety Officer reaches events through this module only, with no events scope of their own
 * (A3): the role gate is the router's, and the lookup here is deliberately unscoped.
 */

const ALL = { scopeType: "ALL" } as const;

const ARRANGEMENT_WORDS = { BOOKING: "booking", HOLD: "hold", BOOKING_REQUEST: "booking request" } as const;

/** Every flag that would hold back confirmation on the event's live arrangements (S3, I2, H3). */
export async function outstandingFlags(db: Sql | TransactionSql, eventId: string): Promise<OutstandingFlag[]> {
  const [bookings, reservations] = await Promise.all([outstandingBookingFlags(db, eventId), outstandingReservationFlags(db, eventId)]);
  return [
    ...bookings.map((b): OutstandingFlag => ({ what: ARRANGEMENT_WORDS[b.arrangement], name: `${b.reference} at ${b.venueName}`, flag: b.flag })),
    ...reservations.map((r): OutstandingFlag => ({ what: "equipment", name: r.equipmentTypeName, flag: r.flag })),
  ];
}

export type DecideOutcome =
  | { ok: true; eventId: string; reference: string | null; status: EventStatus; previousStatus: EventStatus; decision: SafetyDecisionRecord }
  | { ok: false; code: "NOT_FOUND" }
  | { ok: false; code: "STATUS_NOT_PERMITTED" | "ALREADY_RECORDED" | "FLAGS_OUTSTANDING" | "UNKNOWN_ARRANGEMENT"; message: string; flags?: OutstandingFlag[] };

export async function decide(
  tx: TransactionSql,
  eventId: string,
  actor: { userId: string; role: Role; correlationId?: string | null },
  body: SafetyDecisionBody
): Promise<DecideOutcome> {
  const event = await findEventForChange(tx, eventId, ALL, actor.userId, { lock: "update" });
  if (!event) return { ok: false, code: "NOT_FOUND" };

  const statusRefusal = safetyDecisionRefusal(event.status);
  if (statusRefusal) return { ok: false, code: "STATUS_NOT_PERMITTED", message: statusRefusal };

  const startedAt = await currentReviewStartedAt(tx, event.id);
  if (startedAt && (await decisionForReview(tx, event.id, startedAt))) {
    return { ok: false, code: "ALREADY_RECORDED", message: "A safety decision has already been recorded for this review." };
  }

  if (body.decision === "APPROVE") {
    const flags = await outstandingFlags(tx, event.id);
    const message = outstandingFlagsMessage(flags);
    if (message) return { ok: false, code: "FLAGS_OUTSTANDING", message, flags };
  }

  const id = randomUUID();
  const flaggedReferences = { bookings: [] as string[], equipment: [] as string[] };
  if (body.decision === "REQUEST_CHANGES" && (body.bookingIds.length > 0 || body.reservationIds.length > 0)) {
    const [bookings, reservations] = await Promise.all([bookingsForImpact(tx, event.id), reservationsForImpact(tx, event.id)]);
    const unknown = [
      ...unknownArrangements(body.bookingIds, bookings.map((b) => b.id)),
      ...unknownArrangements(body.reservationIds, reservations.map((r) => r.id)),
    ];
    if (unknown.length > 0) return { ok: false, code: "UNKNOWN_ARRANGEMENT", message: UNKNOWN_ARRANGEMENT_MESSAGE };

    const reason = flagReason(body.reason!);
    const details = { source: "SAFETY_REVIEW", safetyDecisionId: id };
    const namedBookings = bookings.filter((b) => body.bookingIds.includes(b.id));
    const namedReservations = reservations.filter((r) => body.reservationIds.includes(r.id));
    // The safety decision's id stands where S3 records the change request that set a flag (no foreign key).
    await flagBookings(tx, event.id, id, namedBookings.map((b) => ({ bookingId: b.id, arrangement: b.arrangement, flag: "REQUIRES_RECONFIRMATION" as const, reason, details })));
    await flagReservations(tx, event.id, id, namedReservations.map((r) => ({ reservationId: r.id, flag: "FLAGGED_FOR_REVIEW" as const, reason, details })));
    flaggedReferences.bookings = namedBookings.map((b) => b.reference);
    flaggedReferences.equipment = namedReservations.map((r) => `${r.equipmentTypeName} × ${r.reservedQuantity}`);
  }

  const recorded = await recordSafetyDecision(tx, event.id, actor, {
    id,
    decision: body.decision,
    reason: body.reason,
    flagged: { bookings: body.bookingIds, reservations: body.reservationIds },
    flaggedBookingReferences: flaggedReferences.bookings,
    flaggedEquipment: flaggedReferences.equipment,
  });
  // The event is locked and its status and review were checked above, so this cannot be refused;
  // throwing rolls back any flags set.
  if (!recorded.ok) throw new Error(`U1 decision refused under lock: ${recorded.message}`);
  return { ok: true, eventId: event.id, reference: event.reference, status: recorded.status, previousStatus: recorded.previousStatus, decision: recorded.decision };
}

export type MarkConfirmedResult =
  | { ok: true; eventId: string; reference: string | null; status: EventStatus; previousStatus: EventStatus; confirmedAt: string }
  | { ok: false; code: "NOT_FOUND" }
  | { ok: false; code: "STATUS_NOT_PERMITTED" | "SAFETY_CHECK_NOT_PASSED" | "FLAGS_OUTSTANDING"; message: string; flags?: OutstandingFlag[] };

/**
 * The assigned coordinator marks the event Confirmed (the Week 9 answer to U1 AC4): refused unless
 * the event is in Safety Review with an approved current review and no arrangement flag outstanding.
 * Assignment is checked as F5 checks it: a coordinator's scope is the events assigned to them (A4),
 * re-read under the row lock, so another coordinator's event is not found.
 */
export async function markConfirmed(
  tx: TransactionSql,
  eventId: string,
  actor: { userId: string; role: Role; correlationId?: string | null }
): Promise<MarkConfirmedResult> {
  const scope = resolveAccessScope(actor.role, actor.userId, "events");
  const event = await findEventForChange(tx, eventId, scope, actor.userId, { lock: "update" });
  if (!event) return { ok: false, code: "NOT_FOUND" };

  if (event.status === "SAFETY_REVIEW") {
    const startedAt = await currentReviewStartedAt(tx, event.id);
    const decision = startedAt ? await decisionForReview(tx, event.id, startedAt) : null;
    if (decision?.decision === "APPROVE") {
      const flags = await outstandingFlags(tx, event.id);
      const message = outstandingFlagsMessage(flags);
      if (message) return { ok: false, code: "FLAGS_OUTSTANDING", message, flags };
    }
  }

  const moved = await markEventConfirmed(tx, event.id, event.status, actor);
  if (!moved.ok) return moved;
  return { ok: true, eventId: event.id, reference: event.reference, status: moved.status, previousStatus: moved.previousStatus, confirmedAt: moved.confirmedAt };
}

export interface SafetyReviewView {
  event: {
    id: string;
    reference: string | null;
    name: string;
    status: EventStatus;
    assignedCoordinatorId: string | null;
    proposedStartAt: string | null;
    proposedEndAt: string | null;
  };
  factors: {
    expectedAttendance: number | null;
    accessibilityNeeds: string | null;
    venues: VenueSafetyFactor[];
    equipment: EquipmentSafetyFactor[];
  };
  flags: OutstandingFlag[];
  /** The decision recorded for this review, or null when none is yet. */
  decision: SafetyDecisionRecord | null;
}

export type ReviewOutcome =
  | { ok: true; review: SafetyReviewView }
  | { ok: false; code: "NOT_FOUND" }
  | { ok: false; code: "STATUS_NOT_PERMITTED"; message: string };

/** The factors the Safety Officer weighs for one event in Safety Review. Read only. */
export async function reviewFor(sql: Sql, eventId: string, userId: string): Promise<ReviewOutcome> {
  const event = await findEventForPlanning(sql, eventId, ALL, userId);
  if (!event) return { ok: false, code: "NOT_FOUND" };
  const statusRefusal = safetyDecisionRefusal(event.status);
  if (statusRefusal) return { ok: false, code: "STATUS_NOT_PERMITTED", message: statusRefusal };

  const startedAt = await currentReviewStartedAt(sql, event.id);
  const [venues, equipment, flags, decision] = await Promise.all([
    venueSafetyFactors(sql, event.id),
    equipmentSafetyFactors(sql, event.id),
    outstandingFlags(sql, event.id),
    startedAt ? decisionForReview(sql, event.id, startedAt) : Promise.resolve(null),
  ]);
  return {
    ok: true,
    review: {
      event: {
        id: event.id,
        reference: event.reference,
        name: event.name,
        status: event.status,
        assignedCoordinatorId: event.assignedCoordinatorId,
        proposedStartAt: event.proposedStartAt,
        proposedEndAt: event.proposedEndAt,
      },
      factors: { expectedAttendance: event.expectedAttendance, accessibilityNeeds: event.accessibilityNeeds, venues, equipment },
      flags,
      decision,
    },
  };
}
