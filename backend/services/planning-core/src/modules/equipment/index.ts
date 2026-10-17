import { Router } from "express";
import type { Sql } from "postgres";
import { availabilityRouter } from "./api/availability.js";
import { inventoryRouter } from "./api/inventory.js";
import { equipmentRateLimiter } from "./api/limiter.js";
import { requestLinesRouter } from "./api/requestLines.js";
import { releasesRouter } from "./api/releases.js";
import { reservationsRouter } from "./api/reservations.js";

/** The module's outbox table, for the outbox relay (implementation.md §3.4). */
export { EQUIPMENT_OUTBOX_TABLE } from "./events/outbox.js";

/** Q2 — F4's release run calls this inside its cancellation transaction (AC1). */
export { releaseEventReservations } from "./repo/releases.js";

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
  router.use(requestLinesRouter(sql, limiter));
  router.use(reservationsRouter(sql, limiter));
  router.use(releasesRouter(sql, limiter));
  return router;
}
