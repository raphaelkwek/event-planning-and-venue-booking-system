import { Router, type RequestHandler } from "express";
import type { Sql } from "postgres";
import { z } from "zod";
import { EVENT_STATUS_LABELS, KAFKA_TOPICS } from "@connectsphere/contracts";
import { listActiveCoordinators, type ActiveCoordinator } from "../../identity/index.js";
import { authenticate, requireRole, type ActorRequest } from "../auth/actor.js";
import { ASSIGNMENT_NOT_ACTIVE_COORDINATOR, canAssign, LEAD_ASSIGNMENT_RULE } from "../domain/assignment.js";
import { writeOutbox } from "../events/outbox.js";
import {
  countActiveAssignments,
  findActiveAssignment,
  insertAssignment,
  listUnassigned,
  lockEventForAssignment,
  raiseEventVersion,
} from "../repo/assignments.js";
import { eventRateLimiter } from "./eventRateLimiter.js";
import { refuse } from "./errors.js";

/**
 * E3 (CR-05) — the Event Coordinator Lead's unassigned queue, the active
 * coordinators to choose from, and assigning one. Only the Lead reaches these
 * (A2); the Lead coordinates no event (W9-35).
 */

const LEAD = "EVENT_COORDINATOR_LEAD";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const bodySchema = z.object({ coordinatorId: z.string().uuid() });

/** A unique violation: another Lead assigned the event between our lock and insert. */
const isUniqueViolation = (error: unknown) => (error as { code?: string }).code === "23505";

const nameOf = (coordinator: ActiveCoordinator) => coordinator.displayName ?? coordinator.email;

export function leadAssignmentsRouter(sql: Sql, limiter: RequestHandler = eventRateLimiter()) {
  const router = Router();

  router.get("/api/v1/assignments/unassigned", limiter, ...authenticate, requireRole(LEAD), async (_req: ActorRequest, res) => {
    res.status(200).json({ items: await listUnassigned(sql) });
  });

  router.get("/api/v1/coordinators", limiter, ...authenticate, requireRole(LEAD), async (_req: ActorRequest, res) => {
    const coordinators = await listActiveCoordinators(sql);
    const counts = await countActiveAssignments(sql, coordinators.map((c) => c.id));
    res.status(200).json({
      items: coordinators.map((c) => ({ id: c.id, displayName: c.displayName, email: c.email, activeAssignments: counts.get(c.id) ?? 0 })),
    });
  });

  router.post("/api/v1/events/:id/assignment", limiter, ...authenticate, requireRole(LEAD), async (req: ActorRequest, res) => {
    const lead = req.actor!;
    const correlationId = req.header("x-correlation-id") ?? null;
    const notFound = () => refuse(res, 404, "EVENT_NOT_FOUND", "No event with that reference is available to you.");
    if (!UUID.test(req.params.id!)) return notFound();

    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      return refuse(res, 400, "VALIDATION_FAILED", "Choose a coordinator to assign.", {
        fields: [{ field: "coordinatorId", message: "Choose a coordinator to assign." }],
      });
    }
    const coordinator = (await listActiveCoordinators(sql)).find((c) => c.id === parsed.data.coordinatorId);
    if (!coordinator) return refuse(res, 400, "NOT_AN_ACTIVE_COORDINATOR", ASSIGNMENT_NOT_ACTIVE_COORDINATOR);

    const outcome = await sql
      .begin(async (tx) => {
        const event = await lockEventForAssignment(tx, req.params.id!);
        if (!event) return { code: "NOT_FOUND" } as const;
        if (!canAssign(event.status)) return { code: "NOT_ASSIGNABLE", status: event.status } as const;
        const current = await findActiveAssignment(tx, event.id);
        if (current) return { code: "ASSIGNED", coordinatorId: current.coordinatorId } as const;

        const assignment = await insertAssignment(tx, event.id, coordinator.id, LEAD_ASSIGNMENT_RULE, lead.userId);
        await raiseEventVersion(tx, event.id, lead.userId);
        await writeOutbox(tx, {
          topic: KAFKA_TOPICS.event,
          messageType: "event.coordinator-assigned",
          aggregateId: event.id,
          actor: { userId: lead.userId, role: lead.role },
          correlationId,
          payload: {
            eventId: event.id,
            eventReference: event.reference!,
            eventName: event.name,
            coordinatorId: coordinator.id,
            coordinatorName: nameOf(coordinator),
            ownerId: event.ownerId,
            assignedBy: lead.userId,
            assignmentRule: assignment.assignmentRule,
            assignedAt: assignment.assignedAt,
          },
        });
        return { code: "ASSIGNED_NOW", assignment } as const;
      })
      .catch(async (error: unknown) => {
        if (!isUniqueViolation(error)) throw error;
        const current = await findActiveAssignment(sql, req.params.id!);
        return { code: "ASSIGNED", coordinatorId: current!.coordinatorId } as const;
      });

    switch (outcome.code) {
      case "NOT_FOUND":
        return notFound();
      case "NOT_ASSIGNABLE":
        return refuse(res, 409, "STATUS_NOT_ASSIGNABLE", `This event is ${EVENT_STATUS_LABELS[outcome.status]} and cannot be assigned.`);
      case "ASSIGNED": {
        const [named] = (await listActiveCoordinators(sql)).filter((c) => c.id === outcome.coordinatorId);
        const who = named ? nameOf(named) : "another coordinator";
        return refuse(res, 409, "ALREADY_ASSIGNED", `This event is already assigned to ${who}. Reassign it instead.`);
      }
      case "ASSIGNED_NOW":
        return res.status(201).json({
          eventId: req.params.id,
          coordinatorId: outcome.assignment.coordinatorId,
          assignedBy: lead.userId,
          assignedAt: outcome.assignment.assignedAt,
        });
    }
  });

  return router;
}
