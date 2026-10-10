import { Router, type RequestHandler, type Response } from "express";
import { rateLimit } from "express-rate-limit";
import type { Sql } from "postgres";
import { findEventForPlanning } from "../../event/index.js";
import { authenticate, requireRole, type ActorRequest } from "../auth/actor.js";
import { resolveEventsScope } from "../auth/identity.js";
import { assessSuitability, requirementsFromEvent } from "../domain/suitability.js";
import { findVenue } from "../repo/venues.js";
import { refuse } from "./errors.js";

/**
 * K1 — whether a venue suits an event, and why not. Advisory: it reads the
 * event (through the event module's public interface, ADR-0004) and the venue
 * catalogue and writes nothing, so it creates, changes and blocks no booking.
 * Only Event Coordinators run it (Cerbos: venue `check_suitability`).
 *
 * The assessment is against the event's own requirements. When L1 and L4 land
 * (CR-03), each booking request's requirements are passed to `assessSuitability`
 * in their place; the rules don't change.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * At most 120 suitability checks a minute from one address, refused before any
 * identity lookup or query (CodeQL js/missing-rate-limiting). ADR-0011 moves
 * this to the gateway (EN-12); remove it once that limits requests.
 */
export function suitabilityRateLimit(): RequestHandler {
  return rateLimit({
    windowMs: 60_000,
    limit: 120,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, res) => refuse(res, 429, "RATE_LIMITED", "Too many suitability checks. Wait a minute and try again."),
  });
}

export function suitabilityRouter(sql: Sql, limiter: RequestHandler = suitabilityRateLimit()) {
  const router = Router();

  router.get(
    "/api/v1/venues/:id/suitability",
    limiter,
    authenticate,
    requireRole("EVENT_COORDINATOR"),
    async (req: ActorRequest, res: Response) => {
      const eventId = req.query.eventId;
      if (typeof eventId !== "string" || !UUID.test(eventId)) {
        return refuse(res, 400, "VALIDATION_FAILED", "Choose the event to check the venue against.", [
          { field: "eventId", message: "Give the event's id." },
        ]);
      }
      const venue = UUID.test(req.params.id!) ? await findVenue(sql, req.params.id!) : null;
      if (!venue) return refuse(res, 404, "VENUE_NOT_FOUND", "No venue with that id exists.");

      const { userId, role } = req.actor!;
      const event = await findEventForPlanning(sql, eventId, resolveEventsScope(role, userId), userId);
      if (!event) return refuse(res, 404, "EVENT_NOT_FOUND", "No event with that id exists.");

      res.json({
        venueId: venue.id,
        venueName: venue.name,
        eventId: event.id,
        eventReference: event.reference,
        ...assessSuitability(requirementsFromEvent(event), venue),
      });
    },
  );

  return router;
}
