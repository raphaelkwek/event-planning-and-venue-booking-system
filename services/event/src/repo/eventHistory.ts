import type { TransactionSql } from "postgres";
import type { EventStatus } from "@connectsphere/contracts";

/**
 * An event's history: every status change (F1) and every field-level
 * amendment (D3), in one append-only record. There is no update or delete
 * here, and none may be added — history cannot be edited (F2).
 */

export interface StatusChange {
  previousStatus: EventStatus | null;
  newStatus: EventStatus;
  actorUserId: string | null;
  actorRole: string;
  triggeringAction: string;
}

export interface FieldChange {
  fieldName: string;
  previousValue: string | null;
  newValue: string | null;
}

export async function recordStatusChange(
  tx: TransactionSql,
  eventId: string,
  change: StatusChange
): Promise<void> {
  await tx`
    insert into event.event_history (
      event_id, entry_type, previous_status, new_status, actor_user_id, actor_role,
      triggering_action, created_by, updated_by
    ) values (
      ${eventId}, 'STATUS_CHANGE', ${change.previousStatus}, ${change.newStatus},
      ${change.actorUserId}, ${change.actorRole}, ${change.triggeringAction},
      ${change.actorUserId}, ${change.actorUserId}
    )
  `;
}

/** D3 — the values as originally submitted, retained alongside the amendments. */
export async function recordFieldChanges(
  tx: TransactionSql,
  eventId: string,
  changes: FieldChange[],
  actor: { userId: string; role: string },
  triggeringAction: string
): Promise<void> {
  if (changes.length === 0) return;

  await tx`
    insert into event.event_history ${tx(
      changes.map((change) => ({
        event_id: eventId,
        entry_type: "FIELD_CHANGE",
        field_name: change.fieldName,
        previous_value: change.previousValue,
        new_value: change.newValue,
        actor_user_id: actor.userId,
        actor_role: actor.role,
        triggering_action: triggeringAction,
        created_by: actor.userId,
        updated_by: actor.userId,
      }))
    )}
  `;
}
