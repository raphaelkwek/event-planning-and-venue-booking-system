import { Router, type NextFunction, type RequestHandler, type Response } from "express";
import type { Sql } from "postgres";
import { z } from "zod";
import { identityRateLimiter } from "./limiter.js";
import { verifyJwt } from "../../../shared/auth/verifyJwt.js";
import { ROLE_NOT_AUTHORISED_MESSAGE } from "../../../shared/authz/gate.js";
import { findActiveAttendeeByEmail } from "../repo/users.js";
import { requireRole, resolveCaller, type CallerRequest } from "../auth/caller.js";

/**
 * R7 — finds the attendee an organiser or coordinator names by email, so the
 * registration service, which stores only ids (ADR-0005), can add them to an
 * event. Internal staff only (Cerbos: user `view`, as for GET /users), and only the fields needed to name someone.
 * Answers a list of at most one, so "no such attendee" is an empty list rather
 * than an error.
 */

const emailSchema = z.string().trim().email("give the attendee's email address").max(254);

export function attendeesRouter(sql: Sql, limiter: RequestHandler = identityRateLimiter()) {
  const router = Router();

  router.get(
    "/api/v1/attendees",
    limiter,
    verifyJwt,
    // A user with no role is refused as not authorised, as on GET /users.
    resolveCaller(sql, { code: "ROLE_NOT_AUTHORISED", message: ROLE_NOT_AUTHORISED_MESSAGE }),
    requireRole("user", "view"),
    async (req: CallerRequest, res: Response, next: NextFunction) => {
      try {
        const correlationId = req.header("x-correlation-id") ?? null;
        const email = emailSchema.safeParse(req.query.email);
        if (!email.success) {
          res.status(400).json({
            error: {
              code: "VALIDATION_FAILED",
              message: "Give the attendee's email address.",
              fields: [{ field: "email", message: email.error.issues[0]!.message }],
              correlationId,
            },
          });
          return;
        }
        const attendee = await findActiveAttendeeByEmail(sql, email.data);
        res.status(200).json({ items: attendee ? [attendee] : [] });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
