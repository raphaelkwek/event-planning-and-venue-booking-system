import { Router } from "express";
import type { Sql } from "postgres";
import { authenticate, requireRole, type ActorRequest } from "../auth/actor.js";
import { validateSubmission } from "../domain/validation.js";
import {
  claimForReview,
  findEventInScope,
  listEventsInScope,
  listReviewQueue,
  type EventRow,
} from "../repo/events.js";
import { listDraftsForOwner } from "../repo/drafts.js";
import { recordStatusChange } from "../repo/eventHistory.js";
import { QUEUE_STATUSES } from "../domain/statusMachine.js";
import { submitEvent } from "./submitEvent.js";
import { submissionBodySchema, toEventFields } from "./schemas.js";
import { fieldsFromZod, refuse } from "./errors.js";

/** B1 — submission; C3 — the organiser's combined list of requests. */

/**
 * C3 — drafts and submitted requests appear in one list, each showing its
 * status, so an unfinished request is never mistaken for one under review.
 * A draft row carries a last-saved time and no reference, coordinator or
 * review outcome; a submitted row carries a submission time.
 */
function listItem(event: EventRow) {
  const isDraft = event.status === "DRAFT";
  return {
    id: event.id,
    kind: isDraft ? ("DRAFT" as const) : ("EVENT" as const),
    status: event.status,
    name: event.name,
    reference: event.reference,
    lastSavedAt: isDraft ? event.lastSavedAt : null,
    submittedAt: event.submittedAt,
    assignedCoordinatorId: event.assignedCoordinatorId,
    decidedAt: event.decidedAt,
  };
}

export function eventsRouter(sql: Sql) {
  const router = Router();

  router.post(
    "/api/v1/events",
    ...authenticate,
    requireRole("EVENT_ORGANISER"),
    async (req: ActorRequest, res) => {
      const parsed = submissionBodySchema.safeParse(req.body);
      if (!parsed.success) {
        refuse(res, 400, "VALIDATION_FAILED", "This request could not be submitted.", {
          fields: fieldsFromZod(parsed.error),
        });
        return;
      }

      const errors = validateSubmission(parsed.data);
      if (errors.length > 0) {
        // B1 — a blocked submission creates no event record and records no
        // submission timestamp; the client keeps the entered values on screen.
        refuse(res, 400, "VALIDATION_FAILED", "This request is not ready to be submitted.", {
          fields: errors,
        });
        return;
      }

      const event = await submitEvent(sql, {
        ownerId: req.actor!.userId,
        actorRole: req.actor!.role,
        fields: toEventFields(parsed.data),
        correlationId: req.header("x-correlation-id") ?? null,
      });

      res.status(201).json(event);
    }
  );

  /** D1 — the queue of requests awaiting a decision. */
  router.get(
    "/api/v1/events/queue",
    ...authenticate,
    requireRole("EVENT_COORDINATOR"),
    async (_req: ActorRequest, res) => {
      const items = await listReviewQueue(sql, QUEUE_STATUSES);
      res.status(200).json({ items, nextCursor: null });
    }
  );

  /**
   * D1 — opening a request shows its full submitted content, and opening one
   * that is still Submitted claims it for review. The claim is conditional, so
   * a second coordinator opening the same request sees the first reviewer
   * rather than replacing them.
   */
  router.get("/api/v1/events/:id", ...authenticate, async (req: ActorRequest, res) => {
    const { userId, role, scope } = req.actor!;

    const event = await findEventInScope(sql, req.params.id, scope, userId);
    if (!event) {
      refuse(res, 404, "EVENT_NOT_FOUND", "No event with that reference is available to you.");
      return;
    }

    if (role !== "EVENT_COORDINATOR" || event.status !== "SUBMITTED") {
      res.status(200).json(event);
      return;
    }

    const claimed = await sql.begin(async (tx) => {
      const opened = await claimForReview(tx, event.id, userId);
      if (opened) {
        await recordStatusChange(tx, event.id, {
          previousStatus: "SUBMITTED",
          newStatus: "UNDER_REVIEW",
          actorUserId: userId,
          actorRole: role,
          triggeringAction: "OPEN_FOR_REVIEW",
        });
      }
      return opened;
    });

    res.status(200).json(claimed ?? (await findEventInScope(sql, event.id, scope, userId)));
  });

  router.get("/api/v1/events", ...authenticate, async (req: ActorRequest, res) => {
    const kind = req.query.kind;
    const { userId, scope } = req.actor!;

    const rows =
      kind === "drafts"
        ? await listDraftsForOwner(sql, userId)
        : await listEventsInScope(sql, scope, userId);

    const items = (kind === "submitted" ? rows.filter((row) => row.status !== "DRAFT") : rows).map(
      listItem
    );

    res.status(200).json({ items, nextCursor: null });
  });

  return router;
}
