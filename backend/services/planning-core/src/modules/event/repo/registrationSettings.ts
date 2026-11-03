import type { TransactionSql } from "postgres";
import type { EventStatus } from "@connectsphere/contracts";
import type { RegistrationSettings } from "../domain/registrationSettings.js";

/**
 * R2, R4 — reading an event's registration settings under its row lock, and
 * writing them. SQL against the event schema only.
 */

export interface LockedRegistrationSettings {
  settings: RegistrationSettings;
  status: EventStatus;
  ownerId: string;
  version: number;
  proposedStartAt: string | null;
}

const iso = (value: Date | null) => value?.toISOString() ?? null;

/**
 * Locks the event row for the rest of the transaction, so a second save waits
 * and then sees the first one's version (as G1's edit does). Null when there is
 * no such event.
 */
export async function lockRegistrationSettings(tx: TransactionSql, eventId: string): Promise<LockedRegistrationSettings | null> {
  const [row] = await tx<
    {
      registration_required: boolean | null;
      registration_opens_at: Date | null;
      registration_closes_at: Date | null;
      withdrawal_deadline_at: Date | null;
      status: EventStatus;
      owner_id: string;
      version: number;
      proposed_start_at: Date | null;
    }[]
  >`
    select registration_required, registration_opens_at, registration_closes_at, withdrawal_deadline_at,
           status, owner_id, version, proposed_start_at
    from event.events
    where id = ${eventId}
    for update
  `;
  if (!row) return null;
  return {
    settings: {
      registrationRequired: row.registration_required === true,
      registrationOpensAt: iso(row.registration_opens_at),
      registrationClosesAt: iso(row.registration_closes_at),
      withdrawalDeadlineAt: iso(row.withdrawal_deadline_at),
    },
    status: row.status,
    ownerId: row.owner_id,
    version: row.version,
    proposedStartAt: iso(row.proposed_start_at),
  };
}

/** Writes all four settings. The version trigger raises the version (migration event/0009). */
export async function saveRegistrationSettings(
  tx: TransactionSql,
  eventId: string,
  settings: RegistrationSettings,
  actorUserId: string,
): Promise<void> {
  await tx`
    update event.events set
      registration_required = ${settings.registrationRequired},
      registration_opens_at = ${settings.registrationOpensAt},
      registration_closes_at = ${settings.registrationClosesAt},
      withdrawal_deadline_at = ${settings.withdrawalDeadlineAt},
      updated_at = now(),
      updated_by = ${actorUserId}
    where id = ${eventId}
  `;
}
