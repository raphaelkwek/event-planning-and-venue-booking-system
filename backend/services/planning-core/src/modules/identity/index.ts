import { Router } from "express";
import type { Sql, TransactionSql } from "postgres";
import { currentUserSchema, type CurrentUser, type Role } from "@connectsphere/contracts";
import { authRouter } from "./api/auth.js";
import { accessScopeRouter } from "./api/accessScope.js";
import { usersMeRouter } from "./api/usersMe.js";
import { usersRouter } from "./api/users.js";
import { permissionsRouter } from "./api/permissions.js";
import { attendeesRouter } from "./api/attendees.js";
import { IP_FLOOD_LIMIT, identityRateLimiter, loginRateLimiter, subjectRateLimiter } from "./api/limiter.js";
import { findActiveUserWithRole, findRoleForUser, findUserBySupabaseId, listActiveUsersWithRole } from "./repo/users.js";

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
  router.use(usersMeRouter(sql, identityRateLimiter({ limit: IP_FLOOD_LIMIT }), subjectRateLimiter()));
  router.use(usersRouter(sql, reads));
  // EN-07: what the caller may do, from the same policies, for the staff console's navigation.
  router.use(permissionsRouter(sql, reads));
  // R7: the registration service finds the attendee an organiser adds by hand.
  router.use(attendeesRouter(sql, reads));
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

/**
 * A3 — the access-scope rule a module's repo layer applies for a role and resource.
 * A4 — the 404 message for an event, or a record on one, the scope did not find.
 */
export { notInScopeMessage, resolveAccessScope, type EventRecordKind } from "./domain/accessScope.js";

/** E3, E5: who may be assigned an event — the active Event Coordinators, named. */
export interface ActiveCoordinator {
  id: string;
  displayName: string | null;
  email: string;
}

export function listActiveCoordinators(sql: Sql): Promise<ActiveCoordinator[]> {
  return listActiveUsersWithRole(sql, "EVENT_COORDINATOR");
}

/**
 * Team decision D-02 (clarifications.md): the ids of every active holder of `role`, for a message
 * that must name the Leads, Safety Officers or Technical Support Staff it notifies (implementation.md
 * §3.5). Called inside the transaction that writes the message, so it reads the same snapshot.
 */
export async function listActiveUserIdsWithRole(sql: Sql | TransactionSql, role: Role): Promise<string[]> {
  return (await listActiveUsersWithRole(sql, role)).map((user) => user.id);
}

/**
 * E3, E4: the coordinator if they are still an active Event Coordinator. Called inside the
 * assigning transaction it share-locks their row, so deactivating them waits for the assignment.
 */
export function findActiveCoordinator(sql: Sql | TransactionSql, userId: string, options: { lock?: "share" } = {}): Promise<ActiveCoordinator | null> {
  return findActiveUserWithRole(sql, userId, "EVENT_COORDINATOR", options);
}
