import type { RequestHandler } from "express";
import { rateLimit } from "express-rate-limit";
import { refuse } from "./errors.js";

/**
 * One 120/minute budget per client IP, applied before JWT/identity/SQL work. changeRouter
 * passes the same instance to every change route so the budget spans them.
 * Express keeps trust proxy disabled; forwarded headers cannot choose the key.
 */
export function changeRateLimiter(): RequestHandler {
  return rateLimit({
    windowMs: 60_000,
    limit: 120,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    handler: (_req, res) => refuse(res, 429, "RATE_LIMITED", "Too many change-request requests. Try again after the Retry-After period."),
  });
}
