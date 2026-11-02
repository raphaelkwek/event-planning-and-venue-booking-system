import { Router, type RequestHandler, type Response } from "express";
import type { Sql } from "postgres";
import { EVENT_STATUS_LABELS, type EventStatus, type UserSummary } from "@connectsphere/contracts";
import { mayManage, readAdditionRequest, registrationTotals, takesAdditions } from "../domain/management.js";
import { additionDuplicateMessage, attendeeNotFoundMessage, eventClosedMessage, noBookingMessage, overCapacityMessage } from "../domain/refusals.js";
import { logger } from "../logger.js";
import { findListing, type Listing } from "../repo/listings.js";
import { listRegistrationsOfEvent, registrationCountsOf, type EventRegistrationCursor } from "../repo/registrations.js";
import { placeCountsOf } from "../repo/seats.js";
import { capacityOf } from "../repo/venues.js";
import { listEntriesOfEvent, waitingCountOf, type WaitlistCursor } from "../repo/waitlist.js";
import { addManually } from "../service/addManually.js";
import { IdentityUnavailableError, staffOnly, type Authenticator, type CallerRequest } from "./auth.js";
import { nameOf, type Directory } from "./directory.js";
import { refuse } from "./errors.js";
import { handle, isInstant, isUuid, MAX_LIMIT, pageOf, readPage, UUID } from "./http.js";
import { presentManagedEntry, presentManagedEvent, presentManagedRegistration } from "./present.js";

/**
 * R5 to R7 — the organiser's side, under /api/v1/events/:eventId, for the
 * owning organiser and the assigned coordinator only:
 * - GET  /registrations: who has registered, with the totals (R5);
 * - GET  /waitlist: the waitlist in the order it was joined (R6);
 * - POST /manual-registrations: add an attendee by hand (R7).
 * Anyone else is answered 404, as if the event did not exist, so they receive
 * no registration data; an attendee is refused the role (403). Every route is
 * rate limited before its token is checked. Names come from identity, asked
 * outside any transaction (directory.ts).
 */

const NOT_MANAGED = "No event you manage has that id.";
const UNAVAILABLE = "Who that attendee is could not be checked because the identity service is unavailable. Nothing was changed.";

export function managementRouter(deps: { sql: Sql; auth: Authenticator; directory: Directory; limiter: RequestHandler; now: () => Date }): Router {
  const { sql, directory, limiter, now } = deps;
  const staff = staffOnly(deps.auth);
  const router = Router();

  /** The event, if the caller manages it; otherwise the 404 is already sent. */
  async function managed(req: CallerRequest, res: Response): Promise<Listing | null> {
    const eventId = req.params.eventId!;
    const listing = UUID.test(eventId) ? await findListing(sql, eventId) : null;
    if (listing && mayManage(listing, req.caller!.id)) return listing;
    refuse(res, 404, "EVENT_NOT_FOUND", NOT_MANAGED);
    return null;
  }

  /** The people on a page, by name. A list is still worth showing without names, so identity being down is not a failure here. */
  async function namesFor(req: CallerRequest, ids: string[]): Promise<{ names: Map<string, UserSummary>; namesAvailable: boolean }> {
    if (ids.length === 0) return { names: new Map(), namesAvailable: true };
    try {
      return { names: await directory.namesOf(req.token!, ids), namesAvailable: true };
    } catch (error) {
      if (!(error instanceof IdentityUnavailableError)) throw error;
      logger.warn("names unavailable: identity could not be asked", { correlationId: req.header("x-correlation-id") ?? null, error: error.message });
      return { names: new Map(), namesAvailable: false };
    }
  }

  // R5: the event's registrations in the order they were made, with the totals.
  router.get(
    "/api/v1/events/:eventId/registrations",
    limiter,
    staff,
    handle(async (req, res) => {
      const listing = await managed(req, res);
      if (!listing) return;
      const page = readPage<EventRegistrationCursor>(req, res, (c) => isInstant(c.registeredAt) && isUuid(c.id), MAX_LIMIT);
      if (!page) return;
      const eventId = listing.eventId;
      const [rows, counts, places, { capacity }, waiting] = await Promise.all([
        listRegistrationsOfEvent(sql, eventId, page.limit, page.after),
        registrationCountsOf(sql, eventId),
        placeCountsOf(sql, [eventId]),
        capacityOf(sql, eventId),
        waitingCountOf(sql, eventId),
      ]);
      const { items, nextCursor } = pageOf(rows, page.limit, (last) => ({ registeredAt: last.registeredAt, id: last.id }));
      const { names, namesAvailable } = await namesFor(req, items.flatMap((r) => (r.addedBy ? [r.attendeeId, r.addedBy] : [r.attendeeId])));
      res.json({
        event: presentManagedEvent(listing),
        totals: registrationTotals({ ...counts, capacity, ...places.get(eventId)! }),
        // R6: the waitlist is counted apart; its entries are never registrations.
        waitlist: { waiting },
        items: items.map((r) => presentManagedRegistration(r, names)),
        nextCursor,
        namesAvailable,
      });
    }),
  );

  // R6: the event's waitlist in the order it was joined, each waiting entry with its place in the line.
  router.get(
    "/api/v1/events/:eventId/waitlist",
    limiter,
    staff,
    handle(async (req, res) => {
      const listing = await managed(req, res);
      if (!listing) return;
      const page = readPage<WaitlistCursor>(req, res, (c) => isInstant(c.joinedAt) && isUuid(c.id), MAX_LIMIT);
      if (!page) return;
      const [rows, waiting] = await Promise.all([listEntriesOfEvent(sql, listing.eventId, page.limit, page.after), waitingCountOf(sql, listing.eventId)]);
      const { items, nextCursor } = pageOf(rows, page.limit, (last) => ({ joinedAt: last.joinedAt, id: last.id }));
      const { names, namesAvailable } = await namesFor(req, items.map((e) => e.attendeeId));
      res.json({ event: presentManagedEvent(listing), waiting, items: items.map((e) => presentManagedEntry(e, names)), nextCursor, namesAvailable });
    }),
  );

  // R7: add an attendee by hand.
  router.post(
    "/api/v1/events/:eventId/manual-registrations",
    limiter,
    staff,
    handle(async (req, res) => {
      const listing = await managed(req, res);
      if (!listing) return;
      const input = readAdditionRequest(req.body);
      if (!input.ok) return refuse(res, 400, "VALIDATION_FAILED", "The addition is not complete.", { fields: input.fields });
      const event = { reference: listing.eventReference, name: listing.name };
      if (!takesAdditions(listing.status)) {
        const label = EVENT_STATUS_LABELS[listing.status as EventStatus] ?? listing.status;
        return refuse(res, 409, "REGISTRATION_EVENT_CLOSED", eventClosedMessage(event, label), { details: { status: listing.status } });
      }
      const { confirmedBookings } = await capacityOf(sql, listing.eventId);
      if (confirmedBookings === 0) return refuse(res, 422, "REGISTRATION_NO_CONFIRMED_BOOKING", noBookingMessage(event));

      let attendee: UserSummary | null;
      let adder: Map<string, UserSummary>;
      try {
        [attendee, adder] = await Promise.all([
          directory.attendeeByEmail(req.token!, input.value.attendeeEmail),
          directory.namesOf(req.token!, [req.caller!.id]).catch(() => new Map<string, UserSummary>()),
        ]);
      } catch (error) {
        if (!(error instanceof IdentityUnavailableError)) throw error;
        return refuse(res, 503, "IDENTITY_UNAVAILABLE", UNAVAILABLE);
      }
      if (!attendee) {
        return refuse(res, 422, "ATTENDEE_NOT_FOUND", attendeeNotFoundMessage(input.value.attendeeEmail), {
          fields: [{ field: "attendeeEmail", message: "No attendee account has this email." }],
        });
      }

      const outcome = await addManually(sql, {
        listing,
        attendee,
        addedBy: { id: req.caller!.id, role: req.caller!.role, name: nameOf(adder.get(req.caller!.id)) },
        reason: input.value.reason,
        confirmOverCapacity: input.value.confirmOverCapacity,
        now: now(),
        correlationId: req.header("x-correlation-id") ?? null,
      });
      if (outcome.ok) {
        const names = new Map([...adder, [attendee.id, attendee]]);
        return res.status(201).json({ ...presentManagedRegistration(outcome.registration, names), capacity: outcome.preview.capacity, totalAfter: outcome.preview.totalAfter });
      }
      if (outcome.code === "DUPLICATE") {
        return refuse(res, 409, "REGISTRATION_DUPLICATE", additionDuplicateMessage(event, attendee.email, outcome.existing.reference), {
          details: { registrationId: outcome.existing.id, registrationReference: outcome.existing.reference },
        });
      }
      return refuse(res, 409, "REGISTRATION_OVER_CAPACITY_UNCONFIRMED", overCapacityMessage(event, outcome.preview.capacity, outcome.preview.totalAfter), {
        details: { capacity: outcome.preview.capacity, registered: outcome.registered, totalAfter: outcome.preview.totalAfter },
      });
    }),
  );

  return router;
}
