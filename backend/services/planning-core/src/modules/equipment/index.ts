import { Router } from "express";
import type { Sql } from "postgres";
import { inventoryRouter } from "./api/inventory.js";

/**
 * The equipment module's public interface (ADR-0004). Other modules import
 * this file and nothing else under modules/equipment; `npm run lint:boundaries`
 * fails the build if they reach past it.
 *
 * Empty until its first story lands (O1, O2, P1, P2, Q1, Q2).
 * Routers go in api/, pure rules in domain/, SQL against the `equipment` schema only
 * in repo/, and outbox writers and consumers in events/. Add a `sql` parameter
 * to the router when the first route needs the database.
 */
export function equipmentRouter(sql: Sql): Router {
  const router = Router();
  router.use(inventoryRouter(sql));
  return router;
}
