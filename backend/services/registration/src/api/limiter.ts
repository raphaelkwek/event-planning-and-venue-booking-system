import type { RequestHandler } from "express";
import { rateLimit } from "express-rate-limit";
import { refuse } from "./errors.js";

/**
 * One 120-a-minute budget per client address across every registration route,
 * applied before the token is checked or identity asked (CodeQL
 * js/missing-rate-limiting), until the gateway limits requests (ADR-0011).
 * Express keeps trust proxy off, so a forwarded header cannot choose the key.
 */
export function registrationRateLimiter(): RequestHandler {
  return rateLimit({
    windowMs: 60_000,
    limit: 120,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, res) => refuse(res, 429, "RATE_LIMITED", "Too many requests. Wait a minute and try again."),
  });
}
