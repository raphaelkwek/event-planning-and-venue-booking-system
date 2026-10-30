import { Router, type NextFunction, type RequestHandler, type Response } from "express";
import { rateLimit } from "express-rate-limit";
import type { Sql, TransactionSql } from "postgres";
import {
  blockReturnsToPlanning,
  findEventForPlanning,
  returnBlockedEventsToPlanning,
  type EventPlanningView,
} from "../../event/index.js";
import { authenticate, requireRole, type ActorRequest } from "../auth/actor.js";
import { NOT_VENUE_STAFF, readBlock, readPeriod } from "../domain/unavailability.js";
import { writeVenueOutbox } from "../events/outbox.js";
import { isVenueStaff } from "../repo/bookingDecisions.js";
import { lockVenue } from "../repo/slots.js";
import {
  clearDisruptions,
  disruptedBy,
  findBlock,
  flagDisruptions,
  insertBlock,
  listActiveBlocks,
  lockBlock,
  removeBlock,
  type Block,
  type ClearedDisruption,
  type Disrupted,
} from "../repo/unavailability.js";
import { findVenue, type VenueRecord } from "../repo/venues.js";
import { refuse } from "./errors.js";

/**
 * I2 — the venue's Venue Staff record periods when it can't be used, even
 * periods already booked (C-12), and remove them.
 *
 * A block never refuses or releases what it overlaps: each confirmed booking,
 * hold and pending request it disrupts is flagged Requires Reconfirmation, and
 * the coordinator is told alternative arrangements are required (CR-02), which
 * L5 provides. Recording a block takes the venue row lock first, as M1's
 * approval does (implementation.md §4.6, rule 1), so the two never interleave.
 *
 * I3 — a Confirmed event whose confirmed booking the block disrupts returns to
 * Planning (W9-50), and its coordinator's message says so. The events are
 * locked after the venue row and before the bookings are flagged, F5's order.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Disrupted events are read whatever the caller's event scope: blocking is scoped by venue. */
const ALL_EVENTS = { scopeType: "ALL" } as const;
const INVALID = "The unavailability could not be recorded. Check the highlighted fields.";

/**
 * At most 120 requests a minute from one address to these routes, refused before
 * any identity lookup or query. A stopgap until the gateway limits requests
 * (ADR-0011, EN-12); CodeQL (js/missing-rate-limiting) requires one.
 */
export function unavailabilityRateLimit(): RequestHandler {
  return rateLimit({
    windowMs: 60_000,
    limit: 120,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, res) => refuse(res, 429, "RATE_LIMITED", "Too many unavailability requests. Wait a minute and try again."),
  });
}

const blockNotFound = (res: Response) => refuse(res, 404, "BLOCK_NOT_FOUND", "No unavailability with that id exists at this venue.");

/** The venue, when the caller is one of its Venue Staff; otherwise the refusal is sent and the result is null. */
async function staffVenue(sql: Sql, req: ActorRequest, res: Response): Promise<VenueRecord | null> {
  const id = req.params.id!;
  const venue = UUID.test(id) ? await findVenue(sql, id) : null;
  if (!venue) {
    refuse(res, 404, "VENUE_NOT_FOUND", "No venue with that id exists.");
    return null;
  }
  if (!(await isVenueStaff(sql, venue.id, req.actor!.userId))) {
    refuse(res, 403, "ROLE_NOT_AUTHORISED", NOT_VENUE_STAFF);
    return null;
  }
  return venue;
}

/** Each disrupted event, read once. An event that no longer exists is left out. */
async function eventsOf(sql: Sql, eventIds: readonly string[], callerId: string): Promise<Map<string, EventPlanningView>> {
  const events = new Map<string, EventPlanningView>();
  for (const id of new Set(eventIds)) {
    const event = await findEventForPlanning(sql, id, ALL_EVENTS, callerId);
    if (event) events.set(id, event);
  }
  return events;
}

/** A booking's or hold's event's assigned coordinator; a request's requesting coordinator (I2, CR-02). */
function coordinatorOf(item: { kind: string; requestedBy: string | null }, event: EventPlanningView): string | null {
  return item.kind === "REQUEST" ? item.requestedBy : event.assignedCoordinatorId;
}

/** Writes one message per disrupted or cleared item whose event has a reference and a coordinator to tell. */
async function tellCoordinators(
  tx: TransactionSql,
  req: ActorRequest,
  messageType: "venue-booking.booking-disrupted" | "venue-booking.disruption-cleared",
  block: Block,
  venue: VenueRecord,
  items: readonly (Disrupted | ClearedDisruption)[],
  events: Map<string, EventPlanningView>,
  acted: { by: string; at: string },
  returned: ReadonlySet<string> = new Set(),
): Promise<void> {
  for (const item of items) {
    const event = events.get(item.eventId);
    const coordinatorId = event ? coordinatorOf(item, event) : null;
    if (!event?.reference || !coordinatorId) continue;
    await writeVenueOutbox(tx, {
      messageType,
      aggregateId: block.id,
      actor: req.actor!,
      correlationId: req.header("x-correlation-id") ?? null,
      payload: {
        blockId: block.id,
        venueId: venue.id,
        venueName: venue.name,
        kind: item.kind,
        reference: item.reference,
        eventId: event.id,
        eventReference: event.reference,
        eventName: event.name,
        coordinatorId,
        blockStartsAt: block.startsAt,
        blockEndsAt: block.endsAt,
        reasonType: block.reasonType,
        description: block.description,
        actedBy: acted.by,
        actedAt: acted.at,
        ...("stillDisrupted" in item ? { stillDisrupted: item.stillDisrupted, stillCause: item.stillCause } : {}),
        ...(returned.has(event.id) ? { eventReturnedToPlanning: true } : {}),
      },
    });
  }
}

/** I3: the events whose confirmed bookings a block disrupts; those that are Confirmed return to Planning. */
const bookedEventIds = (items: readonly Disrupted[]) => items.filter((d) => d.kind === "BOOKING").map((d) => d.eventId);

/**
 * What a block disrupts, as Venue Staff are shown it: with the event's reference
 * (I2-T4), and whether the event returns to Planning (I3). Recording passes the
 * events it returned; the review works it out from their status now.
 */
async function presentDisrupted(sql: Sql, items: readonly Disrupted[], callerId: string, returned?: ReadonlySet<string>) {
  const events = await eventsOf(sql, items.map((d) => d.eventId), callerId);
  const returning =
    returned ?? new Set(bookedEventIds(items).filter((id) => events.has(id) && blockReturnsToPlanning(events.get(id)!.status)));
  return items.map((d) => ({
    kind: d.kind,
    reference: d.reference,
    eventReference: events.get(d.eventId)?.reference ?? null,
    overlapFrom: d.overlapFrom,
    overlapUntil: d.overlapUntil,
    returnsEventToPlanning: returning.has(d.eventId),
  }));
}

export function unavailabilityRouter(sql: Sql) {
  const router = Router();
  const limiter = unavailabilityRateLimit();
  const BASE = "/api/v1/venues/:id/unavailability";

  // I2: the venue's active blocks, for its Venue Staff to review and remove.
  router.get(BASE, limiter, authenticate, requireRole("VENUE_STAFF"), async (req: ActorRequest, res: Response, next: NextFunction) => {
    try {
      const venue = await staffVenue(sql, req, res);
      if (!venue) return;
      res.json({ items: await listActiveBlocks(sql, venue.id) });
    } catch (error) {
      next(error);
    }
  });

  // I2-T4: before confirming, each booking, hold and request a block over this period would disrupt.
  router.get(`${BASE}/impact`, limiter, authenticate, requireRole("VENUE_STAFF"), async (req: ActorRequest, res: Response, next: NextFunction) => {
    try {
      const venue = await staffVenue(sql, req, res);
      if (!venue) return;
      const period = readPeriod(req.query as Record<string, unknown>);
      if (!period.ok) return refuse(res, 400, "VALIDATION_FAILED", INVALID, period.fields);
      const items = await disruptedBy(sql, venue.id, new Date(period.startsAt), period.endsAt === null ? null : new Date(period.endsAt));
      res.json({ items: await presentDisrupted(sql, items, req.actor!.userId) });
    } catch (error) {
      next(error);
    }
  });

  // I2: record a block, flagging what it disrupts and telling their coordinators.
  router.post(BASE, limiter, authenticate, requireRole("VENUE_STAFF"), async (req: ActorRequest, res: Response, next: NextFunction) => {
    try {
      const venue = await staffVenue(sql, req, res);
      if (!venue) return;
      const read = readBlock(req.body);
      if (!read.ok) return refuse(res, 400, "VALIDATION_FAILED", INVALID, read.fields);
      const actor = req.actor!;

      const correlationId = req.header("x-correlation-id") ?? null;
      const { block, disrupted, returned } = await sql.begin(async (tx) => {
        await lockVenue(tx, venue.id);
        const block = await insertBlock(tx, {
          venueId: venue.id,
          startsAt: new Date(read.block.startsAt),
          endsAt: read.block.endsAt === null ? null : new Date(read.block.endsAt),
          reasonType: read.block.reasonType,
          description: read.block.description,
          actorUserId: actor.userId,
        });
        const disrupted = await disruptedBy(tx, venue.id, new Date(block.startsAt), block.endsAt === null ? null : new Date(block.endsAt));
        const returned = await returnBlockedEventsToPlanning(tx, bookedEventIds(disrupted), { ...actor, correlationId });
        await flagDisruptions(tx, block.id, disrupted, actor.userId);
        const events = await eventsOf(sql, disrupted.map((d) => d.eventId), actor.userId);
        await tellCoordinators(
          tx,
          req,
          "venue-booking.booking-disrupted",
          block,
          venue,
          disrupted,
          events,
          { by: block.createdBy, at: block.createdAt },
          returned,
        );
        return { block, disrupted, returned };
      });

      res.status(201).json({ block, disrupted: await presentDisrupted(sql, disrupted, actor.userId, returned) });
    } catch (error) {
      next(error);
    }
  });

  // I2: remove a block. Its flags clear unless another active block still disrupts the same booking.
  router.post(`${BASE}/:blockId/remove`, limiter, authenticate, requireRole("VENUE_STAFF"), async (req: ActorRequest, res: Response, next: NextFunction) => {
    try {
      const venue = await staffVenue(sql, req, res);
      if (!venue) return;
      const blockId = req.params.blockId!;
      if (!UUID.test(blockId)) return blockNotFound(res);
      const actor = req.actor!;

      const outcome = await sql.begin(async (tx) => {
        await lockVenue(tx, venue.id);
        const locked = await lockBlock(tx, blockId);
        if (!locked || locked.venueId !== venue.id) return { code: "NOT_FOUND" } as const;
        if (locked.status === "REMOVED") return { code: "ALREADY_REMOVED" } as const;
        await removeBlock(tx, blockId, actor.userId);
        const cleared = await clearDisruptions(tx, blockId);
        const removed = (await findBlock(tx, blockId))!;
        const events = await eventsOf(sql, cleared.map((c) => c.eventId), actor.userId);
        await tellCoordinators(tx, req, "venue-booking.disruption-cleared", removed, venue, cleared, events, {
          by: removed.removedBy!,
          at: removed.removedAt!,
        });
        return { code: "REMOVED", removed, cleared, events } as const;
      });

      if (outcome.code === "NOT_FOUND") return blockNotFound(res);
      if (outcome.code === "ALREADY_REMOVED") {
        return refuse(res, 409, "BLOCK_ALREADY_REMOVED", "This unavailability has already been removed.");
      }
      res.json({
        block: outcome.removed,
        cleared: outcome.cleared.map((c) => ({
          kind: c.kind,
          reference: c.reference,
          eventReference: outcome.events.get(c.eventId)?.reference ?? null,
          stillDisrupted: c.stillDisrupted,
        })),
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
