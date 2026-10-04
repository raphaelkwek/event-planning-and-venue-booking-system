import type { Sql, TransactionSql } from "postgres";
import type { Role } from "@connectsphere/contracts";
import type { VenueInput } from "../domain/venueRecord.js";

/** SQL for the venue schema only (ADR-0004), one function per query. */

export interface VenueRecord extends VenueInput {
  id: string;
  createdAt: string;
  createdBy: string | null;
  updatedAt: string;
  updatedBy: string | null;
}

export interface VenueListItem {
  id: string;
  name: string;
  building: string;
  maxCapacity: number;
  isActive: boolean;
}

type Db = Sql | TransactionSql;

interface VenueRow {
  id: string;
  name: string;
  building: string;
  max_capacity: number;
  layouts: VenueInput["layouts"];
  facilities: string[];
  accessibility_features: string[];
  operating_hours: VenueInput["operatingHours"];
  status: "ACTIVE" | "INACTIVE";
  created_at: Date;
  created_by: string | null;
  updated_at: Date;
  updated_by: string | null;
}

function toRecord(row: VenueRow): VenueRecord {
  return {
    id: row.id,
    name: row.name,
    building: row.building,
    maxCapacity: row.max_capacity,
    layouts: row.layouts,
    facilities: row.facilities,
    accessibilityFeatures: row.accessibility_features,
    operatingHours: row.operating_hours,
    isActive: row.status === "ACTIVE",
    createdAt: row.created_at.toISOString(),
    createdBy: row.created_by,
    updatedAt: row.updated_at.toISOString(),
    updatedBy: row.updated_by,
  };
}

const status = (venue: VenueInput) => (venue.isActive ? "ACTIVE" : "INACTIVE");

export async function insertVenue(tx: TransactionSql, venue: VenueInput, actorId: string): Promise<VenueRecord> {
  const [row] = await tx<VenueRow[]>`
    insert into venue.venues
      (name, building, max_capacity, layouts, facilities, accessibility_features, operating_hours, status, created_by, updated_by)
    values
      (${venue.name}, ${venue.building}, ${venue.maxCapacity}, ${tx.json(venue.layouts as never)}, ${venue.facilities},
       ${venue.accessibilityFeatures}, ${tx.json(venue.operatingHours as never)}, ${status(venue)}, ${actorId}, ${actorId})
    returning *
  `;
  return toRecord(row!);
}

export async function addVenueStaff(tx: TransactionSql, venueId: string, userId: string, actorId: string) {
  await tx`
    insert into venue.venue_staff (venue_id, user_id, created_by, updated_by)
    values (${venueId}, ${userId}, ${actorId}, ${actorId})
    on conflict (venue_id, user_id) do nothing
  `;
}

export async function findVenue(db: Db, id: string): Promise<VenueRecord | null> {
  const [row] = await db<VenueRow[]>`select * from venue.venues where id = ${id}`;
  return row ? toRecord(row) : null;
}

/** Reads the venue under a row lock, so two updates at once apply one after the other. */
export async function lockVenue(tx: TransactionSql, id: string): Promise<VenueRecord | null> {
  const [row] = await tx<VenueRow[]>`select * from venue.venues where id = ${id} for update`;
  return row ? toRecord(row) : null;
}

export async function updateVenue(tx: TransactionSql, id: string, venue: VenueInput, actorId: string): Promise<VenueRecord> {
  const [row] = await tx<VenueRow[]>`
    update venue.venues set
      name = ${venue.name},
      building = ${venue.building},
      max_capacity = ${venue.maxCapacity},
      layouts = ${tx.json(venue.layouts as never)},
      facilities = ${venue.facilities},
      accessibility_features = ${venue.accessibilityFeatures},
      operating_hours = ${tx.json(venue.operatingHours as never)},
      status = ${status(venue)},
      updated_at = now(),
      updated_by = ${actorId}
    where id = ${id}
    returning *
  `;
  return toRecord(row!);
}

export async function recordVenueHistory(
  tx: TransactionSql,
  venueId: string,
  action: "CREATED" | "UPDATED",
  changes: Record<string, { previous: unknown; new: unknown }>,
  actor: { userId: string; role: Role },
) {
  await tx`
    insert into venue.venue_history (venue_id, action, changes, actor_user_id, actor_role, created_by, updated_by)
    values (${venueId}, ${action}, ${tx.json(changes as never)}, ${actor.userId}, ${actor.role}, ${actor.userId}, ${actor.userId})
  `;
}

export async function listVenues(db: Db): Promise<VenueListItem[]> {
  const rows = await db<Pick<VenueRow, "id" | "name" | "building" | "max_capacity" | "status">[]>`
    select id, name, building, max_capacity, status from venue.venues order by lower(name), id
  `;
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    building: row.building,
    maxCapacity: row.max_capacity,
    isActive: row.status === "ACTIVE",
  }));
}
