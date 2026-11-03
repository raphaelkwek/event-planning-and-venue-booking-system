import { Router, type NextFunction, type RequestHandler, type Response } from "express";
import type { Sql } from "postgres";
import type { Role } from "@connectsphere/contracts";
import { notInScopeMessage } from "../../identity/index.js";
import { listSafetyReviewQueue } from "../../event/index.js";
import { authenticate, requireRole, type ActorRequest } from "../auth/actor.js";
import { parseDecision } from "../domain/safetyReview.js";
import { decide, markConfirmed, reviewFor } from "../repo/safetyReview.js";
import { refuse } from "./errors.js";
import { changeRateLimiter } from "./limiter.js";

/**
 * U1 (CR-06) — the Safety Officer's queue, the review of one event, the one decision on it, and the
 * assigned coordinator's Mark Confirmed. Only the Safety Officer reads the queue or the review and
 * decides; only an Event Coordinator may try Mark Confirmed, and then only the event's assigned one
 * (A2, enforced here whatever the interface offers).
 */
const SAFETY_OFFICER = "SAFETY_OFFICER";
const COORDINATOR = "EVENT_COORDINATOR";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const notFound = (res: Response) => refuse(res, 404, "EVENT_NOT_FOUND", "No event with that reference is available to you.");
// A4: for a coordinator, an event not found is one not assigned to them, and the message says so.
const notFoundFor = (res: Response, role: Role) =>
  refuse(res, 404, "EVENT_NOT_FOUND", notInScopeMessage(role, "No event with that reference is available to you."));

export function safetyReviewRouter(sql: Sql, limiter: RequestHandler = changeRateLimiter()) {
  const router = Router();

  router.get("/api/v1/safety-reviews", limiter, authenticate, requireRole(SAFETY_OFFICER), async (_req: ActorRequest, res: Response, next: NextFunction) => {
    try {
      res.json({ events: await listSafetyReviewQueue(sql) });
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/v1/events/:id/safety-review", limiter, authenticate, requireRole(SAFETY_OFFICER), async (req: ActorRequest, res: Response, next: NextFunction) => {
    try {
      const eventId = req.params.id!;
      if (!UUID.test(eventId)) return notFound(res);
      const outcome = await reviewFor(sql, eventId, req.actor!.userId);
      if (outcome.ok) return void res.json(outcome.review);
      if (outcome.code === "NOT_FOUND") return notFound(res);
      return void refuse(res, 409, "STATUS_TRANSITION_NOT_PERMITTED", outcome.message);
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/v1/events/:id/safety-decision", limiter, authenticate, requireRole(SAFETY_OFFICER), async (req: ActorRequest, res: Response, next: NextFunction) => {
    try {
      const eventId = req.params.id!;
      if (!UUID.test(eventId)) return notFound(res);
      const parsed = parseDecision(req.body);
      if (!parsed.ok) return void refuse(res, 400, "VALIDATION_FAILED", "The decision could not be recorded. Check the highlighted fields.", parsed.fields);

      const correlationId = req.header("x-correlation-id") ?? null;
      const outcome = await sql.begin((tx) => decide(tx, eventId, { ...req.actor!, correlationId }, parsed.value));
      if (outcome.ok) {
        const { decision } = outcome;
        return void res.status(201).json({
          decision: {
            id: decision.id,
            decision: decision.decision,
            reason: decision.reason,
            flagged: decision.flagged,
            decidedBy: decision.decidedBy,
            decidedAt: decision.decidedAt,
          },
          event: { id: outcome.eventId, reference: outcome.reference, status: outcome.status, previousStatus: outcome.previousStatus },
        });
      }
      switch (outcome.code) {
        case "NOT_FOUND":
          return notFound(res);
        case "STATUS_NOT_PERMITTED":
          return void refuse(res, 409, "STATUS_TRANSITION_NOT_PERMITTED", outcome.message);
        case "ALREADY_RECORDED":
          return void refuse(res, 409, "SAFETY_DECISION_ALREADY_RECORDED", outcome.message);
        case "FLAGS_OUTSTANDING":
          return void refuse(res, 409, "ARRANGEMENT_FLAGS_OUTSTANDING", outcome.message, undefined, { flags: outcome.flags });
        case "UNKNOWN_ARRANGEMENT":
          return void refuse(res, 400, "VALIDATION_FAILED", outcome.message, [{ field: "flagBookingIds", message: outcome.message }]);
        default: {
          const unreachable: never = outcome;
          throw new Error(`Unhandled decision outcome ${JSON.stringify(unreachable)}`);
        }
      }
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/v1/events/:id/mark-confirmed", limiter, authenticate, requireRole(COORDINATOR), async (req: ActorRequest, res: Response, next: NextFunction) => {
    try {
      const eventId = req.params.id!;
      if (!UUID.test(eventId)) return notFoundFor(res, req.actor!.role);
      const correlationId = req.header("x-correlation-id") ?? null;
      const outcome = await sql.begin((tx) => markConfirmed(tx, eventId, { ...req.actor!, correlationId }));
      if (outcome.ok) {
        return void res.status(200).json({
          event: { id: outcome.eventId, reference: outcome.reference, status: outcome.status, previousStatus: outcome.previousStatus, confirmedAt: outcome.confirmedAt },
        });
      }
      switch (outcome.code) {
        case "NOT_FOUND":
          return notFoundFor(res, req.actor!.role);
        case "STATUS_NOT_PERMITTED":
          return void refuse(res, 409, "STATUS_TRANSITION_NOT_PERMITTED", outcome.message);
        case "SAFETY_CHECK_NOT_PASSED":
          return void refuse(res, 409, "SAFETY_CHECK_NOT_PASSED", outcome.message);
        case "FLAGS_OUTSTANDING":
          return void refuse(res, 409, "ARRANGEMENT_FLAGS_OUTSTANDING", outcome.message, undefined, { flags: outcome.flags });
        default: {
          const unreachable: never = outcome;
          throw new Error(`Unhandled Mark Confirmed outcome ${JSON.stringify(unreachable)}`);
        }
      }
    } catch (error) {
      next(error);
    }
  });

  return router;
}
