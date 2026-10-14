import type { TransactionSql } from "postgres";
import type { EventStatus } from "@connectsphere/contracts";
import type { Details } from "../domain/eventDetails.js";

/**
 * G1 — reading an event's descriptive details under a row lock, and writing
 * them. SQL against the event schema only.
 */

export interface LockedDetails {
  details: Details;
  status: EventStatus;
  ownerId: string;
  assignedCoordinatorId: string | null;
  version: number;
}

/**
 * Locks the event row for the rest of the transaction and reads what an edit
 * is checked against. A second edit of the same event waits here, then sees the
 * first one's version, so it can't overwrite it (G1-T11). Null when there is no
 * such event.
 */
export async function lockEventDetails(tx: TransactionSql, eventId: string): Promise<LockedDetails | null> {
  const rows = await tx<{
    purpose: string | null;
    description: string | null;
    accessibility_needs: string | null;
    contact_details: string | null;
    status: EventStatus;
    owner_id: string;
    version: number;
    assigned_coordinator_id: string | null;
  }[]>`
    select e.purpose, e.description, e.accessibility_needs, e.contact_details, e.status, e.owner_id, e.version,
           (select a.coordinator_id from event.assignments a where a.event_id = e.id and a.is_active) as assigned_coordinator_id
    from event.events e
    where e.id = ${eventId}
    for update of e
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    details: {
      purpose: row.purpose,
      description: row.description,
      accessibilityNeeds: row.accessibility_needs,
      contactDetails: row.contact_details,
    },
    status: row.status,
    ownerId: row.owner_id,
    assignedCoordinatorId: row.assigned_coordinator_id,
    version: row.version,
  };
}

const COLUMNS: Record<keyof Details, string> = {
  purpose: "purpose",
  description: "description",
  accessibilityNeeds: "accessibility_needs",
  contactDetails: "contact_details",
};

/** Writes the changed details. The version trigger raises the version (migration event/0009). */
export async function saveEventDetails(
  tx: TransactionSql,
  eventId: string,
  changes: Partial<Details>,
  actorUserId: string,
): Promise<void> {
  const values = Object.fromEntries(
    (Object.keys(changes) as (keyof Details)[]).map((field) => [COLUMNS[field], changes[field] ?? null]),
  );
  await tx`
    update event.events
    set ${tx(values)}, updated_at = now(), updated_by = ${actorUserId}
    where id = ${eventId}
  `;
}
