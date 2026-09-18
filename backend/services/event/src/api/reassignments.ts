import { Router, type Response } from "express";
import type { Sql } from "postgres";
import { EVENT_TOPICS } from "@connectsphere/contracts";
import { config } from "../config.js";
import { authenticate, requireRole, type ActorRequest } from "../auth/actor.js";
import { canProposeReassignment, isSelfNomination } from "../domain/assignment.js";
import { findEventInScope } from "../repo/events.js";
import {
  closeActiveAssignment,
  findActiveAssignment,
  findPendingProposal,
  insertAssignment,
  insertProposal,
  listProposals,
  resolveProposalAccept,
  resolveProposalDecline,
} from "../repo/assignments.js";
import { writeOutbox } from "../events/outbox.js";
import { proposalBodySchema } from "./schemas.js";
import { refuse } from "./errors.js";

/** Postgres unique_violation — the same kind of code implementation.md §4.6 translates for `23P01`. */
const UNIQUE_VIOLATION = "23505";

/**
 * E2 — propose reassignment of an event's coordinator, and the nominee's
 * accept/decline. E1's own assignment is made in submitEvent.ts; this only
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

  router.post(
    "/api/v1/events/:id/reassignment-proposals",
    ...authenticate,
    requireRole("EVENT_COORDINATOR"),
    async (req: ActorRequest, res) => {
      const { userId, role, scope } = req.actor!;
      const parsed = proposalBodySchema.safeParse(req.body);
      const nomineeId = parsed.success ? parsed.data.nomineeId : null;

      if (typeof nomineeId !== "string" || nomineeId.trim().length === 0) {
        refuse(res, 400, "VALIDATION_FAILED", "A nominee is required to propose reassignment.", {
          fields: [{ field: "nomineeId", message: "A nominee is required." }],
        });
        return;
      }

      const event = await findEventInScope(sql, req.params.id, scope, userId);
      if (!event) {
        refuse(res, 404, "EVENT_NOT_FOUND", "No event with that reference is available to you.");
        return;
      }

      // E2 — reassignment proposals are permitted only for events not yet
      // Completed, Cancelled, or Rejected.
      if (!canProposeReassignment(event.status)) {
        refuse(
          res,
          409,
          "REASSIGNMENT_NOT_PERMITTED",
          `Reassignment is not permitted while this event is ${event.status}.`
        );
        return;
      }

      const active = await findActiveAssignment(sql, event.id);
      if (!active || active.coordinatorId !== userId) {
        // Only the coordinator currently assigned to this event may propose
        // handing it off — that is what "outgoing coordinator" means.
        refuse(
          res,
          403,
          "ROLE_NOT_AUTHORISED",
          "Only the coordinator currently assigned to this event may propose reassignment."
        );
        return;
      }

      // TODO(E2): blocked by Identity's coordinator-role-check endpoint, same
      // as E1's pool — nominee eligibility is checked against configuration.
      if (!config.coordinatorPool.includes(nomineeId)) {
        refuse(
          res,
          422,
          "NOMINEE_NOT_ELIGIBLE",
          "The nominee does not hold the Coordinator role and cannot be nominated."
        );
        return;
      }

      // E2 — proposing reassignment to the coordinator already assigned is
      // refused before any write, so it creates no history entry.
      if (isSelfNomination(active.coordinatorId, nomineeId)) {
        refuse(
          res,
          422,
          "SELF_NOMINATION_NOT_PERMITTED",
          "This coordinator is already assigned to the event."
        );
        return;
      }

      try {
        const proposal = await sql.begin(async (tx) => {
          const created = await insertProposal(tx, {
            eventId: event.id,
            outgoingCoordinatorId: userId,
            nomineeId,
            actorId: userId,
          });

          await writeOutbox(tx, {
            topic: EVENT_TOPICS.reassignmentProposed,
            messageType: "event.reassignment-proposed",
            aggregateId: event.id,
            actor: { userId, role },
            correlationId: req.header("x-correlation-id") ?? null,
            payload: {
              eventId: event.id,
              eventReference: event.reference!,
              eventName: event.name,
              proposalId: created.id,
              outgoingCoordinatorId: created.outgoingCoordinatorId,
              nomineeCoordinatorId: created.nomineeCoordinatorId,
              proposedAt: created.proposedAt,
            },
          });

          return created;
        });

        res.status(201).json(proposal);
      } catch (error) {
        if ((error as { code?: string }).code === UNIQUE_VIOLATION) {
          // E2 — only one pending proposal per event; name the pending nominee.
          const pending = await findPendingProposal(sql, event.id);
          refuse(
            res,
            409,
            "REASSIGNMENT_ALREADY_PENDING",
            pending
              ? `A reassignment proposal to nominee ${pending.nomineeCoordinatorId} is already pending for this event.`
              : "A reassignment proposal is already pending for this event."
          );
          return;
        }
        throw error;
      }
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
        topic: outcome === "ACCEPTED" ? EVENT_TOPICS.reassignmentAccepted : EVENT_TOPICS.reassignmentDeclined,
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
