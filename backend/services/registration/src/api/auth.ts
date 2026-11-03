import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { CurrentUser } from "@connectsphere/contracts";
import { refuse } from "./errors.js";

/**
 * Who is calling (implementation.md §6). The service never assumes it was
 * reached through the gateway, and checks the token itself.
 *
 * - Browsing (R1) needs only a valid Supabase token, checked against Supabase's
 *   signing keys here. It asks nobody else, so attendees can browse while
 *   planning-core is down (ADR-0005).
 * - Registering, withdrawing and my registrations (R2 to R4) need to know the
 *   attendee: their internal user id and role. Identity owns those, and this
 *   service may not read its tables, so it asks planning-core's
 *   GET /api/v1/users/me with the caller's token. If identity can't be reached
 *   the request is refused (503) rather than guessed at. Only role ATTENDEE may
 *   use these routes.
 */

export interface Authenticator {
  /** Resolves when the token is a valid, unexpired Supabase token; rejects otherwise. */
  verifyToken(token: string): Promise<void>;
  /** The caller, from identity; rejects with CallerRefusedError or IdentityUnavailableError. */
  identify(token: string): Promise<CurrentUser>;
}

export class CallerRefusedError extends Error {
  constructor(
    readonly status: 401 | 403,
    readonly code: "UNAUTHENTICATED" | "NO_ROLE_ASSIGNED",
    message: string,
  ) {
    super(message);
    this.name = "CallerRefusedError";
  }
}

export class IdentityUnavailableError extends Error {
  constructor(cause: string) {
    super(`Identity could not be asked who this is: ${cause}`);
    this.name = "IdentityUnavailableError";
  }
}

export interface CallerRequest extends Request {
  caller?: CurrentUser;
  /** The caller's bearer token, for asking identity about other people on their behalf (R5, R7). */
  token?: string;
}

function bearer(req: Request): string | null {
  return /^Bearer (.+)$/.exec(req.header("authorization") ?? "")?.[1] ?? null;
}

const NO_TOKEN = "A valid bearer token is required.";

/** R1: any signed-in user, checked locally. */
export function signedIn(auth: Authenticator): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const token = bearer(req);
    if (!token) return refuse(res, 401, "UNAUTHENTICATED", NO_TOKEN);
    auth.verifyToken(token).then(
      () => next(),
      () => refuse(res, 401, "UNAUTHENTICATED", "The bearer token is invalid or expired."),
    );
  };
}

/** R2 to R4, R6: an attendee, as identity knows them. Any other role is refused (A2). */
export function attendeeOnly(auth: Authenticator): RequestHandler {
  return identified(auth, (caller) => caller.role === "ATTENDEE", "Only attendees register for events.");
}

/**
 * R5 to R7: internal staff, as identity knows them. An attendee is refused (A2);
 * whether this member of staff manages the event is the route's to check.
 */
export function staffOnly(auth: Authenticator): RequestHandler {
  return identified(auth, (caller) => caller.role !== "ATTENDEE", "Only the event's organiser or coordinator manages its registrations.");
}

function identified(auth: Authenticator, admits: (caller: CurrentUser) => boolean, refusal: string): RequestHandler {
  return (req: CallerRequest, res: Response, next: NextFunction) => {
    const token = bearer(req);
    if (!token) return refuse(res, 401, "UNAUTHENTICATED", NO_TOKEN);
    auth.identify(token).then(
      (caller) => {
        if (!admits(caller)) return refuse(res, 403, "ROLE_NOT_AUTHORISED", refusal);
        req.caller = caller;
        req.token = token;
        next();
      },
      (error: unknown) => {
        if (error instanceof CallerRefusedError) return refuse(res, error.status, error.code, error.message);
        if (error instanceof IdentityUnavailableError) {
          return refuse(res, 503, "IDENTITY_UNAVAILABLE", "Who you are could not be checked because the identity service is unavailable. Nothing was changed.");
        }
        next(error);
      },
    );
  };
}
