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
 *
 * A Cancelled event gets a reason, its owner as the canceller and the time, as
 * the check from event/0012 requires (F3).
 */
export async function seedEvent(
  sql: Sql,
  options: { ownerId: string; status: EventStatus; endsAt: Date; name?: string }
): Promise<string> {
  const startsAt = new Date(options.endsAt.getTime() - 4 * 60 * 60 * 1000);
  const cancelled = options.status === "CANCELLED";
  const rows = await sql<{ id: string }[]>`
    insert into event.events (
      reference, owner_id, name, purpose, description, proposed_start_at, proposed_end_at,
      expected_attendance, equipment_required, registration_required, status, submitted_at,
      last_saved_at, created_by, updated_by, cancellation_reason, cancelled_by, cancelled_at
    ) values (
      'TST-' || gen_random_uuid(),
      ${options.ownerId}, ${options.name ?? "Seeded event"}, 'Seeded for a test',
      'Seeded for a test', ${startsAt}, ${options.endsAt}, 150, false, false,
      ${options.status}, now(), now(), ${options.ownerId}, ${options.ownerId},
      ${cancelled ? "Seeded for a test" : null}, ${cancelled ? options.ownerId : null}, ${cancelled ? new Date() : null}
    )
    returning id
  `;
  return rows[0]!.id;
}

/**
 * Moves a seeded event straight to `status`, for a test that needs a status no story reaches from
 * where the event is. A Cancelled event gets the columns the event/0012 check requires (F3).
 */
export async function setStatusDirect(sql: Sql, eventId: string, status: EventStatus): Promise<void> {
  const cancelled = status === "CANCELLED";
  await sql`
    update event.events
    set status = ${status},
        cancellation_reason = ${cancelled ? "Seeded for a test" : null},
        cancelled_by = ${cancelled ? sql`owner_id` : null},
        cancelled_at = ${cancelled ? sql`now()` : null}
    where id = ${eventId}
  `;
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
