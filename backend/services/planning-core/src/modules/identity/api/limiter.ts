import type { Request, RequestHandler, Response } from "express";
import { rateLimit } from "express-rate-limit";
import type { ErrorCode } from "@connectsphere/contracts";

/**
 * Rate limits for the identity routes, applied before any token check, Supabase
 * call or query (CodeQL js/missing-rate-limiting).
 *
 * ADR-0011 puts rate limits at the gateway (EN-12), which isn't built. Until it
 * is, each module carries its own, as equipment and the venue calendar do.
 * Remove these once the gateway limits requests. Express keeps trust proxy
 * disabled, so a forwarded header can't choose the key.
 *
 * Sign-in is limited per address separately from the rest. Supabase Auth has its
 * own limit on password grants, so this one mainly stops a flood from reaching
 * Supabase and the login audit. Thirty a minute leaves room for the functional
 * test runner, which signs in once per case.
 */

const MINUTE = 60_000;
const RATE_LIMITED = "RATE_LIMITED" satisfies ErrorCode;

function refuseWith(message: string) {
  return (req: Request, res: Response) => {
    res.status(429).json({
      error: { code: RATE_LIMITED, message, correlationId: req.header("x-correlation-id") ?? null },
    });
  };
}

interface LimitOptions {
  /** Requests allowed per address per minute. */
  limit?: number;
}

export function loginRateLimiter({ limit = 30 }: LimitOptions = {}): RequestHandler {
  return rateLimit({
    windowMs: MINUTE,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: refuseWith("Too many sign-in attempts. Wait a minute and try again."),
  });
}

export function identityRateLimiter({ limit = 120 }: LimitOptions = {}): RequestHandler {
  return rateLimit({
    windowMs: MINUTE,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: refuseWith("Too many requests. Wait a minute and try again."),
  });
}
