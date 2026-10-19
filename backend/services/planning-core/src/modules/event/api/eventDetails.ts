import { Router, type NextFunction, type RequestHandler, type Response } from "express";
import { rateLimit } from "express-rate-limit";
import type { Sql } from "postgres";
import { authenticate, requireRole, type ActorRequest } from "../auth/actor.js";
import {
  changedDetails,
  detailsEditableIn,
  etag,
  mayEditDetails,
  notEditableMessage,
  readDetailsEdit,
  readIfMatch,
} from "../domain/eventDetails.js";
import { lockEventDetails, saveEventDetails } from "../repo/eventDetails.js";
import { recordFieldChanges } from "../repo/eventHistory.js";
import { findEventInScope } from "../repo/events.js";
import { refuse } from "./errors.js";

/**
 * G1 — the owning organiser or the assigned coordinator edits an event's
 * descriptive details while it is Approved, Planning, Safety Review or
 * Confirmed. The significant fields change only through a change request.
 *
 * The edit carries the version the editor loaded (If-Match, ADR-0015). The
 * event row is locked and every check repeated before anything is written, so
 * a stale edit is refused with 412 instead of overwriting a newer one. The
 * changes and one history entry per changed field are written in one
 * transaction: if any part fails, nothing is stored.
 */

const NOT_PERMITTED = "Only the owning organiser or the assigned coordinator can edit this event's details.";
const STALE =
  "This event was changed after you opened it, so nothing was saved. Load the latest version, then make your edit again.";
const CHANGE_REQUEST =
  "The event's date, times, expected attendance, and venue and equipment requirements can be changed only through a change request, because arrangements depend on them. Nothing was saved.";

/**
 * At most 120 edits a minute from one address, refused before any identity
 * lookup or query. A stopgap until the gateway limits requests (ADR-0011,
 * EN-12); CodeQL (js/missing-rate-limiting) requires one.
 */
export function eventDetailsRateLimit(): RequestHandler {
  return rateLimit({
    windowMs: 60_000,
    limit: 120,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, res) => refuse(res, 429, "RATE_LIMITED", "Too many edits. Wait a minute and try again."),
  });
}

export function eventDetailsRouter(sql: Sql) {
  const router = Router();

  router.patch(
    "/api/v1/events/:id",
    eventDetailsRateLimit(),
    ...authenticate,
    requireRole("EVENT_ORGANISER", "EVENT_COORDINATOR"),
    async (req: ActorRequest, res: Response, next: NextFunction) => {
      const actor = req.actor!;
      const event = await findEventInScope(sql, req.params.id!, actor.scope, actor.userId);
      if (!event) return refuse(res, 404, "EVENT_NOT_FOUND", "No event with that reference is available to you.");
      if (!mayEditDetails(actor, event)) return refuse(res, 403, "ROLE_NOT_AUTHORISED", NOT_PERMITTED);
      if (!detailsEditableIn(event.status)) return refuse(res, 409, "EVENT_NOT_EDITABLE", notEditableMessage(event.status));

      const edit = readDetailsEdit(req.body);
      if (!edit.ok && edit.reason === "CHANGE_REQUEST_REQUIRED") {
        return refuse(res, 422, "CHANGE_REQUEST_REQUIRED", CHANGE_REQUEST, { fields: edit.fields });
      }
      if (!edit.ok) return refuse(res, 400, "VALIDATION_FAILED", "The details could not be saved.", { fields: edit.fields });

      const expected = readIfMatch(req.header("if-match"));
      if (expected === "MISSING") {
        return refuse(res, 428, "EVENT_VERSION_REQUIRED", "Send the version of the event you are editing in If-Match. Nothing was saved.");
      }
      if (expected !== event.version) return refuse(res, 412, "EVENT_VERSION_MISMATCH", STALE);

      try {
        const outcome = await sql.begin(async (tx) => {
          const locked = await lockEventDetails(tx, event.id);
          if (!locked || locked.version !== expected) return "STALE" as const;
          if (!mayEditDetails(actor, locked)) return "NOT_PERMITTED" as const;
          if (!detailsEditableIn(locked.status)) return "NOT_EDITABLE" as const;

          const changes = changedDetails(locked.details, edit.changes);
          if (changes.length === 0) return "UNCHANGED" as const;
          await saveEventDetails(tx, event.id, Object.fromEntries(changes.map((c) => [c.fieldName, c.newValue])), actor.userId);
          await recordFieldChanges(tx, event.id, changes, actor, "UPDATE_DETAILS");
          return "SAVED" as const;
        });

        if (outcome === "STALE") return refuse(res, 412, "EVENT_VERSION_MISMATCH", STALE);
        if (outcome === "NOT_PERMITTED") return refuse(res, 403, "ROLE_NOT_AUTHORISED", NOT_PERMITTED);
        if (outcome === "NOT_EDITABLE") {
          const now = await findEventInScope(sql, event.id, actor.scope, actor.userId);
          return refuse(res, 409, "EVENT_NOT_EDITABLE", notEditableMessage(now!.status));
        }

        const saved = (await findEventInScope(sql, event.id, actor.scope, actor.userId))!;
        res.set("ETag", etag(saved.version)).status(200).json(saved);
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
