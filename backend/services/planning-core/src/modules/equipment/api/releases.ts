import { Router, type NextFunction, type RequestHandler, type Response } from "express";
import type { Sql } from "postgres";
import { EQUIPMENT_LINE_STATUS_LABELS } from "@connectsphere/contracts";
import { findEventForPlanning } from "../../event/index.js";
import { authenticate, requireRole, type ActorRequest } from "../auth/actor.js";
import { validateReleaseBody } from "../domain/reservations.js";
import { lineStatusChangedMessage } from "../events/lineStatusMessage.js";
import { writeOutbox } from "../events/outbox.js";
import { releaseLine } from "../repo/releases.js";
import { findLine } from "../repo/requestLines.js";
import { refuse } from "./errors.js";
import { equipmentRateLimiter } from "./limiter.js";
import { present } from "./presentLine.js";

/** Q2 — Technical Support release a Reserved line's reservation, with a reason. */
const TECH_SUPPORT = "TECH_SUPPORT_STAFF";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALL_EVENTS = { scopeType: "ALL" } as const;

const lineNotFound = (res: Response) => refuse(res, 404, "EQUIPMENT_LINE_NOT_FOUND", "No equipment request line with that id exists.");

export function releasesRouter(sql: Sql, limiter: RequestHandler = equipmentRateLimiter()) {
  const router = Router();

  router.post(
    "/api/v1/equipment/request-lines/:id/release",
    limiter,
    authenticate,
    requireRole(TECH_SUPPORT),
    async (req: ActorRequest, res: Response, next: NextFunction) => {
      try {
        const id = req.params.id!;
        if (!UUID.test(id)) return lineNotFound(res);
        const checked = validateReleaseBody(req.body);
        if (!checked.ok) {
          return refuse(res, 400, "VALIDATION_FAILED", "The reservation could not be released. Check the highlighted fields.", checked.fields);
        }
        const existing = await findLine(sql, id);
        if (!existing) return lineNotFound(res);
        const event = await findEventForPlanning(sql, existing.eventId, ALL_EVENTS, req.actor!.userId);
        if (!event) return refuse(res, 404, "EVENT_NOT_FOUND", "No event with that id exists.");

        const outcome = await sql.begin(async (tx) => {
          const result = await releaseLine(tx, id, checked.reason, req.actor!);
          if (result.ok && event.assignedCoordinatorId) {
            await writeOutbox(
              tx,
              lineStatusChangedMessage({
                event: { id: event.id, name: event.name, assignedCoordinatorId: event.assignedCoordinatorId },
                previous: result.previous,
                updated: result.line,
                actor: req.actor!,
                correlationId: req.header("x-correlation-id") ?? null,
                release: { reason: checked.reason },
              }),
            );
          }
          return result;
        });

        if (outcome.ok) {
          res.json({ reservation: outcome.reservation, line: present(outcome.line) });
          return;
        }
        switch (outcome.code) {
          case "GONE":
            return lineNotFound(res);
          case "LINE_NOT_RELEASABLE":
            return refuse(
              res,
              409,
              "LINE_NOT_RELEASABLE",
              `This line is ${EQUIPMENT_LINE_STATUS_LABELS[outcome.status]}. Only a Reserved line's reservation can be released.`,
              undefined,
              { status: outcome.status },
            );
          case "ALREADY_RELEASED":
            return refuse(res, 409, "RESERVATION_ALREADY_RELEASED", "This reservation has already been released.");
          default: {
            const unreachable: never = outcome;
            throw new Error(`Unhandled release outcome: ${JSON.stringify(unreachable)}`);
          }
        }
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
