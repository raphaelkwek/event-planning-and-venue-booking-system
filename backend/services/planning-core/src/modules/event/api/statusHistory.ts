import { Router, type RequestHandler } from "express";
import type { Sql } from "postgres";
import { authenticate, requireRole, type ActorRequest } from "../auth/actor.js";
import { HISTORY_ROLES, toHistoryEntry, toStatusView } from "../domain/statusHistory.js";
import { findEventInScope } from "../repo/events.js";
import { listStatusHistory } from "../repo/statusHistory.js";
import { eventRateLimiter } from "./eventRateLimiter.js";
import { refuse } from "./errors.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NOT_FOUND = "No event with that reference is available to you.";

/**
 * F2 — an event's current status and its status history.
 *
 * Both reads go through the A3 access scope, so an event outside the caller's
 * relationship answers 404 and no data at all. The status is open to every role
 * that may see the event; the history is refused to every other role before the
 * event is even looked up, so an attendee can never be given it. There is no
 * write route here: history cannot be edited or deleted.
 */
export function statusHistoryRouter(sql: Sql, limiter: RequestHandler = eventRateLimiter()) {
  const router = Router();

  router.get("/api/v1/events/:id/status", limiter, ...authenticate, async (req: ActorRequest, res) => {
    const { userId, scope } = req.actor!;
    const event = UUID.test(req.params.id)
      ? await findEventInScope(sql, req.params.id, scope, userId)
      : null;
    if (!event) {
      refuse(res, 404, "EVENT_NOT_FOUND", NOT_FOUND);
      return;
    }
    res.status(200).json(toStatusView(event));
  });

  router.get(
    "/api/v1/events/:id/status-history",
    limiter,
    ...authenticate,
    requireRole(...HISTORY_ROLES),
    async (req: ActorRequest, res) => {
      const { userId, scope } = req.actor!;
      const event = UUID.test(req.params.id)
        ? await findEventInScope(sql, req.params.id, scope, userId)
        : null;
      if (!event) {
        refuse(res, 404, "EVENT_NOT_FOUND", NOT_FOUND);
        return;
      }

      const rows = await listStatusHistory(sql, event.id);
      res.status(200).json({
        eventId: event.id,
        status: event.status,
        items: rows.map(toHistoryEntry),
        nextCursor: null,
      });
    }
  );

  return router;
}
