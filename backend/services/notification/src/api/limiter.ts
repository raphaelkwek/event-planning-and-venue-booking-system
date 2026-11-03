import type { RequestHandler } from "express";
import { rateLimit } from "express-rate-limit";
import { refuse } from "./errors.js";

/**
 * One 120/minute budget per client IP, applied before authentication, which calls
 * planning-core, and before any query (CodeQL js/missing-rate-limiting). Routers take
 * it as a parameter so a test can pass a no-op. ADR-0011 moves this to the gateway
 * (EN-12); remove it once that limits requests. Express keeps trust proxy disabled,
 * so a forwarded header cannot choose the key.
 */
export function notificationRateLimiter(): RequestHandler {
  return rateLimit({
    windowMs: 60_000,
    limit: 120,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, res) => refuse(res, 429, "RATE_LIMITED", "Too many notification requests. Wait a minute and try again."),
  });
}
