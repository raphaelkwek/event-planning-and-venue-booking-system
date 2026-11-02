import { Router, type Response } from "express";
import type { Sql } from "postgres";
import { KAFKA_TOPICS } from "@connectsphere/contracts";
import { authenticate, requireRole, type ActorRequest } from "../auth/actor.js";
import { REASSIGNMENT_ACCEPT_RETIRED, REASSIGNMENT_RETIRED } from "../domain/assignment.js";
import { findEventInScope } from "../repo/events.js";
import { findPendingProposal, listProposals, resolveProposalDecline } from "../repo/assignments.js";
import { writeOutbox } from "../events/outbox.js";
import { refuse } from "./errors.js";

/**
 * E2 — retired by E4 (W9-FX-5, W9-59): the Lead alone reassigns
 * (api/leadAssignments.ts). Proposing and accepting are refused with 410; a
 * proposal still pending at the retirement is closed by migration event/0020, so
 * nothing is left to accept. The history stays readable, and declining a
 * proposal changes no assignment.
 */
export function reassignmentsRouter(sql: Sql) {
  const router = Router();

  router.get(
    "/api/v1/events/:id/reassignment-proposals",
    ...authenticate,
    async (req: ActorRequest, res) => {
      const { userId, scope } = req.actor!;
      const event = await findEventInScope(sql, req.params.id, scope, userId);
      if (!event) {
        refuse(res, 404, "EVENT_NOT_FOUND", "No event with that reference is available to you.");
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

  router.post(
    "/api/v1/events/:id/reassignment-proposals/decline",
    ...authenticate,
    requireRole("EVENT_COORDINATOR"),
    async (req: ActorRequest, res) => {
      await declineProposal(req, res, sql);
    }
  );

  /**
   * E2 decline: find the event, find the caller's own pending proposal for it, and
   * resolve it conditionally so a second decline cannot also win. No proposal can
   * be pending since migration event/0020 closed them, so this answers 404.
   */
  async function declineProposal(req: ActorRequest, res: Response, sql: Sql) {
    const { userId, role, scope } = req.actor!;
    const event = await findEventInScope(sql, req.params.id, scope, userId);
    if (!event) {
      refuse(res, 404, "EVENT_NOT_FOUND", "No event with that reference is available to you.");
      return;
    }

    const pending = await findPendingProposal(sql, event.id);
    if (!pending || pending.nomineeCoordinatorId !== userId) {
      refuse(
        res,
        404,
        "REASSIGNMENT_PROPOSAL_NOT_FOUND",
        "You have no pending reassignment proposal for this event."
      );
      return;
    }

    const result = await sql.begin(async (tx) => {
      const resolved = await resolveProposalDecline(tx, { proposalId: pending.id, nomineeId: userId });
      if (!resolved) return null;

      await writeOutbox(tx, {
        topic: KAFKA_TOPICS.event,
        messageType: "event.reassignment-declined",
        aggregateId: event.id,
        actor: { userId, role },
        correlationId: req.header("x-correlation-id") ?? null,
        payload: {
          eventId: event.id,
          eventReference: event.reference!,
          eventName: event.name,
          proposalId: resolved.id,
          outgoingCoordinatorId: resolved.outgoingCoordinatorId,
          nomineeCoordinatorId: resolved.nomineeCoordinatorId,
          resolvedAt: resolved.resolvedAt!,
        },
      });

      return resolved;
    });

    if (!result) {
      // Lost a race with another decline or the Lead's reassignment: nothing for this caller to act on.
      refuse(
        res,
        404,
        "REASSIGNMENT_PROPOSAL_NOT_FOUND",
        "You have no pending reassignment proposal for this event."
      );
      return;
    }

    res.status(200).json(result);
  }

  return router;
}
