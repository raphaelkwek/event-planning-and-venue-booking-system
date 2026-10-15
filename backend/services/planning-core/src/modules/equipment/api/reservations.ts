import { Router, type NextFunction, type RequestHandler, type Response } from "express";
import type { Sql } from "postgres";
import { EQUIPMENT_LINE_STATUS_LABELS } from "@connectsphere/contracts";
import { findEventForPlanning } from "../../event/index.js";
import { authenticate, requireRole, type ActorRequest } from "../auth/actor.js";
import { InsufficientEquipmentError } from "../domain/availability.js";
import { validateReservationBody } from "../domain/reservations.js";
import { lineStatusChangedMessage } from "../events/lineStatusMessage.js";
import { writeOutbox } from "../events/outbox.js";
import { reserveLine } from "../repo/reservations.js";
import { findLine } from "../repo/requestLines.js";
import { refuse } from "./errors.js";
import { equipmentRateLimiter } from "./limiter.js";
import { present } from "./presentLine.js";

/** Q1 — Technical Support reserve a Confirmed or Substituted line's equipment. */
const TECH_SUPPORT = "TECH_SUPPORT_STAFF";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALL_EVENTS = { scopeType: "ALL" } as const;

const lineNotFound = (res: Response) => refuse(res, 404, "EQUIPMENT_LINE_NOT_FOUND", "No equipment request line with that id exists.");

export function reservationsRouter(sql: Sql, limiter: RequestHandler = equipmentRateLimiter()) {
  const router = Router();

  router.post(
    "/api/v1/equipment/request-lines/:id/reservation",
    limiter,
    authenticate,
    requireRole(TECH_SUPPORT),
    async (req: ActorRequest, res: Response, next: NextFunction) => {
      try {
        const id = req.params.id!;
        if (!UUID.test(id)) return lineNotFound(res);
        const checked = validateReservationBody(req.body ?? {});
        if (!checked.ok) {
          return refuse(res, 400, "VALIDATION_FAILED", "The equipment could not be reserved. Check the highlighted fields.", checked.fields);
        }
        const existing = await findLine(sql, id);
        if (!existing) return lineNotFound(res);
        const event = await findEventForPlanning(sql, existing.eventId, ALL_EVENTS, req.actor!.userId);
        if (!event) return refuse(res, 404, "EVENT_NOT_FOUND", "No event with that id exists.");

        let outcome;
        try {
          outcome = await sql.begin(async (tx) => {
            const result = await reserveLine(tx, id, checked.body, req.actor!);
            if (result.ok && event.assignedCoordinatorId) {
              await writeOutbox(
                tx,
                lineStatusChangedMessage({
                  event: { id: event.id, name: event.name, assignedCoordinatorId: event.assignedCoordinatorId },
                  previous: result.previous,
                  updated: result.line,
                  actor: req.actor!,
                  correlationId: req.header("x-correlation-id") ?? null,
                }),
              );
            }
            return result;
          });
        } catch (error) {
          if (!(error instanceof InsufficientEquipmentError)) throw error;
          return refuse(res, 409, "INSUFFICIENT_EQUIPMENT", error.message, undefined, {
            available: error.available,
            shortfall: error.shortfall,
          });
        }

        if (outcome.ok) {
          res.status(201).json({ reservation: outcome.reservation, line: present(outcome.line) });
          return;
        }
        switch (outcome.code) {
          case "GONE":
            return lineNotFound(res);
          case "VALIDATION_FAILED":
            return refuse(res, 400, "VALIDATION_FAILED", "The equipment could not be reserved. Check the highlighted fields.", outcome.fields);
          case "PARTIAL_NOT_CONFIRMED":
            return refuse(res, 409, "PARTIAL_NOT_CONFIRMED", outcome.message);
          case "LINE_NOT_RESERVABLE":
            return refuse(
              res,
              409,
              "LINE_NOT_RESERVABLE",
              `This line is ${EQUIPMENT_LINE_STATUS_LABELS[outcome.status]}. Only Confirmed or Substituted lines can be reserved.`,
              undefined,
              { status: outcome.status },
            );
          default: {
            const unreachable: never = outcome;
            throw new Error(`Unhandled reservation outcome: ${JSON.stringify(unreachable)}`);
          }
        }
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
