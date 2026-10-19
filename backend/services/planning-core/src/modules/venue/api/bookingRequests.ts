import { Router, type NextFunction, type RequestHandler, type Response } from "express";
import { rateLimit } from "express-rate-limit";
import type { Sql } from "postgres";
import { findEventForPlanning, findEventReferences, type EventPlanningView } from "../../event/index.js";
import { resolveAccessScope } from "../../identity/index.js";
import { authenticate, requireRole, type ActorRequest } from "../auth/actor.js";
import {
  differencesFromEvent,
  duplicateMessage,
  eventBookable,
  isAssignedCoordinator,
  layoutAt,
  notBookableMessage,
  notPendingMessage,
  readBookingRequest,
} from "../domain/bookingRequest.js";
import { requestBlockedMessage } from "../domain/unavailability.js";
import { writeVenueOutbox } from "../events/outbox.js";
import { activeBlocksOverlapping } from "../repo/bookingDecisions.js";
import { lockVenue } from "../repo/slots.js";
import {
  DuplicateBookingRequestError,
  findBookingRequest,
  insertBookingRequest,
  isReplaceableBooking,
  listForEvent,
  listPendingForStaff,
  lockBookingRequest,
  venueStaffIds,
  withdrawBookingRequest,
  type BookingRequest,
} from "../repo/bookingRequests.js";
import { findVenue } from "../repo/venues.js";
import { refuse } from "./errors.js";

/**
 * L1 — the event's assigned coordinator requests a venue for it; the request
 * waits, Pending, in the queue of the venue's Venue Staff, who are notified.
 * L2 — the coordinator withdraws a request while it is still Pending.
 *
 * A request reserves nothing: only an approval (M1) creates a confirmed booking.
 * The one overlap refused here is a second pending request of the same event
 * for the same venue, and the exclusion constraint decides that (ADR-0006).
 */

export const BASE = "/api/v1/booking-requests";
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NOT_ASSIGNED_REQUEST = "Only the event's assigned coordinator can request a venue for it.";
const NOT_ASSIGNED_WITHDRAW = "Only the event's assigned coordinator can withdraw its requests.";
const INVALID = "The request could not be submitted. Check the highlighted fields.";
const REPLACEMENT_NOT_VALID =
  "The booking to replace must be one of this event's confirmed bookings flagged Requires Reconfirmation.";

/**
 * At most 120 requests a minute from one address to these routes, refused before
 * any identity lookup or query. A stopgap until the gateway limits requests
 * (ADR-0011, EN-12); CodeQL (js/missing-rate-limiting) requires one.
 */
export function bookingRequestRateLimit(): RequestHandler {
  return rateLimit({
    windowMs: 60_000,
    limit: 120,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, res) => refuse(res, 429, "RATE_LIMITED", "Too many booking requests. Wait a minute and try again."),
  });
}

/** The request as the API shows it: with its event's reference, and each value that differs from the event's. */
export function present(request: BookingRequest, eventReference: string | null) {
  return {
    ...request,
    eventReference,
    differences: differencesFromEvent(
      { startsAt: request.eventStartsAt, endsAt: request.eventEndsAt, attendance: request.eventAttendance },
      request,
    ),
  };
}

/** The event, if the caller may see it (A3); null otherwise. */
function findEvent(sql: Sql, eventId: string, req: ActorRequest): Promise<EventPlanningView | null> {
  const { role, userId } = req.actor!;
  return findEventForPlanning(sql, eventId, resolveAccessScope(role, userId, "events"), userId);
}

const eventNotFound = (res: Response) =>
  refuse(res, 404, "EVENT_NOT_FOUND", "No event with that id exists, or you can't see it.");
export const requestNotFound = (res: Response) =>
  refuse(res, 404, "BOOKING_REQUEST_NOT_FOUND", "No booking request with that id exists, or you can't see it.");

export function bookingRequestsRouter(sql: Sql) {
  const router = Router();
  const limiter = bookingRequestRateLimit();

  // L1: raise a request.
  router.post(BASE, limiter, authenticate, requireRole("EVENT_COORDINATOR"), async (req: ActorRequest, res: Response, next: NextFunction) => {
    try {
      const read = readBookingRequest(req.body);
      if (!read.ok) return refuse(res, 400, "VALIDATION_FAILED", INVALID, read.fields);
      const input = read.request;
      const actor = req.actor!;

      const event = await findEvent(sql, input.eventId, req);
      if (!event) return eventNotFound(res);
      if (!isAssignedCoordinator(actor.userId, event)) return refuse(res, 403, "ROLE_NOT_AUTHORISED", NOT_ASSIGNED_REQUEST);
      if (!eventBookable(event.status)) return refuse(res, 409, "EVENT_NOT_BOOKABLE", notBookableMessage(event.status));

      const venue = await findVenue(sql, input.venueId);
      if (!venue) return refuse(res, 404, "VENUE_NOT_FOUND", "No venue with that id exists.");
      if (!venue.isActive) return refuse(res, 422, "VENUE_INACTIVE", `${venue.name} is inactive, so it can't be requested.`);
      const layout = layoutAt(venue.layouts, input.layout);
      if (!layout) {
        return refuse(res, 400, "VALIDATION_FAILED", INVALID, [{ field: "layout", message: `${venue.name} has no ${input.layout} layout.` }]);
      }

      // An approved event always has its date, times and attendance (B2).
      const eventValues = { startsAt: event.proposedStartAt!, endsAt: event.proposedEndAt!, attendance: event.expectedAttendance! };
      const differs = differencesFromEvent(eventValues, input).length > 0;

      const outcome = await sql.begin(async (tx) => {
        if (input.replacesBookingId && !(await isReplaceableBooking(tx, input.replacesBookingId, event.id))) {
          return { code: "REPLACEMENT_NOT_VALID" } as const;
        }
        // I2: no new request over recorded unavailability. Under the venue row lock,
        // so a block recorded at the same moment either refuses this or flags it.
        await lockVenue(tx, venue.id);
        const blocks = await activeBlocksOverlapping(tx, venue.id, new Date(input.startsAt), new Date(input.endsAt), 0, 0);
        if (blocks.length > 0) return { code: "UNAVAILABLE", blocks } as const;
        const created = await insertBookingRequest(tx, {
          ...input,
          layout,
          eventStartsAt: eventValues.startsAt,
          eventEndsAt: eventValues.endsAt,
          eventAttendance: eventValues.attendance,
          differsFromEvent: differs,
          requestedBy: actor.userId,
        });
        const staffIds = await venueStaffIds(tx, venue.id);
        if (staffIds.length > 0) {
          await writeVenueOutbox(tx, {
            messageType: "venue-booking.request-submitted",
            aggregateId: created.id,
            actor,
            correlationId: req.header("x-correlation-id") ?? null,
            payload: {
              bookingRequestId: created.id,
              reference: created.reference,
              eventId: event.id,
              eventReference: event.reference,
              eventName: event.name,
              venueId: venue.id,
              venueName: venue.name,
              startsAt: created.startsAt,
              endsAt: created.endsAt,
              staffIds,
              requestedBy: created.requestedBy,
              requestedAt: created.requestedAt,
            },
          });
        }
        return { code: "CREATED", created } as const;
      });

      if (outcome.code === "REPLACEMENT_NOT_VALID") return refuse(res, 422, "REPLACEMENT_NOT_VALID", REPLACEMENT_NOT_VALID);
      if (outcome.code === "UNAVAILABLE") return refuse(res, 409, "VENUE_UNAVAILABLE", requestBlockedMessage(venue.name, outcome.blocks));
      res.status(201).json(present(outcome.created, event.reference));
    } catch (error) {
      if (error instanceof DuplicateBookingRequestError) {
        return refuse(res, 409, "BOOKING_REQUEST_DUPLICATE", duplicateMessage(error.references));
      }
      next(error);
    }
  });

  // L1, L4: one event's requests, with the event's values the request form starts from.
  router.get(BASE, limiter, authenticate, requireRole("EVENT_COORDINATOR", "EVENT_ORGANISER"), async (req: ActorRequest, res: Response, next: NextFunction) => {
    try {
      const eventId = typeof req.query.eventId === "string" ? req.query.eventId : "";
      const event = eventId ? await findEvent(sql, eventId, req) : null;
      if (!event) return eventNotFound(res);
      const items = await listForEvent(sql, event.id);
      res.json({
        event: {
          id: event.id,
          reference: event.reference,
          name: event.name,
          status: event.status,
          assignedCoordinatorId: event.assignedCoordinatorId,
          proposedStartAt: event.proposedStartAt,
          proposedEndAt: event.proposedEndAt,
          expectedAttendance: event.expectedAttendance,
          venueRequirements: event.venueRequirements,
          accessibilityNeeds: event.accessibilityNeeds,
        },
        items: items.map((item) => present(item, event.reference)),
      });
    } catch (error) {
      next(error);
    }
  });

  // L1, M1: the pending requests for the venues this Venue Staff member looks after.
  router.get(`${BASE}/queue`, limiter, authenticate, requireRole("VENUE_STAFF"), async (req: ActorRequest, res: Response, next: NextFunction) => {
    try {
      const items = await listPendingForStaff(sql, req.actor!.userId);
      const references = await findEventReferences(sql, [...new Set(items.map((item) => item.eventId))]);
      res.json({ items: items.map((item) => present(item, references.get(item.eventId) ?? null)) });
    } catch (error) {
      next(error);
    }
  });

  // L2: withdraw a pending request. The record is kept.
  router.post(`${BASE}/:id/withdraw`, limiter, authenticate, requireRole("EVENT_COORDINATOR"), async (req: ActorRequest, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id!;
      const existing = UUID.test(id) ? await findBookingRequest(sql, id) : null;
      if (!existing) return requestNotFound(res);
      const event = await findEvent(sql, existing.eventId, req);
      if (!event) return requestNotFound(res);
      if (!isAssignedCoordinator(req.actor!.userId, event)) return refuse(res, 403, "ROLE_NOT_AUTHORISED", NOT_ASSIGNED_WITHDRAW);

      const outcome = await sql.begin(async (tx) => {
        const locked = (await lockBookingRequest(tx, id))!;
        if (locked.status !== "PENDING") return { code: "NOT_PENDING", locked } as const;
        await withdrawBookingRequest(tx, id, req.actor!.userId);
        return { code: "WITHDRAWN", withdrawn: (await findBookingRequest(tx, id))! } as const;
      });

      if (outcome.code === "NOT_PENDING") {
        return refuse(res, 409, "BOOKING_REQUEST_NOT_PENDING", notPendingMessage(outcome.locked.reference, outcome.locked.status, "withdrawn"));
      }
      res.json(present(outcome.withdrawn, event.reference));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
