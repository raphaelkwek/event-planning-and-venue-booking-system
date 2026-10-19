import type { NextFunction, Request, Response } from "express";
import type { CurrentUser } from "@connectsphere/contracts";
import { CallerRefusedError, IdentityUnavailableError, resolveCaller } from "./identity.js";
import { refuse } from "./errors.js";

export interface CallerRequest extends Request {
  caller?: CurrentUser;
}

/** Every notification route needs to know whose notifications these are. */
export async function authenticate(req: CallerRequest, res: Response, next: NextFunction) {
  const token = /^Bearer (.+)$/.exec(req.header("authorization") ?? "")?.[1];
  if (!token) {
    refuse(res, 401, "UNAUTHENTICATED", "A valid bearer token is required.");
    return;
  }
  try {
    req.caller = await resolveCaller(token);
    next();
  } catch (error) {
    if (error instanceof CallerRefusedError) {
      refuse(res, error.status, error.code, error.message);
    } else if (error instanceof IdentityUnavailableError) {
      refuse(res, 503, "IDENTITY_UNAVAILABLE", "Who you are could not be checked because the identity service is unavailable. Nothing was changed.");
    } else {
      next(error);
    }
  }
}
