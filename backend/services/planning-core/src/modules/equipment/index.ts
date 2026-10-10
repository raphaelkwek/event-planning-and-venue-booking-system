import { Router } from "express";
import type { Sql } from "postgres";
import { availabilityRouter } from "./api/availability.js";
import { inventoryRouter } from "./api/inventory.js";
import { equipmentRateLimiter } from "./api/limiter.js";

/**
 * The equipment module's public interface (ADR-0004). Other modules import
 * this file and nothing else under modules/equipment; `npm run lint:boundaries`
 * fails the build if they reach past it.
 *
 * Routers go in api/, pure rules in domain/, SQL against the `equipment` schema only
 * in repo/, and outbox writers and consumers in events/.
 */
export function equipmentRouter(sql: Sql): Router {
  const router = Router();
  // P2 first: both routers declare GET /api/v1/equipment/types, and P2's is the
  // superset (more fields, readable by coordinators) that main already serves.
  // One limiter instance, so the 120/minute budget spans every equipment endpoint.
  const limiter = equipmentRateLimiter();
  router.use(inventoryRouter(sql, limiter));
  router.use(availabilityRouter(sql, limiter));
  return router;
}
