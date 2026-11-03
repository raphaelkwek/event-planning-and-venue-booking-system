import { Router, type NextFunction, type RequestHandler, type Response } from "express";
import { evaluateAll } from "../../../shared/flags/index.js";
import { authenticate, type ActorRequest } from "../auth/actor.js";
import { changeRateLimiter } from "./limiter.js";

/**
 * EN-15 — the flags the web app needs, evaluated for the signed-in user. The screens use these to
 * hide or disable an action; the server enforces the same flag on the action itself, so a stale or
 * failed read here changes what the screen shows and nothing else.
 */
export function featureFlagsRouter(limiter: RequestHandler = changeRateLimiter()) {
  const router = Router();

  router.get("/api/v1/feature-flags", limiter, authenticate, async (req: ActorRequest, res: Response, next: NextFunction) => {
    try {
      const actor = req.actor!;
      const flags = await evaluateAll({ targetingKey: actor.userId, role: actor.role });
      res.status(200).json({ flags });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
