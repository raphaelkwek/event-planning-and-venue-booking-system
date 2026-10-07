import type { Sql } from "postgres";
import type { EventStatus } from "@connectsphere/contracts";

/**
 * Inserts an event directly at any status, for tests that need a starting
 * point no user action can reach yet (Confirmed needs F5). Test-only: in src,
 * every status other than Draft is reached through a transition.
 *
 * Seeded data lives in a shared database. A test that seeds a CONFIRMED event
 * whose end has passed could be completed by a teammate's completion sweep
 * mid-test, so prefer end times in the future unless the test is about
 * completion.
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
      'TST-' || gen_random_uuid(),
      ${options.ownerId}, ${options.name ?? "Seeded event"}, 'Seeded for a test',
      'Seeded for a test', ${startsAt}, ${options.endsAt}, 150, false, false,
      ${options.status}, now(), now(), ${options.ownerId}, ${options.ownerId}
    )
    returning id
  `;
  return rows[0]!.id;
}

/**
 * Removes everything attached to these owners' events, children first, then the
 * events. Test-only: deletes are allowed in test tooling (as
 * tests/fixtures/reset-test-data.sql already does), never in src.
 */
export async function deleteSeededEvents(sql: Sql, ownerIds: string[]): Promise<void> {
  const ids = sql`select id from event.events where owner_id in ${sql(ownerIds)}`;
  await sql`delete from event.outbox where message_key in (select id::text from (${ids}) e)`;
  await sql`delete from event.event_history where event_id in (${ids})`;
  await sql`delete from event.assignments where event_id in (${ids})`;
  await sql`delete from event.clarifications where event_id in (${ids})`;
  await sql`delete from event.reassignment_proposals where event_id in (${ids})`;
  await sql`delete from event.events where owner_id in ${sql(ownerIds)}`;
}
