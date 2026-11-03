import type { NextFunction, Response } from "express";
import type { AccessScope, Role } from "@connectsphere/contracts";
import { verifyJwt, type AuthenticatedRequest } from "../../../shared/auth/verifyJwt.js";
import { permissionGate, type PermissionGate, type PolicyKind } from "../../../shared/authz/gate.js";
import {
  resolveCurrentUser,
  resolveEventsScope,
  IdentityRefusedError,
  IdentityUnavailableError,
} from "./identity.js";
import { refuse } from "../api/errors.js";

export interface ActorRequest extends AuthenticatedRequest {
  actor?: { userId: string; role: Role; scope: AccessScope };
}

/**
 * Resolves the caller to an internal user id, a role and the access-scope rule
 * to apply (A2, A3). Runs after verifyJwt: the token proves identity, the
 * identity module supplies the role and the scope rule.
 */
async function resolveActor(req: ActorRequest, res: Response, next: NextFunction) {
  const correlationId = req.header("x-correlation-id") ?? null;

  try {
    const user = await resolveCurrentUser(req.auth!.supabaseUserId);
    const scope = await resolveEventsScope(user);

    req.actor = { userId: user.id, role: user.role, scope };
    next();
  } catch (error) {
    if (error instanceof IdentityUnavailableError) {
      refuse(
        res,
        503,
        "IDENTITY_UNAVAILABLE",
        "Your permissions could not be verified because the identity service is unavailable. Nothing was changed.",
        { correlationId }
      );
      return;
    }

    if (error instanceof IdentityRefusedError) {
      const forbidden = error.status === 403;
      refuse(
        res,
        forbidden ? 403 : 401,
        forbidden ? "NO_ROLE_ASSIGNED" : "UNAUTHENTICATED",
        error.message,
        { correlationId }
      );
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
  return permissionGate({ kind, action }, (req, res, status, code, message) =>
    refuse(res, status, code, message, { correlationId: req.header("x-correlation-id") ?? null })
  );
}
