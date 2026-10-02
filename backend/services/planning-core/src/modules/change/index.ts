import { Router } from "express";

/**
 * The change and readiness module's public interface (ADR-0004). Other modules import
 * this file and nothing else under modules/change; `npm run lint:boundaries`
 * fails the build if they reach past it.
 *
 * Empty until its first story lands (F5, G2, S1, S2, S3).
 * Routers go in api/, pure rules in domain/, SQL against the `change` schema only
 * in repo/, and outbox writers and consumers in events/. Add a `sql` parameter
 * to the router when the first route needs the database.
 */
export function changeRouter(): Router {
  return Router();
}
