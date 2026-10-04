import { Router, type Response } from "express";
import type { Sql } from "postgres";
import { authenticate, requireRole, type ActorRequest } from "../auth/actor.js";
import { changedFields, validateVenue, type VenueInput } from "../domain/venueRecord.js";
import {
  addVenueStaff,
  findVenue,
  insertVenue,
  listVenues,
  lockVenue,
  recordVenueHistory,
  updateVenue,
} from "../repo/venues.js";
import { venueBodySchema } from "./schemas.js";
import { fieldsFromZod, refuse } from "./errors.js";

/**
 * H1 — maintain venue records; H2 reads them.
 *
 * Only Venue Staff create or update (A2, H1 AC4); every internal role reads
 * and attendees cannot reach the catalogue (H2). A create or update is one
 * transaction with its history entry, so a refusal stores nothing (H1 AC7)
 * and a success always records who, when and what changed (H1 AC5).
 */
const READERS = ["EVENT_ORGANISER", "EVENT_COORDINATOR", "VENUE_STAFF", "TECH_SUPPORT_STAFF"] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function notFound(res: Response) {
  refuse(res, 404, "VENUE_NOT_FOUND", "No venue with that id exists.");
}

/** The body checked for shape, then against H1's rules; null once a refusal has been sent. */
/** What a field left out of the body falls back to: the stored value on an update, a default on create. */
type Defaults = Pick<VenueInput, "isActive" | "setupMinutes" | "turnaroundMinutes">;
const NEW_VENUE: Defaults = { isActive: true, setupMinutes: 0, turnaroundMinutes: 0 };

function readVenue(req: ActorRequest, res: Response, defaults: Defaults): VenueInput | null {
  const shape = venueBodySchema.safeParse(req.body);
  if (!shape.success) {
    refuse(res, 400, "VALIDATION_FAILED", "The venue could not be saved. Check the highlighted fields.", fieldsFromZod(shape.error));
    return null;
  }
  const result = validateVenue({
    ...shape.data,
    isActive: shape.data.isActive ?? defaults.isActive,
    setupMinutes: shape.data.setupMinutes ?? defaults.setupMinutes,
    turnaroundMinutes: shape.data.turnaroundMinutes ?? defaults.turnaroundMinutes,
  } as VenueInput);
  if (!result.ok) {
    refuse(res, 400, "VALIDATION_FAILED", "The venue could not be saved. Check the highlighted fields.", result.fields);
    return null;
  }
  return result.venue;
}

export function venuesRouter(sql: Sql) {
  const router = Router();

  router.get("/api/v1/venues", authenticate, requireRole(...READERS), async (_req: ActorRequest, res: Response) => {
    res.json({ items: await listVenues(sql) });
  });

  router.get("/api/v1/venues/:id", authenticate, requireRole(...READERS), async (req: ActorRequest, res: Response) => {
    const venue = UUID.test(req.params.id!) ? await findVenue(sql, req.params.id!) : null;
    if (!venue) return notFound(res);
    res.json(venue);
  });

  router.post("/api/v1/venues", authenticate, requireRole("VENUE_STAFF"), async (req: ActorRequest, res: Response) => {
    const venue = readVenue(req, res, NEW_VENUE);
    if (!venue) return;
    const actor = req.actor!;

    const created = await sql.begin(async (tx) => {
      const record = await insertVenue(tx, venue, actor.userId);
      await addVenueStaff(tx, record.id, actor.userId, actor.userId);
      const initial = Object.fromEntries(
        Object.entries(changedFields({} as VenueInput, venue)).map(([field, change]) => [field, { previous: null, new: change.new }]),
      );
      await recordVenueHistory(tx, record.id, "CREATED", initial, actor);
      return record;
    });
    res.status(201).json(created);
  });

  router.put("/api/v1/venues/:id", authenticate, requireRole("VENUE_STAFF"), async (req: ActorRequest, res: Response) => {
    if (!UUID.test(req.params.id!)) return notFound(res);
    const current = await findVenue(sql, req.params.id!);
    if (!current) return notFound(res);
    const venue = readVenue(req, res, current);
    if (!venue) return;
    const actor = req.actor!;

    const updated = await sql.begin(async (tx) => {
      const locked = await lockVenue(tx, req.params.id!);
      if (!locked) return null;
      const changes = changedFields(locked, venue);
      if (Object.keys(changes).length === 0) return locked;
      const record = await updateVenue(tx, locked.id, venue, actor.userId);
      await recordVenueHistory(tx, locked.id, "UPDATED", changes, actor);
      return record;
    });
    if (!updated) return notFound(res);
    res.json(updated);
  });

  return router;
}
