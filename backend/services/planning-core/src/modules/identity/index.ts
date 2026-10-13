import { Router } from "express";
import type { Sql } from "postgres";
import { currentUserSchema, type CurrentUser } from "@connectsphere/contracts";
import { authRouter } from "./api/auth.js";
import { accessScopeRouter } from "./api/accessScope.js";
import { usersMeRouter } from "./api/usersMe.js";
import { usersRouter } from "./api/users.js";
import { identityRateLimiter, loginRateLimiter } from "./api/limiter.js";
import { findRoleForUser, findUserBySupabaseId } from "./repo/users.js";

/**
 * The identity module's public interface (ADR-0004). Other modules import this
 * file and nothing else under modules/identity; `npm run lint:boundaries`
 * fails the build if they reach past it.
 */

export function identityRouter(sql: Sql): Router {
  const router = Router();
  // One instance each, so the budgets span every identity route of their kind.
  const reads = identityRateLimiter();
  router.use(authRouter(sql, loginRateLimiter()));
  router.use(accessScopeRouter(sql, reads));
  router.use(usersMeRouter(sql, reads));
  router.use(usersRouter(sql, reads));
  return router;
}

export type CallerLookup =
  | { outcome: "FOUND"; user: CurrentUser }
  | { outcome: "NO_ACTIVE_USER" }
  | { outcome: "NO_ROLE" };

/**
 * Resolves a verified token's subject to the caller's internal id and role, by
 * the same rules as `GET /api/v1/users/me`: an unknown or deactivated user has
 * no active session, and a user with no role assigned is refused.
 */
export async function lookUpCaller(sql: Sql, supabaseUserId: string): Promise<CallerLookup> {
  const user = await findUserBySupabaseId(sql, supabaseUserId);
  if (!user || !user.isActive) return { outcome: "NO_ACTIVE_USER" };

  const role = await findRoleForUser(sql, user.id);
  if (!role) return { outcome: "NO_ROLE" };

  return { outcome: "FOUND", user: currentUserSchema.parse({ id: user.id, email: user.email, role }) };
}

/** A3 — the access-scope rule a module's repo layer applies for a role and resource. */
export { resolveAccessScope } from "./domain/accessScope.js";
