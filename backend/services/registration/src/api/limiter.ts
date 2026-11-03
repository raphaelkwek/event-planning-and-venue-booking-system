import type { RequestHandler } from "express";
import { rateLimit } from "express-rate-limit";
import { refuse } from "./errors.js";

const DEFAULT_LIMIT_PER_MINUTE = 120;

/**
 * One 120-a-minute budget per client address across every registration route,
 * applied before the token is checked or identity asked (CodeQL
 * js/missing-rate-limiting), until the gateway limits requests (ADR-0011).
 * Express keeps trust proxy off, so a forwarded header cannot choose the key.
 */
export function registrationRateLimiter(limit = DEFAULT_LIMIT_PER_MINUTE): RequestHandler {
  return rateLimit({
    windowMs: 60_000,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, res) => refuse(res, 429, "RATE_LIMITED", "Too many requests. Wait a minute and try again."),
  });
}

/**
 * EN-19: the waiting room's own budget per client address, 240 a minute: a
 * browser polls its place about every 2 seconds (30 a minute), and several
 * attendees can share one address (a campus network). Applied before the
 * token is checked or identity asked, so a flood is turned away without
 * costing either. The gateway limits per address in front of this (EN-12).
 */
export function waitingRoomRateLimiter(): RequestHandler {
  return rateLimit({
    windowMs: 60_000,
    limit: 240,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, res) => refuse(res, 429, "RATE_LIMITED", "Too many requests. Wait a few seconds and try again."),
  });
}
