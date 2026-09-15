import type { NextFunction, Response } from "express";
import type { AccessScope, Role } from "@connectsphere/contracts";
import { verifyJwt, type AuthenticatedRequest } from "./verifyJwt.js";
import {
  fetchCurrentUser,
  fetchEventsScope,
  IdentityRefusedError,
  IdentityUnavailableError,
} from "./identityClient.js";
import { refuse } from "../api/errors.js";

export interface ActorRequest extends AuthenticatedRequest {
  actor?: { userId: string; role: Role; scope: AccessScope };
}

/**
 * Resolves the caller to an internal user id, a role and the access-scope rule
 * to apply (A2, A3). Runs after verifyJwt: the token proves identity, Identity
 * supplies the role and the scope rule.
 */
async function resolveActor(req: ActorRequest, res: Response, next: NextFunction) {
  const correlationId = req.header("x-correlation-id") ?? null;
  const token = (req.header("authorization") ?? "").slice("Bearer ".length);

  try {
    const [user, scope] = await Promise.all([
      fetchCurrentUser(token, correlationId),
      fetchEventsScope(token, correlationId),
    ]);

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
 * A2 — every protected function has a defined list of permitted roles, and the
 * server applies it whether or not the interface offered the action.
 */
export function requireRole(...permitted: Role[]) {
  return (req: ActorRequest, res: Response, next: NextFunction) => {
    if (!permitted.includes(req.actor!.role)) {
      refuse(res, 403, "ROLE_NOT_AUTHORISED", "Your role is not authorised to use this function.", {
        correlationId: req.header("x-correlation-id") ?? null,
      });
      return;
    }
    next();
  };
}
