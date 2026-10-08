import { Router } from "express";
import type { Sql } from "postgres";
import { availabilityRouter } from "./api/availability.js";
import { venuesRouter } from "./api/venues.js";

/**
 * The venue module's public interface (ADR-0004). Other modules import
 * this file and nothing else under modules/venue; `npm run lint:boundaries`
 * fails the build if they reach past it.
 *
 * H1 maintains the catalogue and H2 reads it; I1 is the availability
 * calendar. The search, suitability and booking stories (J, K, L, M, N) add to
 * this module.
 * Routers go in api/, pure rules in domain/, SQL against the `venue` schema
 * only in repo/, and outbox writers and consumers in events/.
 */
export function venueRouter(sql: Sql): Router {
  const router = Router();
  router.use(venuesRouter(sql));
  router.use(availabilityRouter(sql));
  return router;
}
