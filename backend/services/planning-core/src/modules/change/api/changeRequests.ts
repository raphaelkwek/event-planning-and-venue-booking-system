import { Router, type NextFunction, type RequestHandler, type Response } from "express";
import type { Sql } from "postgres";
import { KAFKA_TOPICS, type ErrorField, type EventStatus } from "@connectsphere/contracts";
import { checkProposedChange, findEventForChange, type EventForChange } from "../../event/index.js";
import { resolveAccessScope } from "../../identity/index.js";
import { authenticate, requireRole, type ActorRequest } from "../auth/actor.js";
import { isChangeable, normaliseInstants, notChangeableMessage, validateChangeBody } from "../domain/changeRequests.js";
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

const INVALID_MESSAGE = "The change request could not be saved. Check the highlighted fields.";

type Outcome =
  | { code: "NOT_FOUND" }
  | { code: "NOT_OWNER" }
  | { code: "INVALID"; fields: ErrorField[] }
  | { code: "NOT_CHANGEABLE"; status: EventStatus }
  | { code: "OK"; request: ChangeRequestRecord };

/** The event module reports a proposed value on its own field name; the request names it under `changes`. */
const renamed = (problems: ErrorField[]): ErrorField[] =>
  problems.map((problem) => ({ field: `changes.${problem.field}`, message: problem.message }));

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
      const eventId = req.params.id!;
      if (!UUID.test(eventId)) return eventNotFound(res);
      const actor = req.actor!;
      const body = validateChangeBody(req.body);
      const scope = resolveAccessScope(actor.role, actor.userId, "events");

      let outcome: Outcome;
      try {
        // The event is read and share-locked inside the transaction that stores the request, so a
        // status change (which locks the row for update) cannot slip in between the checks and the insert.
        outcome = await sql.begin(async (tx): Promise<Outcome> => {
          const event = await findEventForChange(tx, eventId, scope, actor.userId, { lock: "share" });
          if (!event) return { code: "NOT_FOUND" };
          if (event.ownerId !== actor.userId) return { code: "NOT_OWNER" };

          // Every problem together: the body's, and the proposed values' where the body gave any.
          if (!body.ok) {
            return { code: "INVALID", fields: [...body.fields, ...renamed(checkProposedChange(event.current, body.proposed))] };
          }
          if (!isChangeable(event.status)) return { code: "NOT_CHANGEABLE", status: event.status };
          // Every changeable status comes after submission, which gives the event its reference.
          if (!event.reference) throw new Error(`Event ${event.id} is ${event.status} but has no reference`);

          const problems = checkProposedChange(event.current, body.changes);
          if (problems.length > 0) return { code: "INVALID", fields: renamed(problems) };

          const request = await insertChangeRequest(tx, {
            event: { id: event.id, reference: event.reference },
            reason: body.reason,
            changes: normaliseInstants(body.changes),
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
                eventReference: event.reference,
                eventName: event.name,
                coordinatorId: event.assignedCoordinatorId,
                changeRequestId: request.id,
                fields: request.fields.map((field) => field.fieldName),
                requestedBy: request.requestedBy,
                requestedAt: request.requestedAt,
              },
            });
          }
          return { code: "OK", request };
        });
      } catch (error) {
        // Outside begin(): the transaction has rolled back, so nothing of this attempt is stored.
        if (error instanceof ChangeRequestAlreadyPendingError) return alreadyPending(res, error.existing);
        throw error;
      }

      switch (outcome.code) {
        case "NOT_FOUND":
          return eventNotFound(res);
        case "NOT_OWNER":
          return void refuse(res, 403, "ROLE_NOT_AUTHORISED", "Only the event's organiser can request a change.");
        case "INVALID":
          return void refuse(res, 400, "VALIDATION_FAILED", INVALID_MESSAGE, outcome.fields);
        case "NOT_CHANGEABLE":
          return void refuse(res, 409, "EVENT_NOT_CHANGEABLE", notChangeableMessage(outcome.status), undefined, { status: outcome.status });
        case "OK":
          res.status(201).json(outcome.request);
      }
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
