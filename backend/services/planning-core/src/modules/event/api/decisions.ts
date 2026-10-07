import { Router, type Response } from "express";
import type { Sql } from "postgres";
import { KAFKA_TOPICS } from "@connectsphere/contracts";
import { authenticate, requireRole, type ActorRequest } from "../auth/actor.js";
import { decisionColumns, findEventInScope } from "../repo/events.js";
import { writeOutbox } from "../events/outbox.js";
import { transitionEvent } from "./transitionEvent.js";
import { rejectionBodySchema } from "./schemas.js";
import { refuse } from "./errors.js";

/**
 * D4, D5 — approving and rejecting an event request.
 *
 * A decision is one transition (F1): the status, the decision and its time are
 * written by one conditional statement, so an event that already carries a
 * decision cannot be decided again, and two coordinators deciding at once
 * cannot both succeed. The history entry and the organiser's notification are
 * written in the same transaction, so a refusal leaves no trace and a success
 * leaves no half-finished state.
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

    const result = await sql.begin(async (tx) => {
      const decided = await transitionEvent(
        tx,
        event.id,
        action,
        { userId, role },
        { set: decisionColumns(tx, userId, reason) }
      );
      if (!decided.ok) return decided;

      await writeOutbox(tx, {
        topic: KAFKA_TOPICS.event,
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
                approvedAt: decided.event.decidedAt!,
              }
            : {
                eventId: event.id,
                eventReference: event.reference,
                eventName: event.name,
                ownerId: event.ownerId,
                rejectedBy: userId,
                rejectedAt: decided.event.decidedAt!,
                reason: reason!,
              },
      });

      return decided;
    });

    if (!result.ok) {
      // F1 — a refused transition stores nothing, and names the status the
      // event is in and the one it could not move to.
      refuse(res, 409, "STATUS_TRANSITION_NOT_PERMITTED", result.message);
      return;
    }

    res.status(200).json(result.event);
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
