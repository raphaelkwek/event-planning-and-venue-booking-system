import { Router } from "express";
import type { Sql } from "postgres";

/**
 * The venue module's public interface (ADR-0004). Other modules import this
 * file and nothing else under modules/venue; `npm run lint:boundaries` fails
 * the build if they reach past it.
 *
 * Empty until its first story lands (H1, H2, I1, I2, J1, J2, K1, K2, L1–L3, M1, M2, N1, N2). Routers go in api/, pure
 * rules in domain/, SQL against the `venue` schema only in repo/, and outbox
 * writers and consumers in events/.
 */
export function venueRouter(_sql: Sql): Router {
  return Router();
}
