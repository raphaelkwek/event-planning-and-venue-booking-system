import { Router, type NextFunction, type RequestHandler, type Response } from "express";
import type { Sql } from "postgres";
import { KAFKA_TOPICS } from "@connectsphere/contracts";
import { checkProposedChange, findEventForChange, type EventForChange } from "../../event/index.js";
import { resolveAccessScope } from "../../identity/index.js";
import { authenticate, requireRole, type ActorRequest } from "../auth/actor.js";
import { isChangeable, notChangeableMessage, validateChangeBody } from "../domain/changeRequests.js";
import { writeOutbox } from "../events/outbox.js";
import {
  ChangeRequestAlreadyPendingError,
  insertChangeRequest,
  listForEvent,
  type ChangeRequestRecord,
} from "../repo/changeRequests.js";
import { refuse } from "./errors.js";
import { changeRateLimiter } from "./limiter.js";

/**
 * S1 — the owning organiser asks for a change to an event's significant fields.
 * The request is stored Pending with a snapshot of each current value; the
 * event itself is never written (AC4), and every refusal stores nothing (AC7).
 */
const ORGANISER = "EVENT_ORGANISER";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PATH = "/api/v1/events/:id/change-requests";

function eventNotFound(res: Response) {
  refuse(res, 404, "EVENT_NOT_FOUND", "No event with that id exists.");
}

/** The event under the A3 scope rule: another organiser's event is simply not found. */
function findInScope(sql: Sql, req: ActorRequest): Promise<EventForChange | null> {
  const id = req.params.id!;
  if (!UUID.test(id)) return Promise.resolve(null);
  const scope = resolveAccessScope(req.actor!.role, req.actor!.userId, "events");
  return findEventForChange(sql, id, scope, req.actor!.userId);
}

function alreadyPending(res: Response, existing: ChangeRequestRecord) {
  refuse(
    res,
    409,
    "CHANGE_REQUEST_ALREADY_PENDING",
    `A change request for this event is already pending, made on ${existing.requestedAt}.`,
    undefined,
    { id: existing.id, requestedAt: existing.requestedAt, fields: existing.fields.map((field) => field.fieldName) }
  );
}

export function changeRequestsRouter(sql: Sql, limiter: RequestHandler = changeRateLimiter()) {
  const router = Router();

  router.post(PATH, limiter, authenticate, requireRole(ORGANISER), async (req: ActorRequest, res: Response, next: NextFunction) => {
    try {
      const event = await findInScope(sql, req);
      if (!event) return eventNotFound(res);
      if (event.ownerId !== req.actor!.userId) {
        refuse(res, 403, "ROLE_NOT_AUTHORISED", "Only the event's organiser can request a change.");
        return;
      }

      const body = validateChangeBody(req.body);
      if (!body.ok) {
        refuse(res, 400, "VALIDATION_FAILED", "The change request could not be saved. Check the highlighted fields.", body.fields);
        return;
      }
      if (!isChangeable(event.status)) {
        refuse(res, 409, "EVENT_NOT_CHANGEABLE", notChangeableMessage(event.status), undefined, { status: event.status });
        return;
      }
      // Every changeable status comes after submission, which gives the event its reference.
      if (!event.reference) return eventNotFound(res);

      const problems = checkProposedChange(event.current, body.changes);
      if (problems.length > 0) {
        refuse(
          res,
          400,
          "VALIDATION_FAILED",
          "The change request could not be saved. Check the highlighted fields.",
          problems.map((problem) => ({ field: `changes.${problem.field}`, message: problem.message }))
        );
        return;
      }

      const actor = req.actor!;
      const reference = event.reference;
      let created: ChangeRequestRecord;
      try {
        created = await sql.begin(async (tx) => {
          const request = await insertChangeRequest(tx, {
            event: { id: event.id, reference },
            reason: body.reason,
            changes: body.changes,
            current: event.current as unknown as Record<string, unknown>,
            actorId: actor.userId,
          });
          if (event.assignedCoordinatorId) {
            await writeOutbox(tx, {
              topic: KAFKA_TOPICS.event,
              messageType: "change-request.submitted",
              aggregateId: event.id,
              actor,
              correlationId: req.header("x-correlation-id") ?? null,
              payload: {
                eventId: event.id,
                eventReference: reference,
                eventName: event.name,
                coordinatorId: event.assignedCoordinatorId,
                changeRequestId: request.id,
                fields: request.fields.map((field) => field.fieldName),
                requestedBy: request.requestedBy,
                requestedAt: request.requestedAt,
              },
            });
          }
          return request;
        });
      } catch (error) {
        // Outside begin(): the transaction has rolled back, so nothing of this attempt is stored.
        if (error instanceof ChangeRequestAlreadyPendingError) return alreadyPending(res, error.existing);
        throw error;
      }
      res.status(201).json(created);
    } catch (error) {
      next(error);
    }
  });

  router.get(PATH, limiter, authenticate, async (req: ActorRequest, res: Response, next: NextFunction) => {
    try {
      const event = await findInScope(sql, req);
      if (!event) return eventNotFound(res);
      res.json({ items: await listForEvent(sql, event.id) });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
