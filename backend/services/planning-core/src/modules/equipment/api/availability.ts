import { Router, type NextFunction, type Response } from "express";
import { rateLimit } from "express-rate-limit";
import type { Sql } from "postgres";
import { authenticate, requireRole, type ActorRequest } from "../auth/actor.js";
import { validateAvailabilityQuery } from "../domain/checkAvailability.js";
import { checkEquipmentAvailability, listAvailabilityTypes } from "../repo/checkAvailability.js";
import { refuse } from "./errors.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** P1: technical support checks stock without reserving it. */
export function availabilityRouter(sql: Sql) {
  const router = Router();
  // One budget across this router's endpoints, before JWT/identity/SQL work.
  // Express keeps trust proxy disabled; forwarded headers cannot choose the key.
  const limiter = rateLimit({
    windowMs: 60_000,
    limit: 120,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    handler: (_req, res) => refuse(res, 429, "RATE_LIMIT_EXCEEDED", "Too many equipment requests. Try again after the Retry-After period."),
  });
  router.get("/api/v1/equipment/types", limiter, authenticate, requireRole("TECH_SUPPORT_STAFF"), async (_req: ActorRequest, res: Response, next: NextFunction) => {
    try { res.json({ items: await listAvailabilityTypes(sql), nextCursor: null }); }
    catch (error) { next(error); }
  });
  router.get("/api/v1/equipment/types/:id/availability", limiter, authenticate, requireRole("TECH_SUPPORT_STAFF"), async (req: ActorRequest, res: Response, next: NextFunction) => {
    const validated = validateAvailabilityQuery(req.query);
    if (!validated.ok) {
      refuse(res, 400, "VALIDATION_FAILED", "Availability could not be checked. Check the highlighted fields.", validated.fields);
      return;
    }
    try {
      const result = UUID.test(req.params.id!)
        ? await sql.begin((tx) => checkEquipmentAvailability(tx, req.params.id!, validated.input))
        : null;
      if (!result) { refuse(res, 404, "EQUIPMENT_TYPE_NOT_FOUND", "No equipment type with that id exists."); return; }
      res.json(result);
    } catch (error) { next(error); }
  });
  return router;
}
