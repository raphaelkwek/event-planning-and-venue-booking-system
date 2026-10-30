import { Router, type Response } from "express";
import type { Sql } from "postgres";
import { KAFKA_TOPICS } from "@connectsphere/contracts";
import { authenticate, requireRole, type ActorRequest } from "../auth/actor.js";
import { REASSIGNMENT_RETIRED } from "../domain/assignment.js";
import { findEventInScope } from "../repo/events.js";
import {
  closeActiveAssignment,
  findActiveAssignment,
  findPendingProposal,
  insertAssignment,
  listProposals,
  resolveProposalAccept,
  resolveProposalDecline,
} from "../repo/assignments.js";
import { writeOutbox } from "../events/outbox.js";
import { refuse } from "./errors.js";

/**
 * E2 — the nominee's accept/decline of a reassignment proposal made before E4
 * retired proposing (the Lead reassigns, api/leadAssignments.ts). This only
 * ever acts on an assignment that already exists.
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

  // E4 retires E2's peer flow (W9-FX-5, W9-59): only the Lead reassigns. A
  // proposal made before the retirement may still be accepted or declined below.
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
    async (req: ActorRequest, res) => {
      await respondToProposal(req, res, sql, "ACCEPTED");
    }
  );

  router.post(
    "/api/v1/events/:id/reassignment-proposals/decline",
    ...authenticate,
    requireRole("EVENT_COORDINATOR"),
    async (req: ActorRequest, res) => {
      await respondToProposal(req, res, sql, "DECLINED");
    }
  );

  /**
   * E2 accept/decline share a shape: find the event, find the caller's own
   * pending proposal for it, resolve it conditionally so a race with the
   * other outcome (or a second accept) cannot both win, then react.
   */
  async function respondToProposal(
    req: ActorRequest,
    res: Response,
    sql: Sql,
    outcome: "ACCEPTED" | "DECLINED"
  ) {
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
      const resolved =
        outcome === "ACCEPTED"
          ? await resolveProposalAccept(tx, { proposalId: pending.id, nomineeId: userId })
          : await resolveProposalDecline(tx, { proposalId: pending.id, nomineeId: userId });

      if (!resolved) return null;

      if (outcome === "ACCEPTED") {
        // E2 accept — the outgoing assignment is closed and a new active
        // assignment is created for the nominee, in the same transaction.
        const active = await findActiveAssignment(tx, event.id);
        if (active) {
          await closeActiveAssignment(tx, active.id, userId);
        }
        await insertAssignment(tx, event.id, resolved.nomineeCoordinatorId, "REASSIGNMENT_ACCEPTED", userId);
      }

      await writeOutbox(tx, {
        topic: KAFKA_TOPICS.event,
        messageType: outcome === "ACCEPTED" ? "event.reassignment-accepted" : "event.reassignment-declined",
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
      // Lost a race with the other outcome — nothing for this caller to act on.
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
