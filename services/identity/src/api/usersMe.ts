import { Router } from "express";
import type { Sql } from "postgres";
import { verifyJwt, type AuthenticatedRequest } from "../auth/verifyJwt.js";
import { findUserBySupabaseId, findRoleForUser } from "../repo/users.js";

/**
 * Resolves the bearer token to the caller's internal user id and role.
 * Other services need this because they may not query identity's tables
 * (plan.md §2) and the access-scope response carries no user id for a role
 * scoped to ALL.
 */
export function usersMeRouter(sql: Sql) {
  const router = Router();

  router.get("/api/v1/users/me", verifyJwt, async (req: AuthenticatedRequest, res) => {
    const correlationId = req.header("x-correlation-id") ?? null;

    const user = await findUserBySupabaseId(sql, req.auth!.supabaseUserId);
    if (!user || !user.isActive) {
      res.status(401).json({
        error: { code: "UNAUTHENTICATED", message: "No active session for this token.", correlationId },
      });
      return;
    }

    const role = await findRoleForUser(sql, user.id);
    if (!role) {
      res.status(403).json({
        error: { code: "NO_ROLE_ASSIGNED", message: "This user has no assigned role.", correlationId },
      });
      return;
    }

    res.status(200).json({ id: user.id, email: user.email, role });
  });

  return router;
}
