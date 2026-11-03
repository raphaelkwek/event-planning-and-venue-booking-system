import { Router } from "express";
import type { Sql } from "postgres";
import { authenticate, requireRole, type ActorRequest } from "../auth/actor.js";
import { REASSIGNMENT_ACCEPT_RETIRED, REASSIGNMENT_DECLINE_RETIRED, REASSIGNMENT_RETIRED } from "../domain/assignment.js";
import { findEventInScope } from "../repo/events.js";
import { listProposals } from "../repo/assignments.js";
import { eventNotFound, refuse } from "./errors.js";

/**
 * E2 — retired by E4 (W9-FX-5, W9-59): the Lead alone reassigns
 * (api/leadAssignments.ts). Proposing, accepting and declining are refused with
 * 410; a proposal still pending at the retirement is closed by migration
 * event/0020, so nothing is left to answer. The history stays readable, in the
 * caller's A4 scope.
 */
export function reassignmentsRouter(sql: Sql) {
  const router = Router();

  router.get(
    "/api/v1/events/:id/reassignment-proposals",
    ...authenticate,
    async (req: ActorRequest, res) => {
      const { userId, role, scope } = req.actor!;
      const event = await findEventInScope(sql, req.params.id, scope, userId);
      if (!event) {
        eventNotFound(res, role);
        return;
      }

      res.status(200).json({ items: await listProposals(sql, event.id), nextCursor: null });
    }
  );

  // E4 retires E2's peer flow (W9-FX-5, W9-59): only the Lead reassigns.
  router.post(
    "/api/v1/events/:id/reassignment-proposals",
    ...authenticate,
    requireRole("EVENT_COORDINATOR"),
    (_req: ActorRequest, res) => {
      refuse(res, 410, "REASSIGNMENT_RETIRED", REASSIGNMENT_RETIRED);
    }
  );

  router.post(
    "/api/v1/events/:id/reassignment-proposals/accept",
    ...authenticate,
    requireRole("EVENT_COORDINATOR"),
    (_req: ActorRequest, res) => {
      refuse(res, 410, "REASSIGNMENT_RETIRED", REASSIGNMENT_ACCEPT_RETIRED);
    }
  );

  // The decline is retired with them: event/0020 closed every pending proposal, so none is left to answer.
  router.post(
    "/api/v1/events/:id/reassignment-proposals/decline",
    ...authenticate,
    requireRole("EVENT_COORDINATOR"),
    (_req: ActorRequest, res) => {
      refuse(res, 410, "REASSIGNMENT_RETIRED", REASSIGNMENT_DECLINE_RETIRED);
    }
  );

  return router;
}
