import { Router, type NextFunction, type RequestHandler, type Response } from "express";
import type { Sql } from "postgres";
import { authenticate, requireRole, type ActorRequest } from "../auth/actor.js";
import { etag, readIfMatch } from "../domain/eventDetails.js";
import { highDemandChange, readHighDemand } from "../domain/highDemand.js";
import { maySetRegistration, notSettableMessage, registrationSettableIn } from "../domain/registrationSettings.js";
import { writeListingChanged } from "../events/listing.js";
import { recordFieldChanges } from "../repo/eventHistory.js";
import { findEventInScope } from "../repo/events.js";
import { lockHighDemand, saveHighDemand } from "../repo/highDemand.js";
import { refuse } from "./errors.js";
import { registrationSettingsRateLimit } from "./registrationSettings.js";

/**
 * EN-19 — the owning organiser flags their event high-demand (or takes the
 * flag off). A flagged event makes attendees queue in the registration
 * service's waiting room and register with an admission token. Allowed in the
 * same statuses as the other registration settings, and guarded the same way:
 * the version the organiser loaded travels in If-Match, the row is locked and
 * every check repeated. The flag, a history entry and the event's
 * `event.listing-changed` message (which carries the flag to the registration
 * service) are written in one transaction.
 */

const NOT_PERMITTED = "Only the owning organiser can mark this event as high-demand.";
const STALE =
  "This event was changed after you opened it, so nothing was saved. Load the latest version, then make your change again.";
const INVALID = "The high-demand setting could not be saved. Check the highlighted field.";

export function highDemandRouter(sql: Sql, limiter: RequestHandler = registrationSettingsRateLimit()) {
  const router = Router();

  router.put(
    "/api/v1/events/:id/high-demand",
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

        const read = readHighDemand(req.body);
        if (!read.ok) return refuse(res, 400, "VALIDATION_FAILED", INVALID, { fields: read.fields });

        const expected = readIfMatch(req.header("if-match"));
        if (expected === "MISSING") {
          return refuse(res, 428, "EVENT_VERSION_REQUIRED", "Send the version of the event you are changing in If-Match. Nothing was saved.");
        }
        if (expected !== event.version) return refuse(res, 412, "EVENT_VERSION_MISMATCH", STALE);

        const outcome = await sql.begin(async (tx) => {
          const locked = await lockHighDemand(tx, event.id);
          if (!locked || locked.version !== expected) return { code: "STALE" } as const;
          if (!maySetRegistration(actor, locked)) return { code: "NOT_PERMITTED" } as const;
          if (!registrationSettableIn(locked.status)) return { code: "NOT_SETTABLE", status: locked.status } as const;

          const change = highDemandChange(locked.highDemand, read.highDemand);
          if (!change) return { code: "UNCHANGED" } as const;
          await saveHighDemand(tx, event.id, read.highDemand, actor.userId);
          await recordFieldChanges(tx, event.id, [change], actor, "UPDATE_HIGH_DEMAND");
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
