import type { Sql, TransactionSql } from "postgres";
import {
  summariseChains,
  type ProjectionMismatch,
  type StoreVerification,
  type StoredLink,
} from "../domain/eventStream.js";

/**
 * EN-03 — the tamper check behind `npm run event-store:verify`.
 *
 * 1. Every chain: the database recomputes each entry's hash from its columns
 *    (event.stream_entry_hash over event.stream_entry_canonical, the same
 *    functions the append used), and summariseChains walks the entries in
 *    (event, version) order, stopping at the first broken link.
 * 2. The history projection: the first event_history row that has no stream
 *    entry, or says something its entry does not.
 *
 * Read only. `aggregateId` limits both to one event, for tests.
 */
export async function verifyEventStore(
  sql: Sql | TransactionSql,
  options: { aggregateId?: string } = {}
): Promise<StoreVerification> {
  const onlyStream = options.aggregateId ? sql`where s.aggregate_id = ${options.aggregateId}` : sql``;
  const rows = await sql<
    { aggregate_id: string; version: number; prev_hash: string; hash: string; recomputed_hash: string }[]
  >`
    select s.aggregate_id, s.version, s.prev_hash, s.hash,
      event.stream_entry_hash(
        s.prev_hash,
        event.stream_entry_canonical(
          s.id, s.aggregate_id, s.version, s.type, s.data, s.actor_user_id, s.actor_role, s.occurred_at
        )
      ) as recomputed_hash
    from event.event_stream s
    ${onlyStream}
    order by s.aggregate_id, s.version
  `;
  const links: StoredLink[] = rows.map((row) => ({
    aggregateId: row.aggregate_id,
    version: row.version,
    prevHash: row.prev_hash,
    hash: row.hash,
    recomputedHash: row.recomputed_hash,
  }));

  return { ...summariseChains(links), projectionMismatch: await firstProjectionMismatch(sql, options.aggregateId) };
}

async function firstProjectionMismatch(
  sql: Sql | TransactionSql,
  aggregateId: string | undefined
): Promise<ProjectionMismatch | null> {
  const onlyHistory = aggregateId ? sql`and h.event_id = ${aggregateId}` : sql``;
  const [row] = await sql<{ history_id: string; event_id: string; has_entry: boolean }[]>`
    select h.id as history_id, h.event_id, s.id is not null as has_entry
    from event.event_history h
    left join event.event_stream s on s.id = h.id
    where (
      s.id is null
      or s.aggregate_id <> h.event_id
      or s.type <> h.entry_type
      or s.data <> event.history_entry_data(
        h.entry_type, h.previous_status, h.new_status, h.field_name,
        h.previous_value, h.new_value, h.triggering_action
      )
      or s.actor_user_id is distinct from h.actor_user_id
      or s.actor_role <> h.actor_role
      or s.occurred_at <> h.occurred_at
    )
    ${onlyHistory}
    order by h.event_id, h.occurred_at, h.id
    limit 1
  `;
  return row ? { historyId: row.history_id, eventId: row.event_id, hasEntry: row.has_entry } : null;
}
