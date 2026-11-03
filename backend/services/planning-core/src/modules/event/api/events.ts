import { Router, type RequestHandler } from "express";
import { eventRateLimiter } from "./eventRateLimiter.js";
import type { Sql } from "postgres";
import { authenticate, requireRole, type ActorRequest } from "../auth/actor.js";
import { validateSubmission } from "../domain/validation.js";
import {
  findEventInScope,
  listEventsInScope,
  listReviewQueue,
  reviewColumns,
  type EventRow,
} from "../repo/events.js";
import { decodeCursor, MAX_PAGE_SIZE, readLimit } from "../domain/pagination.js";
import { QUEUE_STATUSES } from "../domain/statusMachine.js";
import { submitEvent } from "./submitEvent.js";
import { transitionEvent } from "./transitionEvent.js";
import { submissionBodySchema, toEventFields } from "./schemas.js";
import { eventNotFound, fieldsFromZod, refuse } from "./errors.js";
import { etag } from "../domain/eventDetails.js";

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

export function eventsRouter(sql: Sql, limiter: RequestHandler = eventRateLimiter()) {
  const router = Router();

  router.post(
    "/api/v1/events",
    limiter, ...authenticate,
    requireRole("event", "create"),
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

      const submitted = await submitEvent(sql, {
        ownerId: req.actor!.userId,
        actorRole: req.actor!.role,
        fields: toEventFields(parsed.data),
        correlationId: req.header("x-correlation-id") ?? null,
      });

      if (!submitted.ok) {
        // Unreachable: submitEvent throws when a request it inserted in
        // this transaction cannot be submitted. Kept as a defensive 409.
        refuse(res, 409, "STATUS_TRANSITION_NOT_PERMITTED", submitted.message);
        return;
      }

      res.status(201).json(submitted.event);
    }
  );

  /** D1 — the queue of requests awaiting a decision, only the caller's own (A4). */
  router.get(
    "/api/v1/events/queue",
    limiter, ...authenticate,
    requireRole("event", "review"),
    async (req: ActorRequest, res) => {
      const items = await listReviewQueue(sql, QUEUE_STATUSES, req.actor!.userId);
      res.status(200).json({ items, nextCursor: null });
    }
  );

  /**
   * D1 — opening a request shows its full submitted content, and opening one
   * that is still Submitted claims it for review. The claim's condition is the
   * status guard in transitionEvent, so a second
   * coordinator opening the same request sees the first reviewer rather than
   * replacing them.
   */
  router.get("/api/v1/events/:id", limiter, ...authenticate, requireRole("event", "view"), async (req: ActorRequest, res) => {
    const { userId, role, scope } = req.actor!;

    const event = await findEventInScope(sql, req.params.id, scope, userId);
    if (!event) {
      eventNotFound(res, role);
      return;
    }

    // G1: the version an edit must send back in If-Match (ADR-0015).
    // E3: an unassigned request is the Lead's to assign; a coordinator opening it does not claim it.
    if (role !== "EVENT_COORDINATOR" || event.status !== "SUBMITTED" || !event.assignedCoordinatorId) {
      res.set("ETag", etag(event.version)).status(200).json(event);
      return;
    }

    // A4: the scope once more, under the row lock. If the Lead reassigned the request while this
    // waited, the outgoing coordinator neither claims it nor sees it.
    const opened = await sql.begin(async (tx) =>
      (await findEventInScope(tx, event.id, scope, userId, { lock: "update" }))
        ? transitionEvent(tx, event.id, "OPEN_FOR_REVIEW", { userId, role }, { set: reviewColumns(tx, userId) })
        : null
    );

    // If another coordinator claimed it between our read and the transition, the
    // transition is refused and changes nothing; re-read so this coordinator
    // sees the first reviewer (D1).
    const shown = opened?.ok ? opened.event : await findEventInScope(sql, event.id, scope, userId);
    if (!shown) {
      eventNotFound(res, role);
      return;
    }
    res.set("ETag", etag(shown.version)).status(200).json(shown);
  });

  router.get("/api/v1/events", limiter, ...authenticate, requireRole("event", "view"), async (req: ActorRequest, res) => {
    const kind = req.query.kind === "drafts" || req.query.kind === "submitted" ? req.query.kind : undefined;
    const { userId, scope } = req.actor!;

    // L7: paged as every list is (implementation.md §5).
    const limit = readLimit(req.query.limit);
    if (!limit.ok) {
      return refuse(res, 400, "VALIDATION_FAILED", `limit must be a whole number from 1 to ${MAX_PAGE_SIZE}.`, {
        fields: [{ field: "limit", message: `Give a whole number from 1 to ${MAX_PAGE_SIZE}.` }],
      });
    }
    const after = typeof req.query.cursor === "string" ? decodeCursor(req.query.cursor) : null;
    if (req.query.cursor !== undefined && !after) {
      return refuse(res, 400, "VALIDATION_FAILED", "cursor is not one this service issued.", {
        fields: [{ field: "cursor", message: "Use the nextCursor from a previous page." }],
      });
    }

    const page = await listEventsInScope(sql, scope, userId, { limit: limit.limit, after, kind });
    res.status(200).json({ items: page.rows.map(listItem), nextCursor: page.nextCursor });
  });

  return router;
}
