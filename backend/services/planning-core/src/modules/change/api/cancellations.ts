import { Router, type NextFunction, type RequestHandler, type Response } from "express";
import type { Sql } from "postgres";
import { authenticate, requireRole, type ActorRequest } from "../auth/actor.js";
import { CANCELLATION_FAILED_MESSAGE, NOT_PERMITTED_TO_CANCEL_MESSAGE, validateCancellationBody } from "../domain/cancellation.js";
import { cancelEvent } from "../repo/cancelEvent.js";
import { logger } from "../../../shared/logger.js";
import { refuse } from "./errors.js";
import { changeRateLimiter } from "./limiter.js";

/**
 * F3 — the owning organiser or the assigned coordinator cancels an event, with
 * a reason, and F4 releases what it holds. The whole cancellation is one
 * transaction: if any part fails, the event keeps its status and nothing is
 * released (F4 AC5).
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PATH = "/api/v1/events/:id/cancellation";

function notFound(res: Response) {
  refuse(res, 404, "EVENT_NOT_FOUND", "No event with that reference is available to you.");
}

export function cancellationsRouter(sql: Sql, limiter: RequestHandler = changeRateLimiter()) {
  const router = Router();

  router.post(
    PATH,
    limiter,
    authenticate,
    requireRole("EVENT_ORGANISER", "EVENT_COORDINATOR"),
    async (req: ActorRequest, res: Response, next: NextFunction) => {
      try {
        const eventId = req.params.id!;
        if (!UUID.test(eventId)) return notFound(res);
        // AC2 — checked before any transaction, so without a reason nothing is changed.
        const body = validateCancellationBody(req.body);
        if (!body.ok) {
          return void refuse(res, 400, "VALIDATION_FAILED", "The event could not be cancelled. Check the highlighted fields.", body.fields);
        }
        const correlationId = req.header("x-correlation-id") ?? null;

        let outcome;
        try {
          outcome = await sql.begin((tx) => cancelEvent(tx, eventId, body.reason, { ...req.actor!, correlationId }));
        } catch (error) {
          // F4 AC5 — the transaction rolled back, so the event keeps its status and nothing was released.
          logger.error("F3 cancellation failed and was rolled back", { correlationId, eventId, cause: String(error) });
          return void refuse(res, 500, "CANCELLATION_FAILED", CANCELLATION_FAILED_MESSAGE);
        }

        if (outcome.ok) {
          return void res
            .status(200)
            .json({ event: outcome.event, closedChangeRequest: outcome.closedChangeRequest, released: outcome.released });
        }
        switch (outcome.code) {
          case "NOT_FOUND":
            return notFound(res);
          case "NOT_PERMITTED":
            return void refuse(res, 403, "ROLE_NOT_AUTHORISED", NOT_PERMITTED_TO_CANCEL_MESSAGE);
          case "STATUS_NOT_PERMITTED":
            return void refuse(res, 409, "STATUS_TRANSITION_NOT_PERMITTED", outcome.message);
          default: {
            const unreachable: never = outcome;
            throw new Error(`Unhandled cancellation outcome ${JSON.stringify(unreachable)}`);
          }
        }
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
