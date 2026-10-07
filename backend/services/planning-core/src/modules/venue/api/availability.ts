import { Router, type Response } from "express";
import type { Sql } from "postgres";
import { findEventReferences } from "../../event/index.js";
import { authenticate, requireRole, type ActorRequest } from "../auth/actor.js";
import { assembleCalendar, CALENDAR_TIME_ZONE, calendarDays, readCalendarRange } from "../domain/availabilityCalendar.js";
import { readAvailability } from "../repo/availability.js";
import { findVenue } from "../repo/venues.js";
import { refuse } from "./errors.js";

/**
 * I1 — a venue's availability calendar: each day's committed and free periods
 * over a range of up to 31 days. Every internal role reads it; attendees are
 * refused (AC8). It is read afresh on every request, so an approval, rejection,
 * withdrawal or release shows the next time it is loaded (AC7).
 */
const READERS = ["EVENT_ORGANISER", "EVENT_COORDINATOR", "VENUE_STAFF", "TECH_SUPPORT_STAFF"] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function availabilityRouter(sql: Sql) {
  const router = Router();

  router.get(
    "/api/v1/venues/:id/availability",
    authenticate,
    requireRole(...READERS),
    async (req: ActorRequest, res: Response) => {
      const venue = UUID.test(req.params.id!) ? await findVenue(sql, req.params.id!) : null;
      if (!venue) return refuse(res, 404, "VENUE_NOT_FOUND", "No venue with that id exists.");

      const range = readCalendarRange(req.query.from, req.query.to);
      if (!range.ok) {
        return refuse(res, 400, "VALIDATION_FAILED", "The calendar could not be shown. Check the dates.", range.fields);
      }

      const rows = await readAvailability(sql, venue.id, calendarDays(range.range.dates, venue.operatingHours));
      const eventIds = [...new Set(rows.flatMap((row) => (row.eventId ? [row.eventId] : [])))];
      const references = await findEventReferences(sql, eventIds);

      res.json({
        venueId: venue.id,
        timeZone: CALENDAR_TIME_ZONE,
        from: range.range.from,
        to: range.range.to,
        days: assembleCalendar(range.range.dates, rows, references),
      });
    },
  );

  return router;
}
