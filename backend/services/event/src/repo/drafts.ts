import type { Sql } from "postgres";
import { toEvent, type EventRow, type RawEvent } from "./events.js";

/**
 * C1, C2, C3 — drafts.
 *
 * A draft is an event at status Draft, in the same table as every other event,
 * so submitting one keeps its id and its history rather than copying it to a
 * new record. These queries are the draft-only view of that table: each is
 * scoped to its owner, because a draft is visible to nobody else (C1).
 */

export interface DraftFields {
  name: string;
  purpose: string | null;
  description: string | null;
  proposedStartAt: string | null;
  proposedEndAt: string | null;
  expectedAttendance: number | null;
  venueRequirements: unknown | null;
  accessibilityNeeds: string | null;
  equipmentRequired: boolean | null;
  equipmentRequirements: unknown | null;
  registrationRequired: boolean | null;
  registrationOpensAt: string | null;
  registrationClosesAt: string | null;
}

function jsonOrNull(sql: Sql, value: unknown) {
  return value === null || value === undefined ? null : sql.json(value as never);
}

export async function insertDraft(sql: Sql, ownerId: string, fields: DraftFields): Promise<EventRow> {
  const rows = await sql<RawEvent[]>`
    insert into event.events (
      owner_id, name, purpose, description, proposed_start_at, proposed_end_at,
      expected_attendance, venue_requirements, accessibility_needs, equipment_required,
      equipment_requirements, registration_required, registration_opens_at,
      registration_closes_at, status, last_saved_at, created_by, updated_by
    ) values (
      ${ownerId}, ${fields.name}, ${fields.purpose}, ${fields.description},
      ${fields.proposedStartAt}, ${fields.proposedEndAt}, ${fields.expectedAttendance},
      ${jsonOrNull(sql, fields.venueRequirements)}, ${fields.accessibilityNeeds},
      ${fields.equipmentRequired}, ${jsonOrNull(sql, fields.equipmentRequirements)},
      ${fields.registrationRequired}, ${fields.registrationOpensAt},
      ${fields.registrationClosesAt}, 'DRAFT', now(), ${ownerId}, ${ownerId}
    )
    returning *, null::uuid as assigned_coordinator_id
  `;
  return toEvent(rows[0]!);
}

/**
 * C1/C2 — ownership and the Draft status are part of the query, not a check
 * applied to the result, so a request that is neither yields no row at all.
 */
export async function findDraftForOwner(
  sql: Sql,
  draftId: string,
  ownerId: string
): Promise<EventRow | null> {
  const rows = await sql<RawEvent[]>`
    select *, null::uuid as assigned_coordinator_id
    from event.events
    where id = ${draftId} and owner_id = ${ownerId} and status = 'DRAFT'
  `;
  return rows[0] ? toEvent(rows[0]) : null;
}

export async function updateDraft(
  sql: Sql,
  draftId: string,
  ownerId: string,
  fields: DraftFields
): Promise<EventRow | null> {
  const rows = await sql<RawEvent[]>`
    update event.events set
      name = ${fields.name},
      purpose = ${fields.purpose},
      description = ${fields.description},
      proposed_start_at = ${fields.proposedStartAt},
      proposed_end_at = ${fields.proposedEndAt},
      expected_attendance = ${fields.expectedAttendance},
      venue_requirements = ${jsonOrNull(sql, fields.venueRequirements)},
      accessibility_needs = ${fields.accessibilityNeeds},
      equipment_required = ${fields.equipmentRequired},
      equipment_requirements = ${jsonOrNull(sql, fields.equipmentRequirements)},
      registration_required = ${fields.registrationRequired},
      registration_opens_at = ${fields.registrationOpensAt},
      registration_closes_at = ${fields.registrationClosesAt},
      last_saved_at = now(),
      updated_at = now(),
      updated_by = ${ownerId}
    where id = ${draftId} and owner_id = ${ownerId} and status = 'DRAFT'
    returning *, null::uuid as assigned_coordinator_id
  `;
  return rows[0] ? toEvent(rows[0]) : null;
}

/**
 * The caller's own request whatever its status, so a draft route can tell
 * "already submitted" apart from "no such request" (C2).
 */
export async function findOwnedRequest(
  sql: Sql,
  requestId: string,
  ownerId: string
): Promise<EventRow | null> {
  const rows = await sql<RawEvent[]>`
    select *, null::uuid as assigned_coordinator_id
    from event.events
    where id = ${requestId} and owner_id = ${ownerId}
  `;
  return rows[0] ? toEvent(rows[0]) : null;
}

export async function listDraftsForOwner(sql: Sql, ownerId: string): Promise<EventRow[]> {
  const rows = await sql<RawEvent[]>`
    select *, null::uuid as assigned_coordinator_id
    from event.events
    where owner_id = ${ownerId} and status = 'DRAFT'
    order by last_saved_at desc
  `;
  return rows.map(toEvent);
}
