import { Router, type NextFunction, type RequestHandler, type Response } from "express";
import type { Sql } from "postgres";
import { authenticate, requireRole, type ActorRequest } from "../auth/actor.js";
import { alreadyDecidedMessage, validateDecisionBody } from "../domain/changeRequests.js";
import type { AppliedChangeImpact } from "../repo/changeImpact.js";
import { decideChangeRequest } from "../repo/decisions.js";
import { refuse } from "./errors.js";
import { changeRateLimiter } from "./limiter.js";

/**
 * S2 — the assigned coordinator approves (applying the change with field history) or rejects
 * (with a reason) a Pending change request. The body is checked before any transaction opens.
 */
const COORDINATOR = "EVENT_COORDINATOR";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PATH = "/api/v1/change-requests/:id/decision";

/**
 * S3 — what an approval's response says about the arrangements (AC1–AC4): each confirmed booking
 * and reservation, the registration count, and each flag set. Staff ids and who reserved
 * equipment stay out: they are for the notification service, not the screen.
 */
export function impactBody(impact: AppliedChangeImpact) {
  const bookingById = new Map(impact.bookings.map((booking) => [booking.id, booking]));
  const reservationById = new Map(impact.reservations.map((reservation) => [reservation.id, reservation]));
  return {
    bookings: impact.bookings.map(({ id, reference, venueName, startsAt, endsAt }) => ({ id, reference, venueName, startsAt, endsAt })),
    reservations: impact.reservations.map(({ id, equipmentTypeName, reservedQuantity, startsAt, endsAt }) => ({
      id,
      equipmentTypeName,
      reservedQuantity,
      startsAt,
      endsAt,
    })),
    activeRegistrations: impact.activeRegistrations,
    flags: [
      ...impact.bookingFlags.map((flag) => {
        const booking = bookingById.get(flag.bookingId)!;
        return { arrangement: "BOOKING" as const, id: booking.id, reference: booking.reference, name: booking.venueName, flag: flag.flag, reason: flag.reason };
      }),
      ...impact.reservationFlags.map((flag) => {
        const reservation = reservationById.get(flag.reservationId)!;
        return {
          arrangement: "EQUIPMENT" as const,
          id: reservation.id,
          reference: reservation.id,
          name: reservation.equipmentTypeName,
          flag: flag.flag,
          reason: flag.reason,
        };
      }),
    ],
  };
}

function notFound(res: Response) {
  refuse(res, 404, "CHANGE_REQUEST_NOT_FOUND", "No change request with that id exists.");
}

export function decisionsRouter(sql: Sql, limiter: RequestHandler = changeRateLimiter()) {
  const router = Router();

  router.post(PATH, limiter, authenticate, requireRole(COORDINATOR), async (req: ActorRequest, res: Response, next: NextFunction) => {
    try {
      const requestId = req.params.id!;
      if (!UUID.test(requestId)) return notFound(res);
      const actor = req.actor!;

      const body = validateDecisionBody(req.body);
      if (!body.ok) {
        return void refuse(res, 400, "VALIDATION_FAILED", "The decision could not be recorded. Check the highlighted fields.", body.fields);
      }

      const correlationId = req.header("x-correlation-id") ?? null;
      const outcome = await sql.begin((tx) =>
        decideChangeRequest(tx, requestId, body, { ...actor, correlationId })
      );

      if (outcome.ok) {
        return void res.status(200).json({
          changeRequest: outcome.request,
          ...(outcome.event ? { event: outcome.event } : {}),
          ...(outcome.impact ? { impact: impactBody(outcome.impact) } : {}),
        });
      }
      switch (outcome.code) {
        case "NOT_FOUND":
          return notFound(res);
        case "NOT_ASSIGNED":
          return void refuse(res, 403, "ROLE_NOT_AUTHORISED", "Only the event's assigned coordinator can decide this change request.");
        case "ALREADY_DECIDED":
          return void refuse(
            res,
            409,
            "CHANGE_REQUEST_ALREADY_DECIDED",
            alreadyDecidedMessage(outcome.status, outcome.decidedAt),
            undefined,
            { status: outcome.status, decidedAt: outcome.decidedAt }
          );
        case "NO_LONGER_VALID":
          return void refuse(res, 409, "CHANGE_REQUEST_NO_LONGER_VALID", outcome.message, undefined, {
            fields: outcome.fields,
            ...(outcome.status ? { status: outcome.status } : {}),
          });
        default: {
          const unreachable: never = outcome;
          throw new Error(`Unhandled decision outcome ${JSON.stringify(unreachable)}`);
        }
      }
    } catch (error) {
      next(error);
    }
  });

  return router;
}
