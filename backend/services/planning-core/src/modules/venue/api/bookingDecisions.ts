import { Router, type NextFunction, type Response } from "express";
import type { Sql } from "postgres";
import { findEventForPlanning, findEventReferences, type EventPlanningView } from "../../event/index.js";
import { authenticate, requireRole, type ActorRequest } from "../auth/actor.js";
import { layoutCapacityAt, notPendingMessage } from "../domain/bookingRequest.js";
import { bookingConflictMessage, NOT_VENUE_STAFF, readRejection, unavailableMessage } from "../domain/bookingDecision.js";
import { VenueSlotConflictError } from "../domain/slotConflict.js";
import { writeVenueOutbox } from "../events/outbox.js";
import {
  activeBlocksOverlapping,
  approveBookingRequest,
  bookingsOverlapping,
  isVenueStaff,
  rejectBookingRequest,
  releaseReplacedBooking,
  type OverlappingBooking,
} from "../repo/bookingDecisions.js";
import { carryRequestFlagsToBooking } from "../repo/arrangementFlags.js";
import { findBookingRequest, lockBookingRequest, type BookingRequest } from "../repo/bookingRequests.js";
import { confirmHeldSlotForRequest, HeldSlotNotHeldError, releaseHeldSlotForRequest } from "../repo/holds.js";
import { insertVenueSlot } from "../repo/slots.js";
import { lockVenue } from "../repo/venues.js";
import { BASE, bookingRequestRateLimit, present, requestNotFound, UUID } from "./bookingRequests.js";
import { refuse } from "./errors.js";

/**
 * M1 — the venue's Venue Staff approve a pending request: the booking is
 * confirmed in venue_slots, unless its period now overlaps a confirmed booking
 * or recorded unavailability, and the request records who approved it and when.
 * M2 — they reject it instead, with a reason and any suggested alternative.
 *
 * The exclusion constraint decides overlaps (N1, ADR-0006). The request's row
 * lock serialises decisions on one request; the venue row lock serialises
 * approvals at one venue, and I2's blocks, so the block check can't go stale.
 */

/** The requests' events are read whatever the caller's event scope: deciding is scoped by venue (A3, venue_bookings). */
const ALL_EVENTS = { scopeType: "ALL" } as const;
const INVALID_REJECTION = "The request could not be rejected. Check the highlighted fields.";

/** The approval's booking overlapped another; thrown so the transaction rolls back CR-02's release. */
class ApprovalOverlapError extends Error {
  constructor(readonly conflicts: readonly OverlappingBooking[]) {
    super("The approval's booking overlaps another.");
    this.name = "ApprovalOverlapError";
  }
}

/**
 * EN-13: what the registration service builds seats from, read from the venue's own layouts inside
 * the approval's transaction. Left out when the venue no longer offers the layout, so no seats are built from a guess.
 */
function seatBasis(layouts: readonly { name: string; capacity: number }[], layout: string) {
  const capacity = layoutCapacityAt(layouts, layout);
  return capacity === null ? {} : { layout, layoutCapacity: capacity };
}

/** What both decision messages carry: the request, its event, and the coordinator and owner to tell. */
function decided(request: BookingRequest, event: EventPlanningView) {
  return {
    bookingRequestId: request.id,
    reference: request.reference,
    eventId: event.id,
    eventReference: event.reference,
    eventName: event.name,
    venueId: request.venueId,
    venueName: request.venueName,
    startsAt: request.startsAt,
    endsAt: request.endsAt,
    coordinatorId: request.requestedBy,
    ownerId: event.ownerId,
    decidedBy: request.decidedBy,
    decidedAt: request.decidedAt,
  };
}

/**
 * The request and its event, when the caller is one of the venue's Venue Staff;
 * otherwise the refusal is sent and the result is null.
 */
async function decidable(sql: Sql, req: ActorRequest, res: Response): Promise<{ request: BookingRequest; event: EventPlanningView } | null> {
  const id = req.params.id!;
  const request = UUID.test(id) ? await findBookingRequest(sql, id) : null;
  if (!request) {
    requestNotFound(res);
    return null;
  }
  if (!(await isVenueStaff(sql, request.venueId, req.actor!.userId))) {
    refuse(res, 403, "ROLE_NOT_AUTHORISED", NOT_VENUE_STAFF);
    return null;
  }
  const event = await findEventForPlanning(sql, request.eventId, ALL_EVENTS, req.actor!.userId);
  if (!event) {
    requestNotFound(res);
    return null;
  }
  return { request, event };
}

export function bookingDecisionsRouter(sql: Sql) {
  const router = Router();
  const limiter = bookingRequestRateLimit();

  // M1: approve, confirming the booking.
  router.post(`${BASE}/:id/approve`, limiter, authenticate, requireRole("VENUE_STAFF"), async (req: ActorRequest, res: Response, next: NextFunction) => {
    try {
      const found = await decidable(sql, req, res);
      if (!found) return;
      const { request, event } = found;
      const actor = req.actor!;
      const startsAt = new Date(request.startsAt);
      const endsAt = new Date(request.endsAt);

      const outcome = await sql
        .begin(async (tx) => {
          // The venue first, then the request: the order I2 takes them in when a block
          // flags a pending request (implementation.md §4.6, rule 1). The other order
          // deadlocks against a block recorded at the same moment.
          // H3 (CR-01): the booking copies the venue's setup and turnaround time as it stands now.
          const lockedVenue = (await lockVenue(tx, request.venueId))!;
          const { setupMinutes, turnaroundMinutes } = lockedVenue;
          const locked = (await lockBookingRequest(tx, request.id))!;
          if (locked.status !== "PENDING") return { code: "NOT_PENDING", locked } as const;
          const blocks = await activeBlocksOverlapping(tx, locked.venueId, startsAt, endsAt, setupMinutes, turnaroundMinutes);
          if (blocks.length > 0) return { code: "UNAVAILABLE", blocks } as const;

          // CR-02: release the disrupted booking first, so a replacement at the same venue can take its period.
          const replacedBookingId =
            locked.replacesBookingId && (await releaseReplacedBooking(tx, locked.replacesBookingId, actor.userId)) ? locked.replacesBookingId : null;
          // L3: a request converted from a hold confirms the period the hold took,
          // rather than releasing it and inserting another (implementation.md §4.6, rule 3).
          let bookingId = await confirmHeldSlotForRequest(tx, locked.id, actor.userId).catch((error: unknown) => {
            if (error instanceof HeldSlotNotHeldError) return null;
            throw error;
          });
          if (!bookingId) {
            try {
              const booking = await insertVenueSlot(tx, {
                venueId: locked.venueId,
                eventId: locked.eventId,
                reference: locked.reference,
                startsAt,
                endsAt,
                setupMinutes,
                turnaroundMinutes,
                status: "CONFIRMED",
                actorUserId: actor.userId,
              });
              bookingId = booking.id;
            } catch (error) {
              if (!(error instanceof VenueSlotConflictError)) throw error;
              throw new ApprovalOverlapError(await bookingsOverlapping(tx, locked.venueId, startsAt, endsAt, setupMinutes, turnaroundMinutes));
            }
          }

          // S3: a request flagged by an approved change keeps its flags as a confirmed booking,
          // so F5 still refuses until the coordinator re-arranges it.
          await carryRequestFlagsToBooking(tx, locked.id, bookingId);
          await approveBookingRequest(tx, locked.id, actor.userId, bookingId);
          const approved = (await findBookingRequest(tx, locked.id))!;
          await writeVenueOutbox(tx, {
            messageType: "venue-booking.request-approved",
            aggregateId: approved.id,
            actor,
            correlationId: req.header("x-correlation-id") ?? null,
            payload: { ...decided(approved, event), bookingId, replacedBookingId, ...seatBasis(lockedVenue.layouts, approved.layout) },
          });
          return { code: "APPROVED", approved } as const;
        })
        .catch((error: unknown) => {
          if (error instanceof ApprovalOverlapError) return { code: "OVERLAP", conflicts: error.conflicts } as const;
          throw error;
        });

      switch (outcome.code) {
        case "NOT_PENDING":
          return refuse(res, 409, "BOOKING_REQUEST_NOT_PENDING", notPendingMessage(request.reference, outcome.locked.status, "approved"));
        case "UNAVAILABLE":
          return refuse(res, 409, "VENUE_UNAVAILABLE", unavailableMessage(request.reference, request.venueName, outcome.blocks));
        case "OVERLAP": {
          const references = await findEventReferences(sql, [...new Set(outcome.conflicts.map((c) => c.eventId))]);
          const conflicts = outcome.conflicts.map((c) => ({ ...c, eventReference: references.get(c.eventId) ?? null }));
          return refuse(res, 409, "VENUE_SLOT_CONFLICT", bookingConflictMessage(request.reference, request.venueName, conflicts));
        }
        case "APPROVED":
          return res.json(present(outcome.approved, event.reference));
      }
    } catch (error) {
      next(error);
    }
  });

  // M2: reject, with a reason and any suggested alternative. The venue stays free.
  router.post(`${BASE}/:id/reject`, limiter, authenticate, requireRole("VENUE_STAFF"), async (req: ActorRequest, res: Response, next: NextFunction) => {
    try {
      const found = await decidable(sql, req, res);
      if (!found) return;
      const { request, event } = found;
      const read = readRejection(req.body);
      if (!read.ok) return refuse(res, 400, "VALIDATION_FAILED", INVALID_REJECTION, read.fields);
      const actor = req.actor!;

      const outcome = await sql.begin(async (tx) => {
        const locked = (await lockBookingRequest(tx, request.id))!;
        if (locked.status !== "PENDING") return { code: "NOT_PENDING", locked } as const;
        await rejectBookingRequest(tx, locked.id, actor.userId, read.reason, read.suggestion);
        // L3: a request converted from a hold gives back the period the hold took.
        await releaseHeldSlotForRequest(tx, locked.id, actor.userId);
        const rejected = (await findBookingRequest(tx, locked.id))!;
        await writeVenueOutbox(tx, {
          messageType: "venue-booking.request-rejected",
          aggregateId: rejected.id,
          actor,
          correlationId: req.header("x-correlation-id") ?? null,
          payload: { ...decided(rejected, event), reason: read.reason, suggestion: read.suggestion },
        });
        return { code: "REJECTED", rejected } as const;
      });

      if (outcome.code === "NOT_PENDING") {
        return refuse(res, 409, "BOOKING_REQUEST_NOT_PENDING", notPendingMessage(request.reference, outcome.locked.status, "rejected"));
      }
      res.json(present(outcome.rejected, event.reference));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
