import { Router, type NextFunction, type RequestHandler, type Response } from "express";
import { rateLimit } from "express-rate-limit";
import type { Sql } from "postgres";
import { findEventForPlanning, findEventReferences, type EventPlanningView } from "../../event/index.js";
import { resolveAccessScope } from "../../identity/index.js";
import { authenticate, requireRole, type ActorRequest } from "../auth/actor.js";
import { isAssignedCoordinator, readBookingRequest } from "../domain/bookingRequest.js";
import {
  duplicateHoldMessage,
  eventHoldable,
  expiredMessage,
  hasExpired,
  holdConflictMessage,
  notHeldMessage,
  notHoldableMessage,
  notReleasableMessage,
  notRequestedMessage,
  readHoldRequest,
  readPlacement,
} from "../domain/hold.js";
import { expiryNotChangeableMessage, readExpiryChange } from "../domain/holdExpiry.js";
import {
  DuplicateHoldError,
  HoldConflictError,
  changeHoldExpiry,
  findHold,
  insertHold,
  listHoldsForEvent,
  listPlacedForStaff,
  listRequestedForStaff,
  lockHold,
  looksAfterVenue,
  markHoldConverted,
  placeHold,
  releaseHold,
  type Hold,
} from "../repo/holds.js";
import { findVenue } from "../repo/venues.js";
import { presentAll, submitBookingRequest } from "./bookingRequests.js";
import { refuse } from "./errors.js";

/**
 * L3 — tentative holds. Following the customer's Week 9 answer (CQ-06), the
 * event's assigned coordinator requests a hold, choosing how long before the
 * expiry to be reminded; Venue Staff of the venue place it, setting the expiry.
 * A request reserves nothing. Placing takes the period in venue_slots, where
 * the exclusion constraint decides who gets it, first placed first served
 * (ADR-0006). The coordinator then converts the hold into a booking request
 * (L1) or releases it. Expiring is L6.
 */

const BASE = "/api/v1/holds";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INVALID_HOLD = "The hold could not be requested. Check the highlighted fields.";
const INVALID_PLACEMENT = "The hold could not be placed. Check the highlighted fields.";
const INVALID_EXPIRY = "The expiry could not be changed. Check the highlighted fields.";
const INVALID_REQUEST = "The request could not be submitted. Check the highlighted fields.";
const NOT_ASSIGNED_REQUEST = "Only the event's assigned coordinator can request a hold for it.";
const NOT_ASSIGNED_RELEASE = "Only the event's assigned coordinator can release its holds.";
const NOT_ASSIGNED_CONVERT = "Only the event's assigned coordinator can convert its holds.";

/**
 * At most 120 requests a minute from one address to these routes, refused
 * before any identity lookup or query. A stopgap until the gateway limits
 * requests (ADR-0011, EN-12); CodeQL (js/missing-rate-limiting) requires one.
 */
export function holdsRateLimit(): RequestHandler {
  return rateLimit({
    windowMs: 60_000,
    limit: 120,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, res) => refuse(res, 429, "RATE_LIMITED", "Too many hold requests. Wait a minute and try again."),
  });
}

/** The hold as the API shows it, with its event's reference. */
function present(hold: Hold, eventReference: string | null) {
  return { ...hold, eventReference };
}

/** The event, if the caller may see it (A3); null otherwise. */
function findEvent(sql: Sql, eventId: string, req: ActorRequest): Promise<EventPlanningView | null> {
  const { role, userId } = req.actor!;
  return findEventForPlanning(sql, eventId, resolveAccessScope(role, userId, "events"), userId);
}

const holdNotFound = (res: Response) => refuse(res, 404, "HOLD_NOT_FOUND", "No hold with that id exists, or you can't see it.");

/** The hold and its event, for the event's coordinator; null when either is missing or out of the caller's scope. */
async function holdForCoordinator(sql: Sql, id: string, req: ActorRequest): Promise<{ hold: Hold; event: EventPlanningView } | null> {
  const hold = UUID.test(id) ? await findHold(sql, id) : null;
  if (!hold) return null;
  const event = await findEvent(sql, hold.eventId, req);
  return event ? { hold, event } : null;
}

export function holdsRouter(sql: Sql, limiter: RequestHandler = holdsRateLimit()) {
  const router = Router();

  // L3: the assigned coordinator requests a hold. It reserves nothing yet.
  router.post(BASE, limiter, authenticate, requireRole("EVENT_COORDINATOR"), async (req: ActorRequest, res: Response, next: NextFunction) => {
    try {
      const read = readHoldRequest(req.body);
      if (!read.ok) return refuse(res, 400, "VALIDATION_FAILED", INVALID_HOLD, read.fields);
      const input = read.hold;
      const actor = req.actor!;

      const event = await findEvent(sql, input.eventId, req);
      if (!event) return refuse(res, 404, "EVENT_NOT_FOUND", "No event with that id exists, or you can't see it.");
      if (!isAssignedCoordinator(actor.userId, event)) return refuse(res, 403, "ROLE_NOT_AUTHORISED", NOT_ASSIGNED_REQUEST);
      if (!eventHoldable(event.status)) return refuse(res, 409, "EVENT_NOT_HOLDABLE", notHoldableMessage(event.status));

      const venue = await findVenue(sql, input.venueId);
      if (!venue) return refuse(res, 404, "VENUE_NOT_FOUND", "No venue with that id exists.");
      if (!venue.isActive) return refuse(res, 422, "VENUE_INACTIVE", `${venue.name} is inactive, so it can't be held.`);

      try {
        const hold = await sql.begin((tx) => insertHold(tx, { ...input, requestedBy: actor.userId }));
        res.status(201).json(present(hold, event.reference));
      } catch (error) {
        if (!(error instanceof DuplicateHoldError)) throw error;
        return refuse(res, 409, "HOLD_DUPLICATE", duplicateHoldMessage(error.reference ?? "another hold", venue.name));
      }
    } catch (error) {
      next(error);
    }
  });

  // L3: one event's holds.
  router.get(BASE, limiter, authenticate, requireRole("EVENT_COORDINATOR", "EVENT_ORGANISER"), async (req: ActorRequest, res: Response, next: NextFunction) => {
    try {
      const eventId = typeof req.query.eventId === "string" ? req.query.eventId : "";
      const event = UUID.test(eventId) ? await findEvent(sql, eventId, req) : null;
      if (!event) return refuse(res, 404, "EVENT_NOT_FOUND", "No event with that id exists, or you can't see it.");
      const items = await listHoldsForEvent(sql, event.id);
      res.json({ items: items.map((hold) => present(hold, event.reference)) });
    } catch (error) {
      next(error);
    }
  });

  // L3: the requested holds at the venues this Venue Staff member looks after.
  router.get(`${BASE}/queue`, limiter, authenticate, requireRole("VENUE_STAFF"), async (req: ActorRequest, res: Response, next: NextFunction) => {
    try {
      const items = await listRequestedForStaff(sql, req.actor!.userId);
      const references = await findEventReferences(sql, [...new Set(items.map((hold) => hold.eventId))]);
      res.json({ items: items.map((hold) => present(hold, references.get(hold.eventId) ?? null)) });
    } catch (error) {
      next(error);
    }
  });

  // L6: the held and recently expired holds at those venues, newest expiry first, so Venue Staff can change an expiry.
  router.get(`${BASE}/placed`, limiter, authenticate, requireRole("VENUE_STAFF"), async (req: ActorRequest, res: Response, next: NextFunction) => {
    try {
      const items = await listPlacedForStaff(sql, req.actor!.userId);
      const references = await findEventReferences(sql, [...new Set(items.map((hold) => hold.eventId))]);
      res.json({ items: items.map((hold) => present(hold, references.get(hold.eventId) ?? null)) });
    } catch (error) {
      next(error);
    }
  });

  // L3: Venue Staff of the venue place a requested hold, setting its expiry.
  router.post(`${BASE}/:id/place`, limiter, authenticate, requireRole("VENUE_STAFF"), async (req: ActorRequest, res: Response, next: NextFunction) => {
    try {
      const actor = req.actor!;
      const id = req.params.id!;
      const found = UUID.test(id) ? await findHold(sql, id) : null;
      // Venue Staff see only their venues' holds (A3), so another venue's hold is "not found".
      if (!found || !(await looksAfterVenue(sql, found.venueId, actor.userId))) return holdNotFound(res);

      const placement = readPlacement(req.body, new Date());
      if (!placement.ok) return refuse(res, 400, "VALIDATION_FAILED", INVALID_PLACEMENT, placement.fields);

      // The server checks the event on Venue Staff's behalf; only its status is used.
      const event = await findEventForPlanning(sql, found.eventId, { scopeType: "ALL" }, actor.userId);
      if (!event) return holdNotFound(res);
      if (!eventHoldable(event.status)) return refuse(res, 409, "EVENT_NOT_HOLDABLE", notHoldableMessage(event.status));
      const venue = (await findVenue(sql, found.venueId))!;
      if (!venue.isActive) return refuse(res, 422, "VENUE_INACTIVE", `${venue.name} is inactive, so it can't be held.`);

      const outcome = await sql.begin(async (tx) => {
        const hold = (await lockHold(tx, id))!;
        if (hold.status !== "REQUESTED") return { code: "NOT_REQUESTED", hold } as const;
        try {
          const placed = await placeHold(tx, hold, {
            expiresAt: placement.expiresAt,
            setupMinutes: venue.setupMinutes,
            turnaroundMinutes: venue.turnaroundMinutes,
            actorUserId: actor.userId,
            correlationId: req.header("x-correlation-id") ?? null,
          });
          return { code: "PLACED", hold: placed } as const;
        } catch (error) {
          if (!(error instanceof HoldConflictError)) throw error;
          return { code: "CONFLICT", overlapped: error.overlapped } as const;
        }
      });

      if (outcome.code === "NOT_REQUESTED") {
        return refuse(res, 409, "HOLD_NOT_REQUESTED", notRequestedMessage(outcome.hold.reference, outcome.hold.status));
      }
      if (outcome.code === "CONFLICT") return refuse(res, 409, "VENUE_SLOT_CONFLICT", holdConflictMessage(outcome.overlapped, venue.name));
      res.json(present(outcome.hold, event.reference));
    } catch (error) {
      next(error);
    }
  });

  // L6: Venue Staff of the venue move a held hold's expiry.
  router.patch(`${BASE}/:id/expiry`, limiter, authenticate, requireRole("VENUE_STAFF"), async (req: ActorRequest, res: Response, next: NextFunction) => {
    try {
      const actor = req.actor!;
      const id = req.params.id!;
      const found = UUID.test(id) ? await findHold(sql, id) : null;
      // As for placing: another venue's hold is "not found".
      if (!found || !(await looksAfterVenue(sql, found.venueId, actor.userId))) return holdNotFound(res);

      const change = readExpiryChange(req.body, new Date());
      if (!change.ok) return refuse(res, 400, "VALIDATION_FAILED", INVALID_EXPIRY, change.fields);

      const event = await findEventForPlanning(sql, found.eventId, { scopeType: "ALL" }, actor.userId);
      if (!event) return holdNotFound(res);

      const outcome = await sql.begin(async (tx) => {
        const hold = (await lockHold(tx, found.id))!;
        if (hold.status !== "HELD") return { code: "NOT_HELD", hold } as const;
        const changed = await changeHoldExpiry(tx, hold, change.expiresAt, actor.userId, req.header("x-correlation-id") ?? null);
        return { code: "CHANGED", hold: changed } as const;
      });

      if (outcome.code === "NOT_HELD") {
        return refuse(res, 409, "HOLD_NOT_HELD", expiryNotChangeableMessage(outcome.hold.reference, outcome.hold.status));
      }
      res.json(present(outcome.hold, event.reference));
    } catch (error) {
      next(error);
    }
  });

  // L3: the holding coordinator releases a requested or held hold. The record is kept.
  router.post(`${BASE}/:id/release`, limiter, authenticate, requireRole("EVENT_COORDINATOR"), async (req: ActorRequest, res: Response, next: NextFunction) => {
    try {
      const found = await holdForCoordinator(sql, req.params.id!, req);
      if (!found) return holdNotFound(res);
      if (!isAssignedCoordinator(req.actor!.userId, found.event)) return refuse(res, 403, "ROLE_NOT_AUTHORISED", NOT_ASSIGNED_RELEASE);

      const outcome = await sql.begin(async (tx) => {
        const hold = (await lockHold(tx, found.hold.id))!;
        if (hold.status !== "REQUESTED" && hold.status !== "HELD") return { code: "NOT_RELEASABLE", hold } as const;
        return { code: "RELEASED", hold: await releaseHold(tx, hold, req.actor!.userId) } as const;
      });

      if (outcome.code === "NOT_RELEASABLE") {
        return refuse(res, 409, "HOLD_NOT_HELD", notReleasableMessage(outcome.hold.reference, outcome.hold.status));
      }
      res.json(present(outcome.hold, found.event.reference));
    } catch (error) {
      next(error);
    }
  });

  // L3: the holding coordinator converts a held hold into a booking request (L1)
  // for the same venue and period. Availability isn't checked again: the period
  // stays held, under the request, until M1 or M2 decides it.
  router.post(`${BASE}/:id/convert`, limiter, authenticate, requireRole("EVENT_COORDINATOR"), async (req: ActorRequest, res: Response, next: NextFunction) => {
    try {
      const found = await holdForCoordinator(sql, req.params.id!, req);
      if (!found) return holdNotFound(res);
      const { hold } = found;
      if (!isAssignedCoordinator(req.actor!.userId, found.event)) return refuse(res, 403, "ROLE_NOT_AUTHORISED", NOT_ASSIGNED_CONVERT);

      const body = typeof req.body === "object" && req.body !== null && !Array.isArray(req.body) ? (req.body as Record<string, unknown>) : {};
      const read = readBookingRequest({
        ...body,
        eventId: hold.eventId,
        venueId: hold.venueId,
        startsAt: hold.startsAt,
        endsAt: hold.endsAt,
        replacesBookingId: null,
      });
      if (!read.ok) return refuse(res, 400, "VALIDATION_FAILED", INVALID_REQUEST, read.fields);

      let converted: Hold | null = null;
      const outcome = await submitBookingRequest(sql, req, read.request, {
        before: async (tx) => {
          const locked = (await lockHold(tx, hold.id))!;
          if (locked.status !== "HELD") return { status: 409, code: "HOLD_NOT_HELD", message: notHeldMessage(locked.reference, locked.status) };
          if (hasExpired(locked.expiresAt!, new Date())) {
            return { status: 409, code: "HOLD_NOT_HELD", message: expiredMessage(locked.reference, locked.expiresAt!) };
          }
          return null;
        },
        after: async (tx, created) => {
          converted = await markHoldConverted(tx, (await findHold(tx, hold.id))!, created, req.actor!.userId);
        },
      });
      if (!outcome.ok) return refuse(res, outcome.status, outcome.code, outcome.message, outcome.fields, outcome.details);
      // N2: the new pending request with what it clashes with.
      const [request] = await presentAll(sql, [outcome.created], () => outcome.eventReference);
      res.status(201).json({
        request,
        hold: present(converted!, outcome.eventReference),
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
