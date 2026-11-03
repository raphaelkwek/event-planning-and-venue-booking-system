import { Router, type NextFunction, type RequestHandler, type Response } from "express";
import { rateLimit } from "express-rate-limit";
import type { Sql } from "postgres";
import { authenticate, requireRole, type ActorRequest } from "../auth/actor.js";
import { etag, readIfMatch } from "../domain/eventDetails.js";
import {
  changedSettings,
  maySetRegistration,
  notSettableMessage,
  readRegistrationSettings,
  registrationSettableIn,
} from "../domain/registrationSettings.js";
import { writeListingChanged } from "../events/listing.js";
import { recordFieldChanges } from "../repo/eventHistory.js";
import { findEventInScope } from "../repo/events.js";
import { lockRegistrationSettings, saveRegistrationSettings } from "../repo/registrationSettings.js";
import { refuse } from "./errors.js";

/**
 * R2, R4 — the owning organiser sets their event's registration settings:
 * whether attendees register, the window (R2) and an optional withdrawal
 * deadline (R4). Allowed from approval until the event is over, as G1's edit
 * is, and guarded the same way: the version the organiser loaded travels in
 * If-Match, the row is locked and every check repeated before anything is
 * written. The settings, a history entry per changed setting, and the event's
 * `event.listing-changed` message for the registration service are written in
 * one transaction.
 */

const NOT_PERMITTED = "Only the owning organiser can change this event's registration settings.";
const STALE =
  "This event was changed after you opened it, so nothing was saved. Load the latest version, then make your change again.";
const INVALID = "The registration settings could not be saved. Check the highlighted fields.";

/**
 * At most 60 saves a minute from one address, refused before any identity
 * lookup or query (CodeQL js/missing-rate-limiting), until the gateway limits
 * requests (ADR-0011).
 */
export function registrationSettingsRateLimit(): RequestHandler {
  return rateLimit({
    windowMs: 60_000,
    limit: 60,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, res) => refuse(res, 429, "RATE_LIMITED", "Too many changes. Wait a minute and try again."),
  });
}

export function registrationSettingsRouter(sql: Sql, limiter: RequestHandler = registrationSettingsRateLimit()) {
  const router = Router();

  router.put(
    "/api/v1/events/:id/registration-settings",
    limiter,
    ...authenticate,
    requireRole("EVENT_ORGANISER"),
    async (req: ActorRequest, res: Response, next: NextFunction) => {
      try {
        const actor = req.actor!;
        const event = await findEventInScope(sql, req.params.id!, actor.scope, actor.userId);
        if (!event) return refuse(res, 404, "EVENT_NOT_FOUND", "No event with that reference is available to you.");
        if (!maySetRegistration(actor, event)) return refuse(res, 403, "ROLE_NOT_AUTHORISED", NOT_PERMITTED);
        if (!registrationSettableIn(event.status)) return refuse(res, 409, "EVENT_NOT_EDITABLE", notSettableMessage(event.status));

        const read = readRegistrationSettings(req.body, event.proposedStartAt);
        if (!read.ok) return refuse(res, 400, "VALIDATION_FAILED", INVALID, { fields: read.fields });

        const expected = readIfMatch(req.header("if-match"));
        if (expected === "MISSING") {
          return refuse(res, 428, "EVENT_VERSION_REQUIRED", "Send the version of the event you are changing in If-Match. Nothing was saved.");
        }
        if (expected !== event.version) return refuse(res, 412, "EVENT_VERSION_MISMATCH", STALE);

        const outcome = await sql.begin(async (tx) => {
          const locked = await lockRegistrationSettings(tx, event.id);
          if (!locked || locked.version !== expected) return { code: "STALE" } as const;
          if (!maySetRegistration(actor, locked)) return { code: "NOT_PERMITTED" } as const;
          if (!registrationSettableIn(locked.status)) return { code: "NOT_SETTABLE", status: locked.status } as const;

          const changes = changedSettings(locked.settings, read.settings);
          if (changes.length === 0) return { code: "UNCHANGED" } as const;
          await saveRegistrationSettings(tx, event.id, read.settings, actor.userId);
          await recordFieldChanges(tx, event.id, changes, actor, "UPDATE_REGISTRATION_SETTINGS");
          await writeListingChanged(tx, event.id, actor, req.header("x-correlation-id") ?? null);
          return { code: "SAVED" } as const;
        });

        if (outcome.code === "STALE") return refuse(res, 412, "EVENT_VERSION_MISMATCH", STALE);
        if (outcome.code === "NOT_PERMITTED") return refuse(res, 403, "ROLE_NOT_AUTHORISED", NOT_PERMITTED);
        if (outcome.code === "NOT_SETTABLE") return refuse(res, 409, "EVENT_NOT_EDITABLE", notSettableMessage(outcome.status));

        const saved = (await findEventInScope(sql, event.id, actor.scope, actor.userId))!;
        res.set("ETag", etag(saved.version)).status(200).json(saved);
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
