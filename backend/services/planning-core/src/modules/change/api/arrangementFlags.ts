import { Router, type NextFunction, type RequestHandler, type Response } from "express";
import type { Sql } from "postgres";
import { findEventForChange } from "../../event/index.js";
import { resolveAccessScope } from "../../identity/index.js";
import { outstandingReservationFlags, type OutstandingReservationFlag } from "../../equipment/index.js";
import { outstandingBookingFlags, type OutstandingBookingFlag } from "../../venue/index.js";
import { authenticate, type ActorRequest } from "../auth/actor.js";
import { refuse } from "./errors.js";
import { changeRateLimiter } from "./limiter.js";

/**
 * S3 (AC8) — every flag still outstanding on an event, for the event's owner, its assigned
 * coordinator and Event Coordinators. The A3 scope rule does the rest: an organiser who does not
 * own the event, and every other role, gets the same 404 as for an event that does not exist.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ArrangementFlagEntry {
  arrangement: "BOOKING" | "EQUIPMENT";
  id: string;
  reference: string;
  name: string;
  flag: string;
  reason: string;
  flaggedAt: string;
}

/** Booking flags first, then equipment, each in the order read. A reservation's reference is its id. */
export function flagsBody(
  bookings: readonly OutstandingBookingFlag[],
  reservations: readonly OutstandingReservationFlag[]
): { flags: ArrangementFlagEntry[] } {
  return {
    flags: [
      ...bookings.map((b): ArrangementFlagEntry => ({
        arrangement: "BOOKING",
        id: b.bookingId,
        reference: b.reference,
        name: b.venueName,
        flag: b.flag,
        reason: b.reason,
        flaggedAt: b.flaggedAt,
      })),
      ...reservations.map((r): ArrangementFlagEntry => ({
        arrangement: "EQUIPMENT",
        id: r.reservationId,
        reference: r.reservationId,
        name: r.equipmentTypeName,
        flag: r.flag,
        reason: r.reason,
        flaggedAt: r.flaggedAt,
      })),
    ],
  };
}

export function arrangementFlagsRouter(sql: Sql, limiter: RequestHandler = changeRateLimiter()) {
  const router = Router();

  router.get(
    "/api/v1/events/:id/arrangement-flags",
    limiter,
    authenticate,
    async (req: ActorRequest, res: Response, next: NextFunction) => {
      try {
        const id = req.params.id!;
        const actor = req.actor!;
        const scope = resolveAccessScope(actor.role, actor.userId, "events");
        const event = UUID.test(id) ? await findEventForChange(sql, id, scope, actor.userId) : null;
        if (!event) return void refuse(res, 404, "EVENT_NOT_FOUND", "No event with that id exists.");
        const [bookings, reservations] = await Promise.all([
          outstandingBookingFlags(sql, event.id),
          outstandingReservationFlags(sql, event.id),
        ]);
        res.json(flagsBody(bookings, reservations));
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
