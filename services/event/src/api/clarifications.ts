import { Router } from "express";
import type { Sql } from "postgres";
import { EVENT_TOPICS } from "@connectsphere/contracts";
import { authenticate, requireRole, type ActorRequest } from "../auth/actor.js";
import { evaluateTransition } from "../domain/statusMachine.js";
import { applyAmendments, findEventInScope, setStatus, type EventRow } from "../repo/events.js";
import {
  findOpenClarification,
  insertClarification,
  insertFieldEdits,
  listClarifications,
  recordResponse,
} from "../repo/clarifications.js";
import { insertHistory } from "../repo/statusHistory.js";
import { writeOutbox } from "../events/outbox.js";
import { clarificationBodySchema, clarificationResponseBodySchema, AMENDABLE_COLUMNS } from "./schemas.js";
import { refuse } from "./errors.js";

/** D2, D3 — asking the organiser for clarification, and their response. */

function hasContent(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function clarificationsRouter(sql: Sql) {
  const router = Router();

  /** Visible to the owning organiser and to Event Coordinators, nobody else. */
  router.get("/api/v1/events/:id/clarifications", ...authenticate, async (req: ActorRequest, res) => {
    const { userId, scope } = req.actor!;

    const event = await findEventInScope(sql, req.params.id, scope, userId);
    if (!event) {
      refuse(res, 404, "EVENT_NOT_FOUND", "No event with that reference is available to you.");
      return;
    }

    res.status(200).json({ items: await listClarifications(sql, event.id), nextCursor: null });
  });

  router.post(
    "/api/v1/events/:id/clarifications",
    ...authenticate,
    requireRole("EVENT_COORDINATOR"),
    async (req: ActorRequest, res) => {
      const { userId, role, scope } = req.actor!;
      const parsed = clarificationBodySchema.safeParse(req.body);
      const message = parsed.success ? parsed.data.message : null;

      // D2 — the message is mandatory and must carry at least one
      // non-whitespace character; without it nothing is stored at all.
      if (!hasContent(message)) {
        refuse(res, 400, "VALIDATION_FAILED", "A clarification message is required.", {
          fields: [{ field: "message", message: "A clarification message is required." }],
        });
        return;
      }

      const event = await findEventInScope(sql, req.params.id, scope, userId);
      if (!event) {
        refuse(res, 404, "EVENT_NOT_FOUND", "No event with that reference is available to you.");
        return;
      }

      const transition = evaluateTransition(event.status, "REQUEST_CLARIFICATION");
      if (!transition.permitted) {
        refuse(res, 409, "STATUS_TRANSITION_NOT_PERMITTED", transition.message);
        return;
      }

      const clarification = await sql.begin(async (tx) => {
        const created = await insertClarification(tx, event.id, message.trim(), userId);
        await setStatus(tx, event.id, transition.to, userId);
        await insertHistory(tx, event.id, {
          previousStatus: transition.from,
          newStatus: transition.to,
          actorUserId: userId,
          actorRole: role,
          triggeringAction: "REQUEST_CLARIFICATION",
        });

        await writeOutbox(tx, {
          topic: EVENT_TOPICS.clarificationRequested,
          messageType: "event.clarification-requested",
          aggregateId: event.id,
          actor: { userId, role },
          correlationId: req.header("x-correlation-id") ?? null,
          payload: {
            eventId: event.id,
            eventReference: event.reference,
            eventName: event.name,
            clarificationId: created.id,
            ownerId: event.ownerId,
            requestedBy: userId,
            requestedAt: created.requestedAt,
          },
        });

        return created;
      });

      res.status(201).json(clarification);
    }
  );

  router.post(
    "/api/v1/events/:id/clarifications/respond",
    ...authenticate,
    requireRole("EVENT_ORGANISER"),
    async (req: ActorRequest, res) => {
      const { userId, role, scope } = req.actor!;
      const parsed = clarificationResponseBodySchema.safeParse(req.body);
      if (!parsed.success) {
        refuse(res, 400, "VALIDATION_FAILED", "This response could not be recorded.");
        return;
      }

      const { message, amendments } = parsed.data;
      const amendedFields = Object.keys(amendments ?? {}).filter(
        (field) => field in AMENDABLE_COLUMNS
      );

      // D3 — a reply, an amendment, or both. Neither is refused and records
      // no response timestamp.
      if (!hasContent(message) && amendedFields.length === 0) {
        refuse(
          res,
          400,
          "VALIDATION_FAILED",
          "Reply with a message, amend the request, or both.",
          { fields: [{ field: "message", message: "A message or an amendment is required." }] }
        );
        return;
      }

      const event = await findEventInScope(sql, req.params.id, scope, userId);
      if (!event) {
        refuse(res, 404, "EVENT_NOT_FOUND", "No event with that reference is available to you.");
        return;
      }

      const transition = evaluateTransition(event.status, "RESPOND_TO_CLARIFICATION");
      if (!transition.permitted) {
        refuse(res, 409, "STATUS_TRANSITION_NOT_PERMITTED", transition.message);
        return;
      }

      const result = await sql.begin(async (tx) => {
        const open = await findOpenClarification(tx, event.id);
        if (!open) return null;

        const clarification = await recordResponse(
          tx,
          open.id,
          hasContent(message) ? message.trim() : null,
          userId
        );

        let updated: EventRow = event;
        if (amendedFields.length > 0) {
          // D3 — the values as originally submitted are retained in the
          // history alongside the amended values.
          await insertFieldEdits(
            tx,
            event.id,
            amendedFields.map((field) => ({
              fieldName: field,
              previousValue: stringify(event[field as keyof EventRow]),
              newValue: stringify((amendments as Record<string, unknown>)[field]),
            })),
            userId
          );

          updated = await applyAmendments(
            tx,
            event.id,
            Object.fromEntries(
              amendedFields.map((field) => [
                AMENDABLE_COLUMNS[field as keyof typeof AMENDABLE_COLUMNS],
                (amendments as Record<string, unknown>)[field],
              ])
            ),
            userId
          );
        }

        await setStatus(tx, event.id, transition.to, userId);
        await insertHistory(tx, event.id, {
          previousStatus: transition.from,
          newStatus: transition.to,
          actorUserId: userId,
          actorRole: role,
          triggeringAction: "RESPOND_TO_CLARIFICATION",
        });

        await writeOutbox(tx, {
          topic: EVENT_TOPICS.clarificationResponded,
          messageType: "event.clarification-responded",
          aggregateId: event.id,
          actor: { userId, role },
          correlationId: req.header("x-correlation-id") ?? null,
          payload: {
            eventId: event.id,
            eventReference: event.reference,
            eventName: event.name,
            clarificationId: clarification.id,
            requestedBy: clarification.requestedBy,
            respondedBy: userId,
            respondedAt: clarification.respondedAt!,
            amendedFields,
          },
        });

        return { clarification, event: { ...updated, status: transition.to } };
      });

      if (!result) {
        refuse(res, 409, "NO_OPEN_CLARIFICATION", "This event has no outstanding clarification.");
        return;
      }

      res.status(200).json(result);
    }
  );

  return router;
}

function stringify(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return typeof value === "string" ? value : JSON.stringify(value);
}
