import { Router, type RequestHandler } from "express";
import type { Sql } from "postgres";
import { z } from "zod";
import { identityRateLimiter } from "./limiter.js";
import { verifyJwt, type AuthenticatedRequest } from "../../../shared/auth/verifyJwt.js";
import { findActiveAttendeeByEmail, findRoleForUser, findUserBySupabaseId } from "../repo/users.js";

/**
 * R7 — finds the attendee an organiser or coordinator names by email, so the
 * registration service, which stores only ids (ADR-0005), can add them to an
 * event. Internal staff only, and only the fields needed to name someone.
 * Answers a list of at most one, so "no such attendee" is an empty list rather
 * than an error.
 */

const emailSchema = z.string().trim().email("give the attendee's email address").max(254);

export function attendeesRouter(sql: Sql, limiter: RequestHandler = identityRateLimiter()) {
  const router = Router();

  router.get("/api/v1/attendees", limiter, verifyJwt, async (req: AuthenticatedRequest, res, next) => {
    try {
      const correlationId = req.header("x-correlation-id") ?? null;
      const caller = await findUserBySupabaseId(sql, req.auth!.supabaseUserId);
      if (!caller || !caller.isActive) {
        res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "No active session for this token.", correlationId } });
        return;
      }
      const role = await findRoleForUser(sql, caller.id);
      if (!role || role === "ATTENDEE") {
        res.status(403).json({
          error: { code: "ROLE_NOT_AUTHORISED", message: "Your role is not authorised to use this function.", correlationId },
        });
        return;
      }
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
  });

  return router;
}
