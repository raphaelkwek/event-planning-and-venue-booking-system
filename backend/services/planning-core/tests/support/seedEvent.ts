import type { Sql } from "postgres";
import type { EventStatus } from "@connectsphere/contracts";

/**
 * Inserts an event directly at any status, for tests that need a starting
 * point no user action can reach yet (Confirmed needs F5). Test-only: in src,
 * every status other than Draft is reached through a transition.
 */
export async function seedEvent(
  sql: Sql,
  options: { ownerId: string; status: EventStatus; endsAt: Date; name?: string }
): Promise<string> {
  const startsAt = new Date(options.endsAt.getTime() - 4 * 60 * 60 * 1000);
  const rows = await sql<{ id: string }[]>`
    insert into event.events (
      reference, owner_id, name, purpose, description, proposed_start_at, proposed_end_at,
      expected_attendance, equipment_required, registration_required, status, submitted_at,
      last_saved_at, created_by, updated_by
    ) values (
      'EVT-' || lpad(nextval('event.event_reference_seq')::text, 6, '0'),
      ${options.ownerId}, ${options.name ?? "Seeded event"}, 'Seeded for a test',
      'Seeded for a test', ${startsAt}, ${options.endsAt}, 150, false, false,
      ${options.status}, now(), now(), ${options.ownerId}, ${options.ownerId}
    )
    returning id
  `;
  return rows[0]!.id;
}
