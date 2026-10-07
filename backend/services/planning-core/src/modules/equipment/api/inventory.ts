import { Router, type NextFunction, type Response } from "express";
import type { Sql } from "postgres";
import { authenticate, requireRole, type ActorRequest } from "../auth/actor.js";
import {
  InventoryReductionConflictError,
  UnavailabilityExceedsTotalError,
  validateEquipmentType,
  validateUnavailability,
  type EquipmentTypeInput,
} from "../domain/inventory.js";
import {
  findEquipmentType,
  insertEquipmentType,
  insertUnavailability,
  listEquipmentTypes,
  listInventoryHistory,
  listUnavailability,
  lockEquipmentTypeRecord,
  updateEquipmentType,
} from "../repo/inventory.js";
import { fieldsFromZod, refuse } from "./errors.js";
import { equipmentTypeBodySchema, unavailabilityBodySchema } from "./schemas.js";

const READERS = ["EVENT_COORDINATOR", "TECH_SUPPORT_STAFF"] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function notFound(res: Response) {
  refuse(res, 404, "EQUIPMENT_TYPE_NOT_FOUND", "No equipment type with that id exists.");
}

function readEquipmentType(req: ActorRequest, res: Response): EquipmentTypeInput | null {
  const shape = equipmentTypeBodySchema.safeParse(req.body);
  if (!shape.success) {
    refuse(res, 400, "VALIDATION_FAILED", "The equipment type could not be saved. Check the highlighted fields.", fieldsFromZod(shape.error));
    return null;
  }
  const result = validateEquipmentType(shape.data);
  if (!result.ok) {
    refuse(res, 400, "VALIDATION_FAILED", "The equipment type could not be saved. Check the highlighted fields.", result.fields);
    return null;
  }
  return result.equipmentType;
}

async function detail(sql: Sql, id: string) {
  const equipmentType = await findEquipmentType(sql, id);
  if (!equipmentType) return null;
  const [unavailability, history] = await Promise.all([
    listUnavailability(sql, id),
    listInventoryHistory(sql, id),
  ]);
  return { ...equipmentType, unavailability, history };
}

function handleInventoryError(error: unknown, res: Response, next: NextFunction) {
  if (error instanceof InventoryReductionConflictError) {
    refuse(res, 409, error.code, error.message, undefined, {
      proposedQuantity: error.proposedQuantity,
      affectedReservations: error.affectedReservations,
    });
    return;
  }
  if (error instanceof UnavailabilityExceedsTotalError) {
    refuse(
      res,
      422,
      error.code,
      error.message,
      [{ field: "quantity", message: error.message }],
      { requested: error.requested, totalQuantity: error.totalQuantity },
    );
    return;
  }
  next(error);
}

/** P2 inventory HTTP surface. Every write role-check happens before any SQL. */
export function inventoryRouter(sql: Sql) {
  const router = Router();

  router.get("/api/v1/equipment/types", authenticate, requireRole(...READERS), async (_req: ActorRequest, res: Response, next: NextFunction) => {
    try {
      const items = await listEquipmentTypes(sql);
      res.json({ items: items.map(({ units: _units, unitLabels: _labels, ...item }) => item), nextCursor: null });
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/v1/equipment/types/:id", authenticate, requireRole(...READERS), async (req: ActorRequest, res: Response, next: NextFunction) => {
    try {
      const record = UUID.test(req.params.id!) ? await detail(sql, req.params.id!) : null;
      if (!record) return notFound(res);
      res.json(record);
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/v1/equipment/types", authenticate, requireRole("TECH_SUPPORT_STAFF"), async (req: ActorRequest, res: Response, next: NextFunction) => {
    const input = readEquipmentType(req, res);
    if (!input) return;
    try {
      const created = await sql.begin((tx) => insertEquipmentType(tx, input, req.actor!));
      res.status(201).json({ ...created, unavailability: [], history: await listInventoryHistory(sql, created.id) });
    } catch (error) {
      next(error);
    }
  });

  router.put("/api/v1/equipment/types/:id", authenticate, requireRole("TECH_SUPPORT_STAFF"), async (req: ActorRequest, res: Response, next: NextFunction) => {
    if (!UUID.test(req.params.id!)) return notFound(res);
    const input = readEquipmentType(req, res);
    if (!input) return;
    try {
      const updated = await sql.begin(async (tx) => {
        const current = await lockEquipmentTypeRecord(tx, req.params.id!);
        if (!current) return null;
        if (current.kind !== input.kind) return { kindChanged: true } as const;
        return updateEquipmentType(tx, current, input, req.actor!);
      });
      if (!updated) return notFound(res);
      if ("kindChanged" in updated) {
        refuse(res, 422, "VALIDATION_FAILED", "An equipment type's tracking method cannot be changed.", [
          { field: "kind", message: "An equipment type's tracking method cannot be changed." },
        ]);
        return;
      }
      const record = await detail(sql, updated.id);
      res.json(record);
    } catch (error) {
      handleInventoryError(error, res, next);
    }
  });

  router.post("/api/v1/equipment/types/:id/unavailability", authenticate, requireRole("TECH_SUPPORT_STAFF"), async (req: ActorRequest, res: Response, next: NextFunction) => {
    if (!UUID.test(req.params.id!)) return notFound(res);
    const shape = unavailabilityBodySchema.safeParse(req.body);
    if (!shape.success) {
      refuse(res, 400, "VALIDATION_FAILED", "The unavailability could not be recorded. Check the highlighted fields.", fieldsFromZod(shape.error));
      return;
    }
    try {
      const result = await sql.begin(async (tx) => {
        const equipmentType = await lockEquipmentTypeRecord(tx, req.params.id!);
        if (!equipmentType) return { outcome: "NOT_FOUND" } as const;
        const validation = validateUnavailability({
          ...shape.data,
          startsAt: new Date(shape.data.startsAt),
          endsAt: new Date(shape.data.endsAt),
        }, equipmentType.kind);
        if (!validation.ok) return { outcome: "INVALID", fields: validation.fields } as const;
        const recorded = await insertUnavailability(tx, equipmentType, validation.unavailability, req.actor!);
        return recorded ? { outcome: "CREATED", recorded } as const : { outcome: "UNIT_NOT_FOUND" } as const;
      });
      if (result.outcome === "NOT_FOUND") return notFound(res);
      if (result.outcome === "INVALID") {
        refuse(res, 400, "VALIDATION_FAILED", "The unavailability could not be recorded. Check the highlighted fields.", result.fields);
        return;
      }
      if (result.outcome === "UNIT_NOT_FOUND") {
        refuse(res, 422, "VALIDATION_FAILED", "Choose an active unit belonging to this equipment type.", [
          { field: "unitId", message: "Choose an active unit belonging to this equipment type." },
        ]);
        return;
      }
      res.status(201).json(result.recorded);
    } catch (error) {
      handleInventoryError(error, res, next);
    }
  });

  return router;
}
