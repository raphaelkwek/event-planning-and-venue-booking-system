import type { TransactionSql } from "postgres";
import type { EventStatus } from "@connectsphere/contracts";

/**
 * R1 to R4 — the event's published fields and registration settings, read in
 * the transaction that changed them, for its `event.listing-changed` message.
 * SQL against the event schema only.
 */

export interface EventListing {
  eventId: string;
  eventReference: string | null;
  eventName: string;
  ownerId: string;
  /** R5, R7: the active assignment's coordinator, or null. */
  assignedCoordinatorId: string | null;
  description: string | null;
  status: EventStatus;
  proposedStartAt: string | null;
  proposedEndAt: string | null;
  registrationRequired: boolean;
  registrationOpensAt: string | null;
  registrationClosesAt: string | null;
  withdrawalDeadlineAt: string | null;
  /** EN-19: attendees queue in the waiting room and register with an admission token. */
  highDemand: boolean;
}

const iso = (value: Date | null) => value?.toISOString() ?? null;

export async function readListing(tx: TransactionSql, eventId: string): Promise<EventListing | null> {
  const [row] = await tx<{
    id: string;
    reference: string | null;
    name: string;
    owner_id: string;
    assigned_coordinator_id: string | null;
    description: string | null;
    status: EventStatus;
    proposed_start_at: Date | null;
    proposed_end_at: Date | null;
    registration_required: boolean | null;
    registration_opens_at: Date | null;
    registration_closes_at: Date | null;
    withdrawal_deadline_at: Date | null;
    high_demand: boolean;
  }[]>`
    select e.id, e.reference, e.name, e.owner_id, a.coordinator_id as assigned_coordinator_id, e.description, e.status,
           e.proposed_start_at, e.proposed_end_at, e.registration_required, e.registration_opens_at,
           e.registration_closes_at, e.withdrawal_deadline_at, e.high_demand
    from event.events e
    left join event.assignments a on a.event_id = e.id and a.is_active
    where e.id = ${eventId}
  `;
  if (!row) return null;
  return {
    eventId: row.id,
    eventReference: row.reference,
    eventName: row.name,
    ownerId: row.owner_id,
    assignedCoordinatorId: row.assigned_coordinator_id,
    description: row.description,
    status: row.status,
    proposedStartAt: iso(row.proposed_start_at),
    proposedEndAt: iso(row.proposed_end_at),
    // A draft may not have said yet; it has no reference, so it is never published.
    registrationRequired: row.registration_required === true,
    registrationOpensAt: iso(row.registration_opens_at),
    registrationClosesAt: iso(row.registration_closes_at),
    withdrawalDeadlineAt: iso(row.withdrawal_deadline_at),
    highDemand: row.high_demand,
  };
}
