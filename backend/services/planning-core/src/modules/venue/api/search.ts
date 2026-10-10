import { Router, type NextFunction, type RequestHandler, type Response } from "express";
import { rateLimit } from "express-rate-limit";
import type { Sql } from "postgres";
import { findEventForPlanning } from "../../event/index.js";
import { authenticate, requireRole, type ActorRequest } from "../auth/actor.js";
import { eventsScopeFor } from "../auth/identity.js";
import { prefillFromEvent } from "../domain/searchPrefill.js";
import { describeFilters, emptyResultMessage, readSearchFilters } from "../domain/venueSearch.js";
import { listCatalogueOptions, searchVenues } from "../repo/venueSearch.js";
import { refuse } from "./errors.js";

/**
 * J1, J2 — find a venue that could host an event, by name or building and by
 * the event's requirements. Event Coordinators only: the policy action is
 * `search` on `venue` (policies/resources/venue.yaml), and every other role is
 * refused here whatever the screen offers (A2).
 *
 * An empty result is a 200 with a message restating the filters, not an error
 * (J1 AC7). A search with nothing chosen lists every active venue (J2 AC4).
 */
const SEARCHERS = ["EVENT_COORDINATOR"] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * At most 120 venue searches a minute from one address, refused before any
 * identity lookup or query. ADR-0011 puts rate limits at the gateway (EN-12),
 * which isn't built yet; until it is, these routes carry their own, and CodeQL
 * (js/missing-rate-limiting) requires one. Remove it once the gateway limits
 * requests.
 */
export function searchRateLimit(): RequestHandler {
  return rateLimit({
    windowMs: 60_000,
    limit: 120,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, res) => refuse(res, 429, "RATE_LIMITED", "Too many venue searches. Wait a minute and try again."),
  });
}

/** Passes an unexpected failure to Express's error handler instead of leaving the request hanging. */
const guarded =
  (handler: (req: ActorRequest, res: Response) => Promise<void>) => (req: ActorRequest, res: Response, next: NextFunction) =>
    handler(req, res).catch(next);

export function searchRouter(sql: Sql, limiter: RequestHandler = searchRateLimit()) {
  const router = Router();

  router.get(
    "/api/v1/venues/search",
    limiter,
    authenticate,
    requireRole(...SEARCHERS),
    guarded(async (req, res) => {
      const parsed = readSearchFilters(req.query);
      if (!parsed.ok) {
        refuse(res, 400, "VALIDATION_FAILED", "The venues could not be searched. Check the highlighted fields.", parsed.fields);
        return;
      }
      const items = await searchVenues(sql, parsed.filters);
      res.json({
        items,
        nextCursor: null,
        filters: parsed.filters,
        appliedFilters: describeFilters(parsed.filters),
        message: items.length === 0 ? emptyResultMessage(parsed.filters) : null,
      });
    }),
  );

  // The choices the filters offer: what the active venues actually record.
  router.get(
    "/api/v1/venues/search/options",
    limiter,
    authenticate,
    requireRole(...SEARCHERS),
    guarded(async (_req, res) => {
      res.json(await listCatalogueOptions(sql));
    }),
  );

  // J1 AC8: the filters an event's recorded requirements give, for the screen to start from.
  router.get(
    "/api/v1/venues/search/prefill",
    limiter,
    authenticate,
    requireRole(...SEARCHERS),
    guarded(async (req, res) => {
      const eventId = req.query.eventId;
      if (typeof eventId !== "string" || eventId === "") {
        refuse(res, 400, "VALIDATION_FAILED", "Say which event to pre-fill the search from.", [
          { field: "eventId", message: "Enter the event's id." },
        ]);
        return;
      }
      const event = UUID.test(eventId) ? await findEventForPlanning(sql, eventId, eventsScopeFor(req.actor!), req.actor!.userId) : null;
      if (!event) {
        refuse(res, 404, "EVENT_NOT_FOUND", "No event with that id exists.");
        return;
      }
      const { filters, unmatchedAccessibility } = prefillFromEvent(event, await listCatalogueOptions(sql));
      res.json({ eventId: event.id, reference: event.reference, filters, unmatchedAccessibility });
    }),
  );

  return router;
}
