import type { RequestHandler } from "express";
import { rateLimit } from "express-rate-limit";
import { refuse } from "./errors.js";

/**
 * One 120/minute budget per client IP, applied before JWT, identity and SQL
 * work (the same policy as the equipment and venue routers). Routers take it as
 * a parameter so a test can pass a no-op. Express keeps trust proxy disabled, so
 * forwarded headers cannot choose the key.
 */
export function eventRateLimiter(): RequestHandler {
  return rateLimit({
    windowMs: 60_000,
    limit: 120,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    handler: (_req, res) =>
      refuse(res, 429, "RATE_LIMITED", "Too many event requests. Try again after the Retry-After period."),
  });
}
