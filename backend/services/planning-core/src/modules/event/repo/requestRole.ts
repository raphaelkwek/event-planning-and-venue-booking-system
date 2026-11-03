import type { Sql, TransactionSql } from "postgres";
import type { AccessScope } from "@connectsphere/contracts";

/**
 * EN-07.2 (ADR-0010): A3 and A4 are enforced twice. The repo's query filters by
 * the caller's scope (scopeCondition in events.ts), and row-level security
 * enforces the same rule in Postgres (migration event/0025), so a query that
 * forgets its WHERE clause still returns only the caller's rows.
 *
 * RLS applies to `connectsphere_request`, never to the service's login role,
 * which owns the tables and bypasses it (so migrations, the outbox relay, the
 * Temporal worker and the jobs are unaffected). `asCaller` runs one read as that
 * role, with the caller's claims:
 *
 * - `SET LOCAL ROLE connectsphere_request`;
 * - `app.user_id` and `app.access_scope`, set with `set_config(…, true)`, which
 *   is `SET LOCAL`.
 *
 * Everything is transaction-local, which is what Supabase's transaction-mode
 * pooler needs: the next transaction on the same server connection may belong
 * to someone else, and a session-level SET would leak into it. Given the root
 * pool it opens a transaction for the read; given a transaction it switches
 * role for the read and back afterwards, so the caller's writes in the same
 * transaction still run as the service role.
 *
 * The claim is the scope rule identity resolved (or the one a module chose on
 * purpose, such as ALL for Venue Staff reading the event behind their booking),
 * because that is what scopeCondition applies; the RLS policy mirrors it exactly.
 */
export const REQUEST_ROLE = "connectsphere_request";

async function enter(tx: TransactionSql, scope: AccessScope, callerId: string): Promise<void> {
  await tx`set local role connectsphere_request`;
  await tx`select set_config('app.user_id', ${callerId}, true), set_config('app.access_scope', ${scope.scopeType}, true)`;
}

function isTransaction(sql: Sql | TransactionSql): sql is TransactionSql {
  return typeof (sql as Partial<TransactionSql>).savepoint === "function";
}

export async function asCaller<T>(
  sql: Sql | TransactionSql,
  scope: AccessScope,
  callerId: string,
  read: (tx: TransactionSql) => Promise<T>
): Promise<T> {
  if (!isTransaction(sql)) {
    return (await sql.begin(async (tx) => {
      await enter(tx, scope, callerId);
      return read(tx);
    })) as T;
  }
  await enter(sql, scope, callerId);
  let result: T;
  try {
    result = await read(sql);
  } catch (error) {
    // After a failed statement the transaction is aborted and the reset fails too; the
    // rollback that follows resets the role. Either way the read's own error is the one thrown.
    await sql`set local role none`.catch(() => undefined);
    throw error;
  }
  await sql`set local role none`;
  return result;
}
