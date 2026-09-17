import { Router } from "express";
import type { Sql } from "postgres";
import { z } from "zod";
import { verifyJwt, type AuthenticatedRequest } from "../auth/verifyJwt.js";
import { findRoleForUser, findUserBySupabaseId, findUsersByIds } from "../repo/users.js";

/**
 * Looks users up by id, so the app can show a person — the submitting
 * organiser, the reviewing coordinator (B1, D1) — rather than an id. Other
 * services store only ids (plan.md §4); this is where those become names.
 *
 * Internal staff only, and only the fields needed to name someone.
 */

const MAX_IDS = 100;

const idsSchema = z
  .array(z.string().uuid("every id must be a uuid"))
  .max(MAX_IDS, `at most ${MAX_IDS} ids may be looked up at once`);

export function usersRouter(sql: Sql) {
  const router = Router();

  router.get("/api/v1/users", verifyJwt, async (req: AuthenticatedRequest, res) => {
    const correlationId = req.header("x-correlation-id") ?? null;

    const caller = await findUserBySupabaseId(sql, req.auth!.supabaseUserId);
    if (!caller || !caller.isActive) {
      res.status(401).json({
        error: { code: "UNAUTHENTICATED", message: "No active session for this token.", correlationId },
      });
      return;
    }

    const role = await findRoleForUser(sql, caller.id);
    if (!role || role === "ATTENDEE") {
      res.status(403).json({
        error: {
          code: "ROLE_NOT_AUTHORISED",
          message: "Your role is not authorised to use this function.",
          correlationId,
        },
      });
      return;
    }

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

    res.status(200).json({ items: await findUsersByIds(sql, [...new Set(parsed.data)]) });
  });

  return router;
}
