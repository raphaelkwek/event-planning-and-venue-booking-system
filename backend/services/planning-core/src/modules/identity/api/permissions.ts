import { Router, type NextFunction, type RequestHandler, type Response } from "express";
import type { Sql } from "postgres";
import { z } from "zod";
import { verifyJwt } from "../../../shared/auth/verifyJwt.js";
import { POLICY_KINDS, POLICY_UNAVAILABLE_MESSAGE } from "../../../shared/authz/gate.js";
import { pdp, PolicyUnavailableError } from "../../../shared/authz/pdp.js";
import { logger } from "../../../shared/logger.js";
import { identityRateLimiter } from "./limiter.js";
import { resolveCaller, type CallerRequest } from "../auth/caller.js";

/**
 * EN-07 (ADR-0010): what the signed-in caller's role may do, answered by the
 * same Cerbos policies the services enforce. The staff console asks this once
 * per session for the resource and action behind each screen, and offers only
 * what comes back allowed (A2's navigation). It holds no role list of its own.
 *
 * The principal is always the verified caller. The body names only kinds and
 * actions, and anything else in it is ignored, so nobody can ask on someone
 * else's behalf. The policy decision point itself is never exposed.
 *
 * `allowed` is true when the role may take the action on at least some records
 * (`reach` ALWAYS or CONDITIONAL); which records is the server's to decide, per
 * record, when the action is taken.
 */

export const MAX_CHECKS = 50;

const ACTION = /^[a-z][a-z_]{0,63}$/;

const bodySchema = z.object({
  checks: z
    .array(
      z.object({
        kind: z.enum(POLICY_KINDS),
        action: z.string().regex(ACTION, "an action is lower-case letters and underscores"),
      })
    )
    .min(1, "ask about at least one action")
    .max(MAX_CHECKS, `ask about at most ${MAX_CHECKS} actions at once`),
});

export function permissionsRouter(sql: Sql, limiter: RequestHandler = identityRateLimiter()) {
  const router = Router();

  router.post(
    "/api/v1/permissions/check",
    limiter,
    verifyJwt,
    resolveCaller(sql, { code: "NO_ROLE_ASSIGNED", message: "This user has no assigned role." }),
    async (req: CallerRequest, res: Response, next: NextFunction) => {
      const correlationId = req.header("x-correlation-id") ?? null;
      const parsed = bodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: {
            code: "VALIDATION_FAILED",
            message: "The permission checks are not valid.",
            fields: parsed.error.issues.map((issue) => ({ field: issue.path.join(".") || "body", message: issue.message })),
            correlationId,
          },
        });
        return;
      }

      const { userId, role } = req.actor!;
      try {
        const results = await Promise.all(
          parsed.data.checks.map(async ({ kind, action }) => {
            const reach = await pdp.reach({ id: userId, role }, kind, action);
            return { kind, action, allowed: reach !== "NEVER", reach };
          })
        );
        res.status(200).json({ results });
      } catch (error) {
        if (!(error instanceof PolicyUnavailableError)) return next(error);
        logger.error("permission check failed closed", { correlationId, code: "POLICY_UNAVAILABLE", message: error.message });
        res.status(503).json({ error: { code: "POLICY_UNAVAILABLE", message: POLICY_UNAVAILABLE_MESSAGE, correlationId } });
      }
    }
  );

  return router;
}
