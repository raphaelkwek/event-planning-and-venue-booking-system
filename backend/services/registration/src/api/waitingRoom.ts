import { Router, type NextFunction, type Request, type RequestHandler, type Response } from "express";
import type { Sql } from "postgres";
import { waitingRoomNotRequiredMessage, windowMessage } from "../domain/refusals.js";
import { config } from "../config.js";
import { joinWaitingRoom, placeById, type WaitingRoomConfig } from "../service/waitingRoom.js";
import { attendeeOnly, signedIn, type Authenticator, type CallerRequest } from "./auth.js";
import { refuse } from "./errors.js";
import { waitingRoomRateLimiter } from "./limiter.js";

/**
 * EN-19 — the waiting room (ADR-0011), under /api/v1/waiting-room:
 * - POST /entries: join the queue of a high-demand event, attendees only (the
 *   identity check is one call per attendee, at joining);
 * - GET /entries/:entryId: where the place stands and, once admitted, the
 *   admission token. Polled every couple of seconds, so it asks nobody: it
 *   needs only a valid Supabase token, checked locally, and the unguessable
 *   entry id. The token it returns names the attendee it was issued to, so
 *   another attendee who somehow held the id could read a place but not use it.
 * Both routes are rate limited before the token is checked.
 */

export interface WaitingRoomRouterDeps {
  sql: Sql;
  auth: Authenticator;
  /** Tests pass a no-op; the app passes one shared limiter. */
  limiter?: RequestHandler;
  clock?: () => Date;
  /** Tests choose the rate, the token's life and the key. */
  waitingRoom?: WaitingRoomConfig;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EVENT_NOT_FOUND = "No event open for registration has that id.";
const ENTRY_NOT_FOUND = "There is no place in a waiting room with that id.";

/** Express 4 does not catch a rejected promise from an async handler, so every handler passes its errors on. */
const handle =
  (fn: (req: CallerRequest, res: Response) => Promise<unknown>): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req as CallerRequest, res).catch(next);
  };

export function waitingRoomRouter(deps: WaitingRoomRouterDeps): Router {
  const { sql, auth } = deps;
  const limiter = deps.limiter ?? waitingRoomRateLimiter();
  const now = deps.clock ?? (() => new Date());
  const room = deps.waitingRoom ?? config.waitingRoom;
  const router = Router();

  // Join the queue.
  router.post(
    "/api/v1/waiting-room/entries",
    limiter,
    attendeeOnly(auth),
    handle(async (req, res) => {
      const eventId = (req.body as { eventId?: unknown } | undefined)?.eventId;
      if (typeof eventId !== "string" || !UUID.test(eventId)) {
        return refuse(res, 400, "VALIDATION_FAILED", "Say which event's waiting room to join.", {
          fields: [{ field: "eventId", message: "Give the event's id." }],
        });
      }
      const outcome = await joinWaitingRoom(sql, { eventId, attendeeId: req.caller!.id, now: now() }, room);
      if (outcome.ok) return res.status(outcome.created ? 201 : 200).json(outcome.place);
      switch (outcome.code) {
        case "EVENT_NOT_FOUND":
          return refuse(res, 404, "EVENT_NOT_FOUND", EVENT_NOT_FOUND);
        case "NOT_REQUIRED":
          return refuse(res, 409, "WAITING_ROOM_NOT_REQUIRED", waitingRoomNotRequiredMessage({ reference: outcome.listing.eventReference, name: outcome.listing.name }));
        case "UNAVAILABLE":
          return refuse(res, 503, "WAITING_ROOM_UNAVAILABLE", "The waiting room is not available right now, so nobody can be admitted. Try again later.");
        case "OUTSIDE_WINDOW":
          return refuse(
            res,
            422,
            "REGISTRATION_OUTSIDE_WINDOW",
            windowMessage({ reference: outcome.listing.eventReference, name: outcome.listing.name }, outcome.state, outcome.listing.registrationOpensAt, outcome.listing.registrationClosesAt),
            { details: { registrationOpensAt: outcome.listing.registrationOpensAt, registrationClosesAt: outcome.listing.registrationClosesAt } },
          );
      }
    }),
  );

  // Where my place stands.
  router.get(
    "/api/v1/waiting-room/entries/:entryId",
    limiter,
    signedIn(auth),
    handle(async (req, res) => {
      const entryId = req.params.entryId!;
      const place = UUID.test(entryId) ? await placeById(sql, entryId, now(), room) : null;
      if (!place) return refuse(res, 404, "WAITING_ROOM_ENTRY_NOT_FOUND", ENTRY_NOT_FOUND);
      res.json(place);
    }),
  );

  return router;
}
