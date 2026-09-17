import { Router } from "express";
import type { Sql } from "postgres";
import { RESOURCES, type Resource } from "@connectsphere/contracts";
import { verifyJwt, type AuthenticatedRequest } from "../auth/verifyJwt.js";
import { findUserBySupabaseId, findRoleForUser } from "../repo/users.js";
import { resolveAccessScope } from "../domain/accessScope.js";

function isResource(value: string): value is Resource {
  return (RESOURCES as readonly string[]).includes(value);
}

export function accessScopeRouter(sql: Sql) {
  const router = Router();

  router.get("/api/v1/access-scope/:resource", verifyJwt, async (req: AuthenticatedRequest, res) => {
    const correlationId = req.header("x-correlation-id") ?? null;
    const { resource } = req.params;

    if (!isResource(resource)) {
      res.status(400).json({
        error: {
          code: "UNKNOWN_RESOURCE",
          message: `"${resource}" is not a resource this endpoint resolves scope for.`,
          correlationId,
        },
      });
      return;
    }

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

    const scope = resolveAccessScope(role as Parameters<typeof resolveAccessScope>[0], user.id, resource);
    res.status(200).json({ scope });
  });

  return router;
}
