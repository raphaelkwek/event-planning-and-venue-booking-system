import { Router } from "express";
import type { Sql } from "postgres";
import { availabilityRouter } from "./api/availability.js";

/** Equipment public boundary (ADR-0004). SQL remains inside the equipment module. */
export function equipmentRouter(sql: Sql): Router {
  const router = Router();
  router.use(availabilityRouter(sql));
  return router;
}
