import type { NextFunction, Response } from "express";
import type { Role } from "@connectsphere/contracts";
import { verifyJwt, type AuthenticatedRequest } from "../../../shared/auth/verifyJwt.js";
import { permissionGate, type PermissionGate, type PolicyKind } from "../../../shared/authz/gate.js";
import { IdentityRefusedError, IdentityUnavailableError, resolveCurrentUser } from "./identity.js";
import { refuse } from "../api/errors.js";

export interface ActorRequest extends AuthenticatedRequest {
  actor?: { userId: string; role: Role };
}

/** Runs after verifyJwt: the token proves identity; the identity module supplies the role. */
async function resolveActor(req: ActorRequest, res: Response, next: NextFunction) {
  try {
    const user = await resolveCurrentUser(req.auth!.supabaseUserId);
    req.actor = { userId: user.id, role: user.role };
    next();
  } catch (error) {
    if (error instanceof IdentityUnavailableError) {
      refuse(res, 503, "IDENTITY_UNAVAILABLE", "Your permissions could not be verified because the identity service is unavailable. Nothing was changed.");
      return;
    }
    if (error instanceof IdentityRefusedError) {
      refuse(res, error.status, error.code, error.message);
      return;
    }
    next(error);
  }
}

export const authenticate = [verifyJwt, resolveActor];

/**
 * A2 through the policies (EN-07, ADR-0010): the caller's role must be one the
 * Cerbos policies permit for `action` on `kind`. The policy decision point
 * answers; no route lists roles any more. A role no rule grants is refused with
 * 403 ROLE_NOT_AUTHORISED, an unanswered check with 503 POLICY_UNAVAILABLE.
 */
export function requireRole(kind: PolicyKind, action: string): PermissionGate {
  return permissionGate({ kind, action }, (_req, res, status, code, message) => refuse(res, status, code, message));
}
