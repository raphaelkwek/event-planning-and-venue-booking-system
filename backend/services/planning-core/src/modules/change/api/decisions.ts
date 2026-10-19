import { Router, type NextFunction, type RequestHandler, type Response } from "express";
import type { Sql } from "postgres";
import { authenticate, requireRole, type ActorRequest } from "../auth/actor.js";
import { alreadyDecidedMessage, validateDecisionBody } from "../domain/changeRequests.js";
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
        return void res.status(200).json({ changeRequest: outcome.request, ...(outcome.event ? { event: outcome.event } : {}) });
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
