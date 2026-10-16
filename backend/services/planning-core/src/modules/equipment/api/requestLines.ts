import { Router, type NextFunction, type RequestHandler, type Response } from "express";
import type { Sql } from "postgres";
import {
  EQUIPMENT_LINE_STATUS_LABELS,
  type EquipmentRequestLineStatus,
} from "@connectsphere/contracts";
import { findEventForPlanning, type EventPlanningView } from "../../event/index.js";
import { resolveAccessScope } from "../../identity/index.js";
import { authenticate, requireRole, type ActorRequest } from "../auth/actor.js";
import {
  canChangeStatus,
  isEditableByCoordinator,
  validateLine,
  validateNewLines,
  validateStatusChange,
  type EventTimes,
} from "../domain/requestLines.js";
import { lineStatusChangedMessage } from "../events/lineStatusMessage.js";
import { writeOutbox } from "../events/outbox.js";
import {
  applyStatusChange,
  findLine,
  findMissingTypeIds,
  insertLines,
  listLineHistory,
  listLines,
  lockLine,
  markRemoved,
  updateLine,
} from "../repo/requestLines.js";
import { releaseReservation } from "../repo/releases.js";
import { fieldsFromZod, refuse } from "./errors.js";
import { equipmentRateLimiter } from "./limiter.js";
import { present } from "./presentLine.js";
import { createLinesBodySchema, lineBodySchema, listLinesQuerySchema } from "./schemas.js";

/**
 * O1 and O2 — the lines of an event's equipment request.
 *
 * O1: only the event's assigned coordinator records, edits or removes lines (the policy's
 * `assigned_coordinator`), checked here on the server from the event module's public read.
 * O2: only Technical Support changes a line's status. Coordinators and Technical Support read.
 */
const COORDINATOR = "EVENT_COORDINATOR";
const TECH_SUPPORT = "TECH_SUPPORT_STAFF";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BASE = "/api/v1/equipment/request-lines";
/** Q2: the reason recorded when removing a Reserved line releases its reservation. */
const REMOVAL_REASON = "Request line removed";

/** A3: Technical Support see equipment requests and the event timing they depend on, for every event. */
const ALL_EVENTS = { scopeType: "ALL" } as const;

function lineNotFound(res: Response) {
  refuse(res, 404, "EQUIPMENT_LINE_NOT_FOUND", "No equipment request line with that id exists.");
}

function eventNotFound(res: Response) {
  refuse(res, 404, "EVENT_NOT_FOUND", "No event with that id exists.");
}

function typeNotFound(res: Response, ids: string[]) {
  refuse(
    res,
    404,
    "EQUIPMENT_TYPE_NOT_FOUND",
    "No equipment type with that id exists.",
    undefined,
    { equipmentTypeIds: ids },
  );
}

function notAssigned(res: Response) {
  refuse(res, 403, "ROLE_NOT_AUTHORISED", "Only the event's assigned coordinator can record or change its equipment lines.");
}

function notEditable(res: Response, status: EquipmentRequestLineStatus) {
  refuse(
    res,
    409,
    "EQUIPMENT_LINE_NOT_EDITABLE",
    `This line is ${EQUIPMENT_LINE_STATUS_LABELS[status]}. Only Submitted or Under Review lines can be edited or removed.`,
    undefined,
    { status },
  );
}

const instant = (value: string | null) => (value ? new Date(value) : null);
const eventTimes = (event: EventPlanningView): EventTimes => ({
  startsAt: instant(event.proposedStartAt),
  endsAt: instant(event.proposedEndAt),
});

/** The event, as the assigned coordinator's own authority needs it: null when it does not exist or has no reference yet. */
async function findPlannableEvent(sql: Sql, eventId: string, req: ActorRequest): Promise<EventPlanningView | null> {
  const scope = resolveAccessScope(req.actor!.role, req.actor!.userId, "events");
  const event = await findEventForPlanning(sql, eventId, scope, req.actor!.userId);
  return event && event.reference ? event : null;
}

function isAssignedCoordinator(event: EventPlanningView, req: ActorRequest): boolean {
  return event.assignedCoordinatorId === req.actor!.userId;
}

/** The line as the API shows it: `seq` only orders and pages lists, so it is not part of the line. */
export function requestLinesRouter(sql: Sql, limiter: RequestHandler = equipmentRateLimiter()) {
  const router = Router();

  /** Shared by an edit and a removal: the line, and the event it belongs to, for the assigned coordinator only. */
  async function loadForCoordinator(req: ActorRequest, res: Response) {
    const id = req.params.id!;
    const line = UUID.test(id) ? await findLine(sql, id) : null;
    if (!line) return void lineNotFound(res);
    const event = await findPlannableEvent(sql, line.eventId, req);
    if (!event) return void lineNotFound(res);
    if (!isAssignedCoordinator(event, req)) return void notAssigned(res);
    return { line, event };
  }

  // O1: record a request of one or more lines. Saved whole or not at all.
  router.post(BASE, limiter, authenticate, requireRole(COORDINATOR), async (req: ActorRequest, res: Response, next: NextFunction) => {
    try {
      const body = createLinesBodySchema.safeParse(req.body);
      if (!body.success) {
        refuse(res, 400, "VALIDATION_FAILED", "The equipment request could not be saved. Check the highlighted fields.", fieldsFromZod(body.error));
        return;
      }
      const event = await findPlannableEvent(sql, body.data.eventId, req);
      if (!event) return eventNotFound(res);
      if (!isAssignedCoordinator(event, req)) return notAssigned(res);

      const checked = validateNewLines(body.data.lines, eventTimes(event));
      if (!checked.ok) {
        refuse(res, 400, "VALIDATION_FAILED", "The equipment request could not be saved. Check the highlighted fields.", checked.fields);
        return;
      }

      const created = await sql.begin(async (tx) => {
        const missing = await findMissingTypeIds(tx, checked.lines.map((line) => line.equipmentTypeId));
        if (missing.length > 0) return { code: "MISSING_TYPE", missing } as const;
        const lines = await insertLines(tx, { id: event.id, reference: event.reference! }, checked.lines, req.actor!);
        return { code: "OK", lines } as const;
      });
      if (created.code === "MISSING_TYPE") return typeNotFound(res, created.missing);
      res.status(201).json({ items: created.lines.map(present) });
    } catch (error) {
      next(error);
    }
  });

  // O1, O2: the lines of one event (coordinators), or of every event (Technical Support).
  router.get(BASE, limiter, authenticate, requireRole(COORDINATOR, TECH_SUPPORT), async (req: ActorRequest, res: Response, next: NextFunction) => {
    try {
      const query = listLinesQuerySchema.safeParse(req.query);
      if (!query.success) {
        refuse(res, 400, "VALIDATION_FAILED", "The equipment request lines could not be listed. Check the filters.", fieldsFromZod(query.error));
        return;
      }
      if (req.actor!.role === COORDINATOR && !query.data.eventId) {
        refuse(res, 400, "VALIDATION_FAILED", "Say which event's equipment lines to list.", [
          { field: "eventId", message: "Say which event's equipment lines to list." },
        ]);
        return;
      }
      // The event the lines belong to, read through the event module's side-effect-free planning view.
      let event: EventPlanningView | null = null;
      if (query.data.eventId) {
        const scope = req.actor!.role === TECH_SUPPORT ? ALL_EVENTS : resolveAccessScope(req.actor!.role, req.actor!.userId, "events");
        event = await findEventForPlanning(sql, query.data.eventId, scope, req.actor!.userId);
        if (!event || !event.reference) return eventNotFound(res);
      }
      const rows = await listLines(sql, {
        eventId: query.data.eventId,
        status: query.data.status,
        after: query.data.cursor === undefined ? undefined : Number(query.data.cursor),
        limit: query.data.limit + 1,
      });
      const page = rows.slice(0, query.data.limit);
      const nextCursor = rows.length > query.data.limit ? String(page[page.length - 1]!.seq) : null;
      res.json({
        items: page.map(present),
        nextCursor,
        ...(event
          ? {
              event: {
                id: event.id,
                reference: event.reference,
                name: event.name,
                status: event.status,
                proposedStartAt: event.proposedStartAt,
                proposedEndAt: event.proposedEndAt,
                assignedCoordinatorId: event.assignedCoordinatorId,
              },
            }
          : {}),
      });
    } catch (error) {
      next(error);
    }
  });

  router.get(`${BASE}/:id`, limiter, authenticate, requireRole(COORDINATOR, TECH_SUPPORT), async (req: ActorRequest, res: Response, next: NextFunction) => {
    try {
      const line = UUID.test(req.params.id!) ? await findLine(sql, req.params.id!) : null;
      if (!line) return lineNotFound(res);
      res.json({ ...present(line), history: await listLineHistory(sql, line.id) });
    } catch (error) {
      next(error);
    }
  });

  // O1: edit a line while it is Submitted or Under Review.
  router.put(`${BASE}/:id`, limiter, authenticate, requireRole(COORDINATOR), async (req: ActorRequest, res: Response, next: NextFunction) => {
    try {
      const loaded = await loadForCoordinator(req, res);
      if (!loaded) return;
      const body = lineBodySchema.safeParse(req.body);
      if (!body.success) {
        refuse(res, 400, "VALIDATION_FAILED", "The equipment line could not be saved. Check the highlighted fields.", fieldsFromZod(body.error));
        return;
      }
      const checked = validateLine(body.data, eventTimes(loaded.event));
      if (!checked.ok) {
        refuse(res, 400, "VALIDATION_FAILED", "The equipment line could not be saved. Check the highlighted fields.", checked.fields);
        return;
      }

      const outcome = await sql.begin(async (tx) => {
        const current = await lockLine(tx, loaded.line.id);
        if (!current) return { code: "GONE" } as const;
        if (!isEditableByCoordinator(current.status)) return { code: "NOT_EDITABLE", status: current.status } as const;
        const missing = await findMissingTypeIds(tx, [checked.line.equipmentTypeId]);
        if (missing.length > 0) return { code: "MISSING_TYPE", missing } as const;
        return { code: "OK", line: await updateLine(tx, current, checked.line, req.actor!) } as const;
      });
      if (outcome.code === "GONE") return lineNotFound(res);
      if (outcome.code === "NOT_EDITABLE") return notEditable(res, outcome.status);
      if (outcome.code === "MISSING_TYPE") return typeNotFound(res, outcome.missing);
      res.json(present(outcome.line));
    } catch (error) {
      next(error);
    }
  });

  // O1: removal sets the REMOVED status and records who, when, the type and the quantity. Nothing is deleted.
  // Q2: a Reserved line can be removed too; its reservation is released first and the coordinator's notice says so.
  router.post(`${BASE}/:id/removal`, limiter, authenticate, requireRole(COORDINATOR), async (req: ActorRequest, res: Response, next: NextFunction) => {
    try {
      const loaded = await loadForCoordinator(req, res);
      if (!loaded) return;
      const outcome = await sql.begin(async (tx) => {
        const current = await lockLine(tx, loaded.line.id);
        if (!current) return { code: "GONE" } as const;
        if (current.status === "RESERVED" && current.reservation) {
          const released = await releaseReservation(tx, current.reservation.id, req.actor!, REMOVAL_REASON);
          const line = await markRemoved(tx, current, req.actor!, {
            reservationId: current.reservation.id,
            released: released.ok,
            reason: REMOVAL_REASON,
          });
          if (released.ok && loaded.event.assignedCoordinatorId) {
            await writeOutbox(
              tx,
              lineStatusChangedMessage({
                event: { id: loaded.event.id, name: loaded.event.name, assignedCoordinatorId: loaded.event.assignedCoordinatorId },
                previous: current,
                updated: line,
                actor: req.actor!,
                correlationId: req.header("x-correlation-id") ?? null,
                release: { reason: REMOVAL_REASON },
              }),
            );
          }
          return { code: "OK", line } as const;
        }
        if (!isEditableByCoordinator(current.status)) return { code: "NOT_EDITABLE", status: current.status } as const;
        return { code: "OK", line: await markRemoved(tx, current, req.actor!) } as const;
      });
      if (outcome.code === "GONE") return lineNotFound(res);
      if (outcome.code === "NOT_EDITABLE") return notEditable(res, outcome.status);
      res.json(present(outcome.line));
    } catch (error) {
      next(error);
    }
  });

  // O2: Technical Support updates a line as arrangements are made; the assigned coordinator is told.
  router.post(`${BASE}/:id/status`, limiter, authenticate, requireRole(TECH_SUPPORT), async (req: ActorRequest, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id!;
      if (!UUID.test(id)) return lineNotFound(res);
      const checked = validateStatusChange(lineBodySchema.safeParse(req.body).data ?? {});
      if (!checked.ok) {
        refuse(res, 400, "VALIDATION_FAILED", "The status could not be changed. Check the highlighted fields.", checked.fields);
        return;
      }
      const existing = await findLine(sql, id);
      if (!existing) return lineNotFound(res);
      const event = await findEventForPlanning(sql, existing.eventId, ALL_EVENTS, req.actor!.userId);
      if (!event) return eventNotFound(res);

      const outcome = await sql.begin(async (tx) => {
        const current = await lockLine(tx, id);
        if (!current) return { code: "GONE" } as const;
        if (!canChangeStatus(current.status)) return { code: "NOT_PERMITTED", status: current.status } as const;
        if (checked.change.substituteEquipmentTypeId) {
          const missing = await findMissingTypeIds(tx, [checked.change.substituteEquipmentTypeId]);
          if (missing.length > 0) return { code: "MISSING_TYPE", missing } as const;
        }
        const updated = await applyStatusChange(tx, current, checked.change, req.actor!);
        if (event.assignedCoordinatorId) {
          await writeOutbox(
            tx,
            lineStatusChangedMessage({
              event: { id: event.id, name: event.name, assignedCoordinatorId: event.assignedCoordinatorId },
              previous: current,
              updated,
              actor: req.actor!,
              correlationId: req.header("x-correlation-id") ?? null,
            }),
          );
        }
        return { code: "OK", line: updated } as const;
      });
      if (outcome.code === "GONE") return lineNotFound(res);
      if (outcome.code === "MISSING_TYPE") return typeNotFound(res, outcome.missing);
      if (outcome.code === "NOT_PERMITTED") {
        refuse(
          res,
          409,
          "STATUS_TRANSITION_NOT_PERMITTED",
          `This line is ${EQUIPMENT_LINE_STATUS_LABELS[outcome.status]}, so its status cannot be changed here.`,
          undefined,
          { status: outcome.status },
        );
        return;
      }
      res.json(present(outcome.line));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
