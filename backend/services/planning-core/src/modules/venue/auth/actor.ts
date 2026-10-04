import type { NextFunction, Response } from "express";
import type { Role } from "@connectsphere/contracts";
import { verifyJwt, type AuthenticatedRequest } from "../../../shared/auth/verifyJwt.js";
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

/** A2: the server applies each function's permitted roles whether or not the screen offered it. */
export function requireRole(...permitted: Role[]) {
  return (req: ActorRequest, res: Response, next: NextFunction) => {
    if (!permitted.includes(req.actor!.role)) {
      refuse(res, 403, "ROLE_NOT_AUTHORISED", "Your role is not authorised to use this function.");
      return;
    }
    next();
  };
}
