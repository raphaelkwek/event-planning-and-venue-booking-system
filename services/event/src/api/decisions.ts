import { Router, type Response } from "express";
import type { Sql } from "postgres";
import { EVENT_TOPICS } from "@connectsphere/contracts";
import { authenticate, requireRole, type ActorRequest } from "../auth/actor.js";
import { evaluateTransition } from "../domain/statusMachine.js";
import { findEventInScope, lockEventInScope, recordDecision } from "../repo/events.js";
import { insertHistory } from "../repo/statusHistory.js";
import { writeOutbox } from "../events/outbox.js";
import { rejectionBodySchema } from "./schemas.js";
import { refuse } from "./errors.js";

/**
 * D4, D5 — approving and rejecting an event request.
 *
 * Both decisions are the same shape: check the transition is permitted from
 * the current status (F1), write the decision conditionally so an event that
 * already carries one cannot be decided twice, record the history entry, and
 * raise the organiser's notification — all in one transaction, so a refusal
 * leaves no trace and a success leaves no half-finished state.
 */
export function decisionsRouter(sql: Sql) {
  const router = Router();

  async function decide(
    req: ActorRequest,
    res: Response,
    outcome: "APPROVED" | "REJECTED",
    reason: string | null
  ) {
    const { userId, role, scope } = req.actor!;
    const action = outcome === "APPROVED" ? "APPROVE" : "REJECT";

    const event = await findEventInScope(sql, req.params.id, scope, userId);
    if (!event) {
      refuse(res, 404, "EVENT_NOT_FOUND", "No event with that reference is available to you.");
      return;
    }

    const transition = evaluateTransition(event.status, action);
    if (!transition.permitted) {
      refuse(res, 409, "STATUS_TRANSITION_NOT_PERMITTED", transition.message);
      return;
    }

    const decided = await sql.begin(async (tx) => {
      // Re-read under a row lock so that two coordinators deciding at once
      // cannot both pass the check above.
      const current = await lockEventInScope(tx, event.id, scope, userId);
      if (!current || !evaluateTransition(current.status, action).permitted) {
        return null;
      }

      const updated = await recordDecision(tx, event.id, outcome, userId, reason);
      if (!updated) return null;

      await insertHistory(tx, event.id, {
        previousStatus: current.status,
        newStatus: outcome,
        actorUserId: userId,
        actorRole: role,
        triggeringAction: action,
      });

      await writeOutbox(tx, {
        topic: outcome === "APPROVED" ? EVENT_TOPICS.approved : EVENT_TOPICS.rejected,
        messageType: outcome === "APPROVED" ? "event.approved" : "event.rejected",
        aggregateId: event.id,
        actor: { userId, role },
        correlationId: req.header("x-correlation-id") ?? null,
        payload:
          outcome === "APPROVED"
            ? {
                eventId: event.id,
                eventReference: event.reference,
                eventName: event.name,
                ownerId: event.ownerId,
                approvedBy: userId,
                approvedAt: updated.decidedAt!,
              }
            : {
                eventId: event.id,
                eventReference: event.reference,
                eventName: event.name,
                ownerId: event.ownerId,
                rejectedBy: userId,
                rejectedAt: updated.decidedAt!,
                reason: reason!,
              },
      });

      return updated;
    });

    if (!decided) {
      // D4/D5 — an event that already carries a decision cannot be decided
      // again, and no second decision timestamp is written.
      refuse(
        res,
        409,
        "EVENT_ALREADY_DECIDED",
        "This event already carries a recorded decision and cannot be decided again."
      );
      return;
    }

    res.status(200).json(decided);
  }

  /** D4 — approval alone creates no venue booking and no equipment reservation. */
  router.post(
    "/api/v1/events/:id/approve",
    ...authenticate,
    requireRole("EVENT_COORDINATOR"),
    async (req: ActorRequest, res) => {
      await decide(req, res, "APPROVED", null);
    }
  );

  router.post(
    "/api/v1/events/:id/reject",
    ...authenticate,
    requireRole("EVENT_COORDINATOR"),
    async (req: ActorRequest, res) => {
      const parsed = rejectionBodySchema.safeParse(req.body);
      const reason = parsed.success ? parsed.data.reason : null;

      // D5 — without a reason the rejection is not performed at all: the
      // status is unchanged and no rejection timestamp is recorded.
      if (typeof reason !== "string" || reason.trim().length === 0) {
        refuse(res, 400, "VALIDATION_FAILED", "A reason is required to reject an event request.", {
          fields: [{ field: "reason", message: "A reason is required." }],
        });
        return;
      }

      await decide(req, res, "REJECTED", reason.trim());
    }
  );

  return router;
}
