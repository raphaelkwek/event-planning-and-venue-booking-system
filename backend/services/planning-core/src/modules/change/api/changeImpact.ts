import { Router, type NextFunction, type RequestHandler, type Response } from "express";
import type { Sql } from "postgres";
import type { Role } from "@connectsphere/contracts";
import { notInScopeMessage } from "../../identity/index.js";
import { authenticate, requireRole, type ActorRequest } from "../auth/actor.js";
import { mayEver, POLICY_UNAVAILABLE_MESSAGE } from "../../../shared/authz/gate.js";
import { PolicyUnavailableError } from "../../../shared/authz/pdp.js";
import { alreadyDecidedMessage } from "../domain/changeRequests.js";
import { previewChangeRequest } from "../repo/changeImpact.js";
import { impactBody } from "./decisions.js";
import { refuse } from "./errors.js";
import { changeRateLimiter } from "./limiter.js";

/**
 * G2 (SPM-31) — before deciding a Pending change request, which arrangements approving it would
 * flag, and why (AC2, AC3), in S3's `impact` shape. The owning organiser and the assigned coordinator
 * (A4: no other coordinator) can see it, as they can the request (S1); anyone else gets the 404 of a
 * request that does not exist.
 * The read runs in a `read only` transaction and locks nothing, so viewing alters no booking,
 * reservation or registration and blocks no decision (AC4). A decided request has no preview: it
 * answers S2's 409, naming the decision.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A4: a coordinator is told the request is not on an event assigned to them. */
function notFound(res: Response, role: Role) {
  refuse(res, 404, "CHANGE_REQUEST_NOT_FOUND", notInScopeMessage(role, "No change request with that id exists.", "change request"));
}

export function changeImpactRouter(sql: Sql, limiter: RequestHandler = changeRateLimiter()) {
  const router = Router();

  router.get("/api/v1/change-requests/:id/impact", limiter, authenticate, requireRole("event", "view"), async (req: ActorRequest, res: Response, next: NextFunction) => {
    try {
      const requestId = req.params.id!;
      if (!UUID.test(requestId)) return notFound(res, req.actor!.role);
      const actor = req.actor!;
      // Who may preview is the policies' (event preview_change_impact: the owner and the assigned
      // coordinator). Asked before the transaction, as no HTTP call runs inside one; any other role
      // gets the 404 of a request that does not exist.
      if (!(await mayEver(actor, "event", "preview_change_impact"))) return notFound(res, actor.role);

      const outcome = await sql.begin("read only", (tx) => previewChangeRequest(tx, requestId, actor));

      if (outcome.ok) return void res.status(200).json({ impact: impactBody(outcome.impact) });
      switch (outcome.code) {
        case "NOT_FOUND":
          return notFound(res, actor.role);
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
      if (error instanceof PolicyUnavailableError) return refuse(res, 503, "POLICY_UNAVAILABLE", POLICY_UNAVAILABLE_MESSAGE);
      next(error);
    }
  });

  return router;
}
