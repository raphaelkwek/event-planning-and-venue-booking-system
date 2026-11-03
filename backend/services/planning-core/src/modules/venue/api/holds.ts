import { Router, type NextFunction, type RequestHandler, type Response } from "express";
import { rateLimit } from "express-rate-limit";
import type { Sql, TransactionSql } from "postgres";
import type { Role } from "@connectsphere/contracts";
import { findEventForChange, findEventForPlanning, findEventReferences, type EventForChange, type EventPlanningView } from "../../event/index.js";
import { notInScopeMessage, resolveAccessScope } from "../../identity/index.js";
import { authenticate, requireRole, type ActorRequest } from "../auth/actor.js";
import { readBookingRequest } from "../domain/bookingRequest.js";
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
import { holdBlockedMessage } from "../domain/unavailability.js";
import { activeBlocksOverlapping } from "../repo/bookingDecisions.js";
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
import { expireLockedHold, holdExpiryReached } from "../repo/holdExpiry.js";
import { lockVenue } from "../repo/venues.js";
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
 *
 * I4 (W9-41): an active block refuses a hold over its occupied period, when it
 * is requested and when it is placed. A hold already placed is flagged by I2.
 */

const BASE = "/api/v1/holds";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INVALID_HOLD = "The hold could not be requested. Check the highlighted fields.";
const INVALID_PLACEMENT = "The hold could not be placed. Check the highlighted fields.";
const INVALID_EXPIRY = "The expiry could not be changed. Check the highlighted fields.";
const INVALID_REQUEST = "The request could not be submitted. Check the highlighted fields.";
const EVENT_NOT_FOUND = "No event with that id exists, or you can't see it.";

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

/** The event, if the caller may see it (A3; for a coordinator, A4: assigned to them); null otherwise. */
function findEvent(sql: Sql, eventId: string, req: ActorRequest): Promise<EventPlanningView | null> {
  const { role, userId } = req.actor!;
  return findEventForPlanning(sql, eventId, resolveAccessScope(role, userId, "events"), userId);
}

/**
 * A4: the event again inside the write's transaction, under its row lock (`for share`), in the caller's
 * scope. A Lead's reassignment (E4) or a cancellation (F3) that commits after the check before the
 * transaction is seen here. The event is locked before any hold (implementation.md §4.6 lock order).
 */
function lockEventInScope(tx: TransactionSql, eventId: string, req: ActorRequest): Promise<EventForChange | null> {
  const { role, userId } = req.actor!;
  return findEventForChange(tx, eventId, resolveAccessScope(role, userId, "events"), userId, { lock: "share" });
}

const eventNotFound = (res: Response, role: Role) => refuse(res, 404, "EVENT_NOT_FOUND", notInScopeMessage(role, EVENT_NOT_FOUND));
const holdNotFound = (res: Response, role: Role) =>
  refuse(res, 404, "HOLD_NOT_FOUND", notInScopeMessage(role, "No hold with that id exists, or you can't see it.", "hold"));

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
  router.post(BASE, limiter, authenticate, requireRole("booking_request", "request_hold"), async (req: ActorRequest, res: Response, next: NextFunction) => {
    try {
      const read = readHoldRequest(req.body);
      if (!read.ok) return refuse(res, 400, "VALIDATION_FAILED", INVALID_HOLD, read.fields);
      const input = read.hold;
      const actor = req.actor!;

      const event = await findEvent(sql, input.eventId, req);
      if (!event) return eventNotFound(res, actor.role);
      if (!eventHoldable(event.status)) return refuse(res, 409, "EVENT_NOT_HOLDABLE", notHoldableMessage(event.status));

      // L1 (audit): the block check and the insert are one transaction under the venue row lock, the lock
      // I2 takes to record a block, so a block recorded meanwhile can't be missed (I4: nothing is stored).
      // M5: the setup and turnaround time are the ones read under that lock.
      const outcome = await sql.begin(async (tx) => {
        const venue = await lockVenue(tx, input.venueId);
        if (!venue) return { code: "NO_VENUE" } as const;
        if (!venue.isActive) return { code: "INACTIVE", venue } as const;
        // A4: the event once more, in scope and holdable, under its row lock, after the venue's (§4.6: the
        // hold's foreign key takes a share lock on the venue row, so the venue comes first). A Lead's
        // reassignment (E4) or a cancellation (F3) that commits while this waits is seen here.
        const lockedEvent = await lockEventInScope(tx, event.id, req);
        if (!lockedEvent) return { code: "NOT_FOUND" } as const;
        if (!eventHoldable(lockedEvent.status)) return { code: "NOT_HOLDABLE", status: lockedEvent.status } as const;
        const blocks = await activeBlocksOverlapping(
          tx,
          venue.id,
          new Date(input.startsAt),
          new Date(input.endsAt),
          venue.setupMinutes,
          venue.turnaroundMinutes,
        );
        if (blocks.length > 0) return { code: "BLOCKED", venue, blocks } as const;
        try {
          return { code: "REQUESTED", hold: await insertHold(tx, { ...input, requestedBy: actor.userId }) } as const;
        } catch (error) {
          if (!(error instanceof DuplicateHoldError)) throw error;
          return { code: "DUPLICATE", venue, reference: error.reference } as const;
        }
      });

      switch (outcome.code) {
        case "NOT_FOUND":
          return eventNotFound(res, actor.role);
        case "NOT_HOLDABLE":
          return refuse(res, 409, "EVENT_NOT_HOLDABLE", notHoldableMessage(outcome.status));
        case "NO_VENUE":
          return refuse(res, 404, "VENUE_NOT_FOUND", "No venue with that id exists.");
        case "INACTIVE":
          return refuse(res, 422, "VENUE_INACTIVE", `${outcome.venue.name} is inactive, so it can't be held.`);
        case "BLOCKED":
          return refuse(res, 409, "VENUE_UNAVAILABLE", holdBlockedMessage(outcome.venue.name, outcome.blocks));
        case "DUPLICATE":
          return refuse(res, 409, "HOLD_DUPLICATE", duplicateHoldMessage(outcome.reference ?? "another hold", outcome.venue.name));
        case "REQUESTED":
          return res.status(201).json(present(outcome.hold, event.reference));
      }
    } catch (error) {
      next(error);
    }
  });

  // L3: one event's holds.
  router.get(BASE, limiter, authenticate, requireRole("booking_request", "list"), async (req: ActorRequest, res: Response, next: NextFunction) => {
    try {
      const eventId = typeof req.query.eventId === "string" ? req.query.eventId : "";
      const event = UUID.test(eventId) ? await findEvent(sql, eventId, req) : null;
      if (!event) return eventNotFound(res, req.actor!.role);
      const items = await listHoldsForEvent(sql, event.id);
      res.json({ items: items.map((hold) => present(hold, event.reference)) });
    } catch (error) {
      next(error);
    }
  });

  // L3: the requested holds at the venues this Venue Staff member looks after.
  router.get(`${BASE}/queue`, limiter, authenticate, requireRole("booking_request", "view_queue"), async (req: ActorRequest, res: Response, next: NextFunction) => {
    try {
      const items = await listRequestedForStaff(sql, req.actor!.userId);
      const references = await findEventReferences(sql, [...new Set(items.map((hold) => hold.eventId))]);
      res.json({ items: items.map((hold) => present(hold, references.get(hold.eventId) ?? null)) });
    } catch (error) {
      next(error);
    }
  });

  // L6: the held and recently expired holds at those venues, newest expiry first, so Venue Staff can change an expiry.
  router.get(`${BASE}/placed`, limiter, authenticate, requireRole("booking_request", "view_queue"), async (req: ActorRequest, res: Response, next: NextFunction) => {
    try {
      const items = await listPlacedForStaff(sql, req.actor!.userId);
      const references = await findEventReferences(sql, [...new Set(items.map((hold) => hold.eventId))]);
      res.json({ items: items.map((hold) => present(hold, references.get(hold.eventId) ?? null)) });
    } catch (error) {
      next(error);
    }
  });

  // L3: Venue Staff of the venue place a requested hold, setting its expiry.
  router.post(`${BASE}/:id/place`, limiter, authenticate, requireRole("booking_request", "place_hold"), async (req: ActorRequest, res: Response, next: NextFunction) => {
    try {
      const actor = req.actor!;
      const id = req.params.id!;
      const found = UUID.test(id) ? await findHold(sql, id) : null;
      // Venue Staff see only their venues' holds (A3), so another venue's hold is "not found".
      if (!found || !(await looksAfterVenue(sql, found.venueId, actor.userId))) return holdNotFound(res, actor.role);

      const placement = readPlacement(req.body, new Date());
      if (!placement.ok) return refuse(res, 400, "VALIDATION_FAILED", INVALID_PLACEMENT, placement.fields);

      // The server checks the event on Venue Staff's behalf; only its status is used.
      const event = await findEventForPlanning(sql, found.eventId, { scopeType: "ALL" }, actor.userId);
      if (!event) return holdNotFound(res, actor.role);
      if (!eventHoldable(event.status)) return refuse(res, 409, "EVENT_NOT_HOLDABLE", notHoldableMessage(event.status));
      const outcome = await sql.begin(async (tx) => {
        // The venue first, then the hold: the order every booking change at a venue takes (implementation.md §4.6).
        // M5: the setup and turnaround time come from this locking read, so a change of times can't slip in between.
        const venue = (await lockVenue(tx, found.venueId))!;
        if (!venue.isActive) return { code: "INACTIVE", venue } as const;
        const hold = (await lockHold(tx, id))!;
        if (hold.status !== "REQUESTED") return { code: "NOT_REQUESTED", hold } as const;
        // I4: a block recorded since the request refuses it. Checked under the venue lock I2 takes to record one.
        const blocks = await activeBlocksOverlapping(
          tx,
          hold.venueId,
          new Date(hold.startsAt),
          new Date(hold.endsAt),
          venue.setupMinutes,
          venue.turnaroundMinutes,
        );
        if (blocks.length > 0) return { code: "BLOCKED", hold, blocks, venue } as const;
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
          return { code: "CONFLICT", overlapped: error.overlapped, venue } as const;
        }
      });

      if (outcome.code === "INACTIVE") {
        return refuse(res, 422, "VENUE_INACTIVE", `${outcome.venue.name} is inactive, so it can't be held.`);
      }
      if (outcome.code === "NOT_REQUESTED") {
        return refuse(res, 409, "HOLD_NOT_REQUESTED", notRequestedMessage(outcome.hold.reference, outcome.hold.status));
      }
      if (outcome.code === "BLOCKED") {
        return refuse(res, 409, "VENUE_UNAVAILABLE", holdBlockedMessage(outcome.venue.name, outcome.blocks, outcome.hold.reference));
      }
      if (outcome.code === "CONFLICT") {
        return refuse(res, 409, "VENUE_SLOT_CONFLICT", holdConflictMessage(outcome.overlapped, outcome.venue.name));
      }
      res.json(present(outcome.hold, event.reference));
    } catch (error) {
      next(error);
    }
  });

  // L6: Venue Staff of the venue move a held hold's expiry.
  router.patch(`${BASE}/:id/expiry`, limiter, authenticate, requireRole("booking_request", "place_hold"), async (req: ActorRequest, res: Response, next: NextFunction) => {
    try {
      const actor = req.actor!;
      const id = req.params.id!;
      const found = UUID.test(id) ? await findHold(sql, id) : null;
      // As for placing: another venue's hold is "not found".
      if (!found || !(await looksAfterVenue(sql, found.venueId, actor.userId))) return holdNotFound(res, actor.role);

      const change = readExpiryChange(req.body, new Date());
      if (!change.ok) return refuse(res, 400, "VALIDATION_FAILED", INVALID_EXPIRY, change.fields);

      const event = await findEventForPlanning(sql, found.eventId, { scopeType: "ALL" }, actor.userId);
      if (!event) return holdNotFound(res, actor.role);

      const outcome = await sql.begin(async (tx) => {
        await lockVenue(tx, found.venueId);
        const hold = (await lockHold(tx, found.id))!;
        if (hold.status !== "HELD") return { code: "NOT_HELD", hold } as const;
        // M4: a hold whose expiry has passed is expired now, as the workflow would have, rather than revived.
        if (await holdExpiryReached(tx, hold.id)) {
          await expireLockedHold(tx, hold);
          return { code: "EXPIRED", hold } as const;
        }
        const changed = await changeHoldExpiry(tx, hold, change.expiresAt, actor.userId, req.header("x-correlation-id") ?? null);
        return { code: "CHANGED", hold: changed } as const;
      });

      if (outcome.code === "NOT_HELD") {
        return refuse(res, 409, "HOLD_NOT_HELD", expiryNotChangeableMessage(outcome.hold.reference, outcome.hold.status));
      }
      if (outcome.code === "EXPIRED") {
        return refuse(res, 409, "HOLD_NOT_HELD", expiryNotChangeableMessage(outcome.hold.reference, "EXPIRED"));
      }
      res.json(present(outcome.hold, event.reference));
    } catch (error) {
      next(error);
    }
  });

  // L3: the holding coordinator releases a requested or held hold. The record is kept.
  router.post(`${BASE}/:id/release`, limiter, authenticate, requireRole("booking_request", "release_hold"), async (req: ActorRequest, res: Response, next: NextFunction) => {
    try {
      const found = await holdForCoordinator(sql, req.params.id!, req);
      if (!found) return holdNotFound(res, req.actor!.role);

      const outcome = await sql.begin(async (tx) => {
        // The venue first, then the event, then the hold (§4.6): releasing clears flags at the venue (M3).
        await lockVenue(tx, found.hold.venueId);
        // A4: the event, in scope and locked, before the hold.
        if (!(await lockEventInScope(tx, found.hold.eventId, req))) return { code: "NOT_FOUND" } as const;
        const hold = (await lockHold(tx, found.hold.id))!;
        if (hold.status !== "REQUESTED" && hold.status !== "HELD") return { code: "NOT_RELEASABLE", hold } as const;
        return { code: "RELEASED", hold: await releaseHold(tx, hold, req.actor!.userId) } as const;
      });

      if (outcome.code === "NOT_FOUND") return holdNotFound(res, req.actor!.role);
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
  router.post(`${BASE}/:id/convert`, limiter, authenticate, requireRole("booking_request", "convert_hold"), async (req: ActorRequest, res: Response, next: NextFunction) => {
    try {
      const found = await holdForCoordinator(sql, req.params.id!, req);
      if (!found) return holdNotFound(res, req.actor!.role);
      const { hold } = found;

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
