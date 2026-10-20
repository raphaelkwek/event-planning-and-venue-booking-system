import { Router, type NextFunction, type RequestHandler, type Response } from "express";
import type { Sql } from "postgres";
import { authenticate, requireRole, type ActorRequest } from "../auth/actor.js";
import { ARRANGEMENTS_UNAVAILABLE_MESSAGE, NOT_ASSIGNED_MESSAGE } from "../domain/readiness.js";
import { ArrangementsUnavailableError, confirmArrangements } from "../repo/confirmArrangements.js";
import { logger } from "../../../shared/logger.js";
import { refuse } from "./errors.js";
import { changeRateLimiter } from "./limiter.js";

/**
 * F5 — the assigned coordinator confirms that the venue and equipment are
 * arranged, which moves the event to Safety Review (CR-06). No body: the
 * readiness is read from the bookings and reservations themselves, never sent
 * by the client and never stored (AC4).
 */
const COORDINATOR = "EVENT_COORDINATOR";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PATH = "/api/v1/events/:id/confirmation";

function notFound(res: Response) {
  refuse(res, 404, "EVENT_NOT_FOUND", "No event with that reference is available to you.");
}

export function confirmationsRouter(sql: Sql, limiter: RequestHandler = changeRateLimiter()) {
  const router = Router();

  router.post(PATH, limiter, authenticate, requireRole(COORDINATOR), async (req: ActorRequest, res: Response, next: NextFunction) => {
    try {
      const eventId = req.params.id!;
      if (!UUID.test(eventId)) return notFound(res);
      const correlationId = req.header("x-correlation-id") ?? null;

      let outcome;
      try {
        outcome = await sql.begin((tx) => confirmArrangements(tx, eventId, { ...req.actor!, correlationId }));
      } catch (error) {
        if (!(error instanceof ArrangementsUnavailableError)) throw error;
        // AC5 — the transaction rolled back, so nothing was changed.
        logger.warn("F5 arrangements could not be read", { correlationId, cause: String(error.cause) });
        return void refuse(res, 503, "ARRANGEMENTS_UNAVAILABLE", ARRANGEMENTS_UNAVAILABLE_MESSAGE);
      }

      if (outcome.ok) return void res.status(200).json({ event: outcome.event });
      switch (outcome.code) {
        case "NOT_FOUND":
          return notFound(res);
        case "NOT_ASSIGNED":
          return void refuse(res, 403, "ROLE_NOT_AUTHORISED", NOT_ASSIGNED_MESSAGE);
        case "STATUS_NOT_PERMITTED":
          return void refuse(res, 409, "STATUS_TRANSITION_NOT_PERMITTED", outcome.message);
        case "NOT_READY":
          return void refuse(res, 422, "ARRANGEMENTS_NOT_READY", outcome.message, undefined, {
            venue: outcome.venue,
            equipment: outcome.equipment,
            flags: outcome.flags,
          });
        default: {
          const unreachable: never = outcome;
          throw new Error(`Unhandled confirmation outcome ${JSON.stringify(unreachable)}`);
        }
      }
    } catch (error) {
      next(error);
    }
  });

  return router;
}
