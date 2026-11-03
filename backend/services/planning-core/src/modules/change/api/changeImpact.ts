import { Router, type NextFunction, type RequestHandler, type Response } from "express";
import type { Sql } from "postgres";
import { authenticate, type ActorRequest } from "../auth/actor.js";
import { alreadyDecidedMessage } from "../domain/changeRequests.js";
import { previewChangeRequest } from "../repo/changeImpact.js";
import { impactBody } from "./decisions.js";
import { refuse } from "./errors.js";
import { changeRateLimiter } from "./limiter.js";

/**
 * G2 (SPM-31) — before deciding a Pending change request, which arrangements approving it would
 * flag, and why (AC2, AC3), in S3's `impact` shape. The owning organiser and Event Coordinators can
 * see it, as they can the request (S1); anyone else gets the 404 of a request that does not exist.
 * The read runs in a `read only` transaction and locks nothing, so viewing alters no booking,
 * reservation or registration and blocks no decision (AC4). A decided request has no preview: it
 * answers S2's 409, naming the decision.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function notFound(res: Response) {
  refuse(res, 404, "CHANGE_REQUEST_NOT_FOUND", "No change request with that id exists.");
}

export function changeImpactRouter(sql: Sql, limiter: RequestHandler = changeRateLimiter()) {
  const router = Router();

  router.get("/api/v1/change-requests/:id/impact", limiter, authenticate, async (req: ActorRequest, res: Response, next: NextFunction) => {
    try {
      const requestId = req.params.id!;
      if (!UUID.test(requestId)) return notFound(res);
      const actor = req.actor!;

      const outcome = await sql.begin("read only", (tx) => previewChangeRequest(tx, requestId, actor));

      if (outcome.ok) return void res.status(200).json({ impact: impactBody(outcome.impact) });
      switch (outcome.code) {
        case "NOT_FOUND":
          return notFound(res);
        case "ALREADY_DECIDED":
          return void refuse(
            res,
            409,
            "CHANGE_REQUEST_ALREADY_DECIDED",
            alreadyDecidedMessage(outcome.status, outcome.decidedAt),
            undefined,
            { status: outcome.status, decidedAt: outcome.decidedAt }
          );
        default: {
          const unreachable: never = outcome;
          throw new Error(`Unhandled preview outcome ${JSON.stringify(unreachable)}`);
        }
      }
    } catch (error) {
      next(error);
    }
  });

  return router;
}
