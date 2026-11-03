import { Router, type NextFunction, type RequestHandler, type Response } from "express";
import { identityRateLimiter } from "./limiter.js";
import type { Sql } from "postgres";
import { z } from "zod";
import { verifyJwt } from "../../../shared/auth/verifyJwt.js";
import { findUsersByIds } from "../repo/users.js";
import { requireRole, resolveCaller, type CallerRequest } from "../auth/caller.js";
import { ROLE_NOT_AUTHORISED_MESSAGE } from "../../../shared/authz/gate.js";

/**
 * Looks users up by id, so the app can show a person — the submitting
 * organiser, the reviewing coordinator (B1, D1) — rather than an id. Other
 * services store only ids (plan.md §4); this is where those become names.
 *
 * Internal staff only (Cerbos: user `view`), and only the fields needed to name someone.
 */

const MAX_IDS = 100;

const idsSchema = z
  .array(z.string().uuid("every id must be a uuid"))
  .max(MAX_IDS, `at most ${MAX_IDS} ids may be looked up at once`);

export function usersRouter(sql: Sql, limiter: RequestHandler = identityRateLimiter()) {
  const router = Router();

  router.get(
    "/api/v1/users",
    limiter,
    verifyJwt,
    // A user with no role was always refused here as not authorised, before EN-07 too.
    resolveCaller(sql, { code: "ROLE_NOT_AUTHORISED", message: ROLE_NOT_AUTHORISED_MESSAGE }),
    requireRole("user", "view"),
    async (req: CallerRequest, res: Response, next: NextFunction) => {
      const correlationId = req.header("x-correlation-id") ?? null;
      const raw = typeof req.query.ids === "string" ? req.query.ids : "";
      const parsed = idsSchema.safeParse(
        raw
          .split(",")
          .map((id) => id.trim())
          .filter((id) => id.length > 0)
      );
      if (!parsed.success) {
        res.status(400).json({
          error: {
            code: "VALIDATION_FAILED",
            message: parsed.error.issues[0]?.message ?? "The ids are not valid.",
            correlationId,
          },
        });
        return;
      }

      try {
        res.status(200).json({ items: await findUsersByIds(sql, [...new Set(parsed.data)]) });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
