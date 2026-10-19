import type { RequestHandler } from "express";
import { rateLimit } from "express-rate-limit";
import { refuse } from "./errors.js";

/**
 * One 120/minute budget per client IP, applied before JWT/identity/SQL work. equipmentRouter
 * passes the same instance to every equipment router so the budget spans all of them.
 * Express keeps trust proxy disabled; forwarded headers cannot choose the key.
 */
export function equipmentRateLimiter(): RequestHandler {
  return rateLimit({
    windowMs: 60_000,
    limit: 120,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    handler: (_req, res) => refuse(res, 429, "RATE_LIMITED", "Too many equipment requests. Try again after the Retry-After period."),
  });
}
