import { Router } from "express";
import type { Sql } from "postgres";

/**
 * The equipment module's public interface (ADR-0004). Other modules import this
 * file and nothing else under modules/equipment; `npm run lint:boundaries` fails
 * the build if they reach past it.
 *
 * Empty until its first story lands (O1, O2, P1, P2, Q1, Q2). Routers go in api/, pure
 * rules in domain/, SQL against the `equipment` schema only in repo/, and outbox
 * writers and consumers in events/.
 */
export function equipmentRouter(_sql: Sql): Router {
  return Router();
}
