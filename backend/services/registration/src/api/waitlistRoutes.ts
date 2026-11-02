import { Router, type RequestHandler } from "express";
import type { Sql } from "postgres";
import { waitlistDuplicateMessage, waitlistNotActiveMessage, waitlistPlacesMessage, waitlistRegisteredMessage, windowMessage } from "../domain/refusals.js";
import { listingsOf } from "../repo/listings.js";
import { listEntriesOfAttendee, type WaitlistCursor } from "../repo/waitlist.js";
import { joinWaitlist, leaveWaitlist } from "../service/waitlist.js";
import { attendeeOnly, type Authenticator } from "./auth.js";
import { refuse } from "./errors.js";
import { handle, isInstant, isUuid, pageOf, readPage, UUID } from "./http.js";
import { presentWaitlistEntry } from "./present.js";

/**
 * R6 — the attendee's side of the waitlist, under /api/v1, attendees only:
 * - POST /events/:eventId/waitlist: join, after R2 refused for capacity;
 * - GET  /waitlist-entries: my entries, newest first;
 * - POST /waitlist-entries/:id/withdrawal: leave, at any time while waiting.
 * Each route is rate limited before its token is checked.
 */

const EVENT_NOT_FOUND = "No event open for registration has that id.";
const ENTRY_NOT_FOUND = "No waitlist entry with that id is yours.";

export function waitlistRouter(deps: { sql: Sql; auth: Authenticator; limiter: RequestHandler; now: () => Date }): Router {
  const { sql, limiter, now } = deps;
  const attendee = attendeeOnly(deps.auth);
  const router = Router();

  router.post(
    "/api/v1/events/:eventId/waitlist",
    limiter,
    attendee,
    handle(async (req, res) => {
      const eventId = req.params.eventId!;
      if (!UUID.test(eventId)) return refuse(res, 404, "EVENT_NOT_FOUND", EVENT_NOT_FOUND);
      const outcome = await joinWaitlist(sql, { eventId, attendeeId: req.caller!.id, now: now() });
      if (outcome.ok) return res.status(201).json(presentWaitlistEntry(outcome.entry, outcome.listing));
      if (outcome.code === "EVENT_NOT_FOUND") return refuse(res, 404, "EVENT_NOT_FOUND", EVENT_NOT_FOUND);
      const event = { reference: outcome.listing.eventReference, name: outcome.listing.name };
      switch (outcome.code) {
        case "OUTSIDE_WINDOW":
          return refuse(res, 422, "REGISTRATION_OUTSIDE_WINDOW", windowMessage(event, outcome.state, outcome.listing.registrationOpensAt, outcome.listing.registrationClosesAt), {
            details: { registrationOpensAt: outcome.listing.registrationOpensAt, registrationClosesAt: outcome.listing.registrationClosesAt },
          });
        case "PLACES_AVAILABLE":
          return refuse(res, 409, "WAITLIST_PLACES_AVAILABLE", waitlistPlacesMessage(event, outcome.placesRemaining), {
            details: { placesRemaining: outcome.placesRemaining },
          });
        case "REGISTERED":
          return refuse(res, 409, "REGISTRATION_DUPLICATE", waitlistRegisteredMessage(event, outcome.registration.reference), {
            details: { registrationId: outcome.registration.id, registrationReference: outcome.registration.reference },
          });
        case "DUPLICATE":
          return refuse(res, 409, "WAITLIST_DUPLICATE", waitlistDuplicateMessage(event, outcome.existing.reference), {
            details: { waitlistEntryId: outcome.existing.id, waitlistReference: outcome.existing.reference, position: outcome.existing.position },
          });
      }
    }),
  );

  router.get(
    "/api/v1/waitlist-entries",
    limiter,
    attendee,
    handle(async (req, res) => {
      const page = readPage<WaitlistCursor>(req, res, (c) => isInstant(c.joinedAt) && isUuid(c.id));
      if (!page) return;
      const rows = await listEntriesOfAttendee(sql, req.caller!.id, page.limit, page.after);
      const { items, nextCursor } = pageOf(rows, page.limit, (last) => ({ joinedAt: last.joinedAt, id: last.id }));
      const listings = await listingsOf(sql, [...new Set(items.map((e) => e.eventId))]);
      res.json({ items: items.map((e) => presentWaitlistEntry(e, listings.get(e.eventId))), nextCursor });
    }),
  );

  router.post(
    "/api/v1/waitlist-entries/:id/withdrawal",
    limiter,
    attendee,
    handle(async (req, res) => {
      const id = req.params.id!;
      if (!UUID.test(id)) return refuse(res, 404, "WAITLIST_ENTRY_NOT_FOUND", ENTRY_NOT_FOUND);
      const outcome = await leaveWaitlist(sql, { entryId: id, attendeeId: req.caller!.id, now: now() });
      if (outcome.ok) {
        const listings = await listingsOf(sql, [outcome.entry.eventId]);
        return res.json(presentWaitlistEntry(outcome.entry, listings.get(outcome.entry.eventId)));
      }
      if (outcome.code === "NOT_FOUND") return refuse(res, 404, "WAITLIST_ENTRY_NOT_FOUND", ENTRY_NOT_FOUND);
      const status = outcome.entry.status as "REGISTERED" | "WITHDRAWN" | "CANCELLED";
      return refuse(res, 409, "WAITLIST_ENTRY_NOT_ACTIVE", waitlistNotActiveMessage(outcome.entry.reference, status), { details: { status } });
    }),
  );

  return router;
}
