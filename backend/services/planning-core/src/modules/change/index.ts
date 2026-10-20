import { Router } from "express";
import type { Sql } from "postgres";
import { changeRequestsRouter } from "./api/changeRequests.js";
import { confirmationsRouter } from "./api/confirmations.js";
import { decisionsRouter } from "./api/decisions.js";
import { changeRateLimiter } from "./api/limiter.js";

/** The module's outbox table, for the outbox relay (implementation.md §3.4). */
export { CHANGE_OUTBOX_TABLE } from "./events/outbox.js";

/**
 * The change and readiness module's public interface (ADR-0004). Other modules import
 * this file and nothing else under modules/change; `npm run lint:boundaries`
 * fails the build if they reach past it.
 *
 * Routers go in api/, pure rules in domain/, SQL against the `change` schema only
 * in repo/, and outbox writers and consumers in events/. F5 confirms an event's
 * arrangements here; stories still to come: G2, S3.
 */
export function changeRouter(sql: Sql): Router {
  const router = Router();
  // One limiter instance, so the 120/minute budget spans every change endpoint.
  const limiter = changeRateLimiter();
  router.use(changeRequestsRouter(sql, limiter));
  router.use(decisionsRouter(sql, limiter));
  router.use(confirmationsRouter(sql, limiter));
  return router;
}
