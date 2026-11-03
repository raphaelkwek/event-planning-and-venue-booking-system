import type { Sql, TransactionSql } from "postgres";

/**
 * EN-03 — helpers for the event stream's tests. Test-only: they read the stream
 * directly, and some switch its triggers off to do what the app never may
 * (edit or remove an entry, or write history as it was written before EN-03),
 * always inside a transaction that is rolled back, or on rows the test owns.
 */

export interface StreamRow {
  id: string;
  version: number;
  type: string;
  previousStatus: string | null;
  newStatus: string | null;
  fieldName: string | null;
  previousValue: string | null;
  newValue: string | null;
  triggeringAction: string;
  actorUserId: string | null;
  actorRole: string;
  occurredAt: Date;
  prevHash: string;
  hash: string;
  /** event.stream_entry_canonical over this row's columns: the text its hash covers. */
  canonical: string;
}

/** An event's stream entries, in version order. */
export async function streamOf(sql: Sql | TransactionSql, eventId: string): Promise<StreamRow[]> {
  const rows = await sql<
    {
      id: string;
      version: number;
      type: string;
      previous_status: string | null;
      new_status: string | null;
      field_name: string | null;
      previous_value: string | null;
      new_value: string | null;
      triggering_action: string;
      actor_user_id: string | null;
      actor_role: string;
      occurred_at: Date;
      prev_hash: string;
      hash: string;
      canonical: string;
    }[]
  >`
    select id, version, type,
      data ->> 'previousStatus' as previous_status, data ->> 'newStatus' as new_status,
      data ->> 'fieldName' as field_name, data ->> 'previousValue' as previous_value,
      data ->> 'newValue' as new_value, data ->> 'triggeringAction' as triggering_action,
      actor_user_id, actor_role, occurred_at, prev_hash, hash,
      event.stream_entry_canonical(id, aggregate_id, version, type, data, actor_user_id, actor_role, occurred_at) as canonical
    from event.event_stream
    where aggregate_id = ${eventId}
    order by version
  `;
  return rows.map((row) => ({
    id: row.id,
    version: row.version,
    type: row.type,
    previousStatus: row.previous_status,
    newStatus: row.new_status,
    fieldName: row.field_name,
    previousValue: row.previous_value,
    newValue: row.new_value,
    triggeringAction: row.triggering_action,
    actorUserId: row.actor_user_id,
    actorRole: row.actor_role,
    occurredAt: row.occurred_at,
    prevHash: row.prev_hash,
    hash: row.hash,
    canonical: row.canonical,
  }));
}

/** An event's history projection rows, in the same shape, keyed by id. */
export async function historyOf(sql: Sql, eventId: string) {
  return sql<
    {
      id: string;
      entry_type: string;
      previous_status: string | null;
      new_status: string | null;
      field_name: string | null;
      previous_value: string | null;
      new_value: string | null;
      triggering_action: string;
      actor_user_id: string | null;
      actor_role: string;
      occurred_at: Date;
    }[]
  >`
    select id, entry_type, previous_status, new_status, field_name, previous_value, new_value,
      triggering_action, actor_user_id, actor_role, occurred_at
    from event.event_history where event_id = ${eventId}
    order by occurred_at, created_at, id
  `;
}

class RolledBack {
  constructor(readonly value: unknown) {}
}

/**
 * Runs `work` in a transaction and always rolls it back, returning what `work`
 * returned. An error `work` throws is rethrown, also after a rollback.
 */
export async function inRolledBackTransaction<T>(sql: Sql, work: (tx: TransactionSql) => Promise<T>): Promise<T> {
  try {
    await sql.begin(async (tx) => {
      throw new RolledBack(await work(tx));
    });
  } catch (error) {
    if (error instanceof RolledBack) return error.value as T;
    throw error;
  }
  throw new Error("inRolledBackTransaction: the transaction committed");
}

/**
 * Skips the triggers for the rest of this transaction (the append-only guard
 * and the history's capture), as someone with a superuser's rights could. CI's
 * database role is a superuser; the app's is not.
 */
export async function withoutTriggers(tx: TransactionSql): Promise<void> {
  await tx`set local session_replication_role = replica`;
}

export interface LegacyHistoryRow {
  eventId: string;
  entryType: "STATUS_CHANGE" | "FIELD_CHANGE";
  previousStatus?: string | null;
  newStatus?: string | null;
  fieldName?: string | null;
  previousValue?: string | null;
  newValue?: string | null;
  actorUserId?: string | null;
  actorRole: string;
  triggeringAction: string;
  occurredAt: string;
  createdAt?: string;
}

/**
 * Writes history rows the way they were written before EN-03: to
 * event.event_history only, with nothing in the stream. Committed, so the
 * backfill can find them. Returns the rows' ids in the order given.
 */
export async function writeHistoryBeforeTheStream(sql: Sql, rows: LegacyHistoryRow[]): Promise<string[]> {
  return sql.begin(async (tx) => {
    await withoutTriggers(tx);
    const ids: string[] = [];
    for (const row of rows) {
      const [inserted] = await tx<{ id: string }[]>`
        insert into event.event_history (
          event_id, entry_type, previous_status, new_status, field_name, previous_value, new_value,
          actor_user_id, actor_role, triggering_action, occurred_at, created_at
        ) values (
          ${row.eventId}, ${row.entryType}, ${row.previousStatus ?? null}, ${row.newStatus ?? null},
          ${row.fieldName ?? null}, ${row.previousValue ?? null}, ${row.newValue ?? null},
          ${row.actorUserId ?? null}, ${row.actorRole}, ${row.triggeringAction}, ${row.occurredAt},
          ${row.createdAt ?? new Date().toISOString()}
        )
        returning id
      `;
      ids.push(inserted!.id);
    }
    return ids;
  }) as Promise<string[]>;
}

/** Runs the backfill and returns how many history rows it copied into the stream. */
export async function backfill(sql: Sql): Promise<number> {
  const [row] = await sql<{ copied: number }[]>`select event.backfill_event_stream() as copied`;
  return row!.copied;
}
