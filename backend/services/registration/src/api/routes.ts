import { Router, type NextFunction, type Request, type RequestHandler, type Response } from "express";
import type { Sql } from "postgres";
import { isListed } from "../domain/registrationRules.js";
import { admissionExpiredMessage, admissionRequiredMessage, capacityMessage, deadlineMessage, duplicateMessage, notActiveMessage, windowMessage } from "../domain/refusals.js";
import { findListing, listingsOf, listOpenListings, type ListingCursor } from "../repo/listings.js";
import { findRegistrationOfAttendee, listRegistrationsOfAttendee, type Registration, type RegistrationCursor } from "../repo/registrations.js";
import { placeCountsOf } from "../repo/seats.js";
import { venuesOf } from "../repo/venues.js";
import { register } from "../service/register.js";
import { withdraw } from "../service/withdraw.js";
import { config } from "../config.js";
import { attendeeOnly, signedIn, type Authenticator, type CallerRequest } from "./auth.js";
import { refuse } from "./errors.js";
import { registrationRateLimiter } from "./limiter.js";
import { presentOpenEvent, presentRegistration } from "./present.js";

/**
 * R1 to R4 — the attendee API, under /api/v1:
 * - GET  /open-events, /open-events/:eventId: browse (R1), any signed-in user;
 * - POST /registrations: register (R2), attendees only;
 * - GET  /registrations, /registrations/:id: my registrations (R3), attendees only, only their own;
 * - POST /registrations/:id/withdrawal: withdraw (R4), attendees only, only their own.
 * Every route is rate limited before its token is checked.
 */

export interface RouterDeps {
  sql: Sql;
  auth: Authenticator;
  /** Tests pass a no-op; the app passes one shared limiter. */
  limiter?: RequestHandler;
  /** The instant rules are judged at; tests fix it to test a boundary at the millisecond. */
  clock?: () => Date;
  /** EN-19: the key admission tokens are signed with; tests choose their own. */
  signingKey?: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
/**
 * What a CDN may keep of the browse API (EN-12, ADR-0011): five seconds, and
 * a stale copy for thirty more while it fetches a fresh one. Only the published
 * listing is cached this way; it holds nothing about the caller. Everything else
 * this service sends is `no-store` (app.ts), and registering always re-checks live.
 */
export const BROWSE_CACHE_CONTROL = "public, max-age=5, stale-while-revalidate=30";

const EVENT_NOT_FOUND = "No event open for registration has that id.";
const REGISTRATION_NOT_FOUND = "No registration with that id is yours.";

/** Express 4 does not catch a rejected promise from an async handler, so every handler passes its errors on. */
const handle =
  (fn: (req: CallerRequest, res: Response) => Promise<unknown>): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req as CallerRequest, res).catch(next);
  };

function encodeCursor(cursor: object): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

function decodeCursor<T>(text: string, valid: (value: Record<string, unknown>) => boolean): T | null {
  try {
    const value = JSON.parse(Buffer.from(text, "base64url").toString("utf8")) as Record<string, unknown>;
    if (value && typeof value === "object" && valid(value)) return value as T;
  } catch {
    // Not a cursor this service issued.
  }
  return null;
}

const isInstant = (value: unknown) => typeof value === "string" && !Number.isNaN(Date.parse(value));
const isUuid = (value: unknown) => typeof value === "string" && UUID.test(value);

/** The page size and cursor, or the refusal already sent. */
function readPage<T>(req: Request, res: Response, valid: (value: Record<string, unknown>) => boolean): { limit: number; after: T | null } | null {
  const limit = req.query.limit === undefined ? DEFAULT_LIMIT : Number(req.query.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    refuse(res, 400, "VALIDATION_FAILED", `limit must be a whole number from 1 to ${MAX_LIMIT}.`, {
      fields: [{ field: "limit", message: `Give a whole number from 1 to ${MAX_LIMIT}.` }],
    });
    return null;
  }
  if (req.query.cursor === undefined) return { limit, after: null };
  const after = typeof req.query.cursor === "string" ? decodeCursor<T>(req.query.cursor, valid) : null;
  if (!after) {
    refuse(res, 400, "VALIDATION_FAILED", "cursor is not one this service issued.", {
      fields: [{ field: "cursor", message: "Use the nextCursor from a previous page." }],
    });
    return null;
  }
  return { limit, after };
}

export function registrationRouter(deps: RouterDeps): Router {
  const { sql, auth } = deps;
  const limiter = deps.limiter ?? registrationRateLimiter();
  const now = deps.clock ?? (() => new Date());
  const signingKey = deps.signingKey ?? config.waitingRoom.signingKey;
  const anyone = signedIn(auth);
  const attendee = attendeeOnly(auth);
  const router = Router();

  /** The registrations with their events' listings and venues, as attendees see them. */
  async function present(registrations: Registration[]) {
    const eventIds = [...new Set(registrations.map((r) => r.eventId))];
    const [listings, venues] = await Promise.all([listingsOf(sql, eventIds), venuesOf(sql, eventIds)]);
    return registrations.map((r) => presentRegistration(r, listings.get(r.eventId), venues.get(r.eventId)!));
  }

  // R1: the events open for registration, soonest first.
  router.get(
    "/api/v1/open-events",
    limiter,
    anyone,
    handle(async (req, res) => {
      const page = readPage<ListingCursor>(req, res, (c) => isInstant(c.startsAt) && isUuid(c.eventId));
      if (!page) return;
      const rows = await listOpenListings(sql, now(), page.limit, page.after);
      const items = rows.slice(0, page.limit);
      const eventIds = items.map((l) => l.eventId);
      const [venues, counts] = await Promise.all([venuesOf(sql, eventIds), placeCountsOf(sql, eventIds)]);
      const last = items[items.length - 1];
      res.setHeader("Cache-Control", BROWSE_CACHE_CONTROL);
      res.json({
        items: items.map((l) => presentOpenEvent(l, venues.get(l.eventId)!, counts.get(l.eventId)!)),
        nextCursor: rows.length > page.limit && last ? encodeCursor({ startsAt: last.startsAt, eventId: last.eventId }) : null,
      });
    }),
  );

  // R1, R2: one open event, for its page.
  router.get(
    "/api/v1/open-events/:eventId",
    limiter,
    anyone,
    handle(async (req, res) => {
      const eventId = req.params.eventId!;
      const listing = UUID.test(eventId) ? await findListing(sql, eventId) : null;
      if (!listing || !isListed(listing, now())) return refuse(res, 404, "EVENT_NOT_FOUND", EVENT_NOT_FOUND);
      const [venues, counts] = await Promise.all([venuesOf(sql, [eventId]), placeCountsOf(sql, [eventId])]);
      res.setHeader("Cache-Control", BROWSE_CACHE_CONTROL);
      res.json(presentOpenEvent(listing, venues.get(eventId)!, counts.get(eventId)!));
    }),
  );

  // R2: register.
  router.post(
    "/api/v1/registrations",
    limiter,
    attendee,
    handle(async (req, res) => {
      const eventId = (req.body as { eventId?: unknown } | undefined)?.eventId;
      if (!isUuid(eventId)) {
        return refuse(res, 400, "VALIDATION_FAILED", "Say which event to register for.", {
          fields: [{ field: "eventId", message: "Give the event's id." }],
        });
      }
      const outcome = await register(sql, {
        eventId: eventId as string,
        attendeeId: req.caller!.id,
        now: now(),
        correlationId: req.header("x-correlation-id") ?? null,
        admission: { token: req.header("x-admission-token") ?? null, signingKey },
      });
      if (outcome.ok) {
        const [view] = await present([outcome.registration]);
        return res.status(201).json(view);
      }
      const event = outcome.code === "EVENT_NOT_FOUND" ? null : { reference: outcome.listing.eventReference, name: outcome.listing.name };
      switch (outcome.code) {
        case "EVENT_NOT_FOUND":
          return refuse(res, 404, "EVENT_NOT_FOUND", EVENT_NOT_FOUND);
        case "OUTSIDE_WINDOW":
          return refuse(res, 422, "REGISTRATION_OUTSIDE_WINDOW", windowMessage(event!, outcome.state, outcome.listing.registrationOpensAt, outcome.listing.registrationClosesAt), {
            details: { registrationOpensAt: outcome.listing.registrationOpensAt, registrationClosesAt: outcome.listing.registrationClosesAt },
          });
        case "DUPLICATE":
          return refuse(res, 409, "REGISTRATION_DUPLICATE", duplicateMessage(event!, outcome.existing.reference), {
            details: { registrationId: outcome.existing.id, registrationReference: outcome.existing.reference },
          });
        case "FULL":
          return refuse(res, 409, "REGISTRATION_FULL", capacityMessage(event!), {
            details: { eventId, placesRemaining: 0, waitlistOffered: true },
          });
        case "ADMISSION_REQUIRED":
          return refuse(res, 403, "ADMISSION_REQUIRED", admissionRequiredMessage(event!), { details: { eventId, waitingRoom: true } });
        case "ADMISSION_EXPIRED":
          return refuse(res, 403, "ADMISSION_EXPIRED", admissionExpiredMessage(event!), { details: { eventId, waitingRoom: true } });
        case "WAITING_ROOM_UNAVAILABLE":
          return refuse(res, 503, "WAITING_ROOM_UNAVAILABLE", "The waiting room is not available right now, so nobody can be admitted. Try again later.");
      }
    }),
  );

  // R3: my registrations, newest first.
  router.get(
    "/api/v1/registrations",
    limiter,
    attendee,
    handle(async (req, res) => {
      const page = readPage<RegistrationCursor>(req, res, (c) => isInstant(c.registeredAt) && isUuid(c.id));
      if (!page) return;
      const rows = await listRegistrationsOfAttendee(sql, req.caller!.id, page.limit, page.after);
      const items = rows.slice(0, page.limit);
      const last = items[items.length - 1];
      res.json({
        items: await present(items),
        nextCursor: rows.length > page.limit && last ? encodeCursor({ registeredAt: last.registeredAt, id: last.id }) : null,
      });
    }),
  );

  // R3: one of mine. Another attendee's answers exactly as one that does not exist.
  router.get(
    "/api/v1/registrations/:id",
    limiter,
    attendee,
    handle(async (req, res) => {
      const id = req.params.id!;
      const registration = UUID.test(id) ? await findRegistrationOfAttendee(sql, id, req.caller!.id) : null;
      if (!registration) return refuse(res, 404, "REGISTRATION_NOT_FOUND", REGISTRATION_NOT_FOUND);
      const [view] = await present([registration]);
      res.json(view);
    }),
  );

  // R4: withdraw one of mine.
  router.post(
    "/api/v1/registrations/:id/withdrawal",
    limiter,
    attendee,
    handle(async (req, res) => {
      const id = req.params.id!;
      if (!UUID.test(id)) return refuse(res, 404, "REGISTRATION_NOT_FOUND", REGISTRATION_NOT_FOUND);
      const outcome = await withdraw(sql, {
        registrationId: id,
        attendeeId: req.caller!.id,
        now: now(),
        correlationId: req.header("x-correlation-id") ?? null,
      });
      if (outcome.ok) {
        const [view] = await present([outcome.registration]);
        return res.json(view);
      }
      switch (outcome.code) {
        case "NOT_FOUND":
          return refuse(res, 404, "REGISTRATION_NOT_FOUND", REGISTRATION_NOT_FOUND);
        case "NOT_ACTIVE":
          return refuse(res, 409, "REGISTRATION_NOT_ACTIVE", notActiveMessage(outcome.registration.reference, outcome.registration.status), {
            details: { status: outcome.registration.status },
          });
        case "DEADLINE_PASSED":
          return refuse(
            res,
            422,
            "WITHDRAWAL_DEADLINE_PASSED",
            deadlineMessage({ reference: outcome.listing.eventReference, name: outcome.listing.name }, outcome.registration.reference, outcome.deadline),
            { details: { withdrawalDeadline: outcome.deadline.at } },
          );
      }
    }),
  );

  return router;
}
