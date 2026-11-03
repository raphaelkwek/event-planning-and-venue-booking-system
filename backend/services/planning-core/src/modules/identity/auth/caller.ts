import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { Sql } from "postgres";
import type { ErrorCode, Role } from "@connectsphere/contracts";
import type { AuthenticatedRequest } from "../../../shared/auth/verifyJwt.js";
import { permissionGate, type PermissionGate, type PolicyKind } from "../../../shared/authz/gate.js";
import { findRoleForUser, findUserBySupabaseId } from "../repo/users.js";

export interface CallerRequest extends AuthenticatedRequest {
  actor?: { userId: string; role: Role };
}

function send(req: Request, res: Response, status: number, code: ErrorCode, message: string) {
  res.status(status).json({ error: { code, message, correlationId: req.header("x-correlation-id") ?? null } });
}

/**
 * Runs after verifyJwt: the caller's internal id and role, read from identity's
 * own tables. An unknown or deactivated user has no active session (401). A user
 * with no role is refused with `noRole`, which each route keeps as it was.
 */
export function resolveCaller(sql: Sql, noRole: { code: ErrorCode; message: string }): RequestHandler {
  return async (req: CallerRequest, res: Response, next: NextFunction) => {
    try {
      const user = await findUserBySupabaseId(sql, req.auth!.supabaseUserId);
      if (!user || !user.isActive) return send(req, res, 401, "UNAUTHENTICATED", "No active session for this token.");
      const role = await findRoleForUser(sql, user.id);
      if (!role) return send(req, res, 403, noRole.code, noRole.message);
      req.actor = { userId: user.id, role: role as Role };
      next();
    } catch (error) {
      next(error);
    }
  };
}

/** A2 through the policies (EN-07), as in every other module's auth/actor.ts. */
export function requireRole(kind: PolicyKind, action: string): PermissionGate {
  return permissionGate({ kind, action }, send);
}
