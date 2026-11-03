import postgres from "postgres";
import { config } from "./config.js";

/**
 * `prepare: false` is required because DATABASE_URL points at Supabase's
 * transaction-mode pooler, which hands a different backend to each
 * transaction and so cannot keep a named prepared statement alive.
 */
export const sql = postgres(config.databaseUrl, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 5,
  prepare: false,
  // A statement that runs past DB_STATEMENT_TIMEOUT_MS is cancelled by Postgres (§4.7), so a stuck query frees its connection.
  connection: config.dbStatementTimeoutMs > 0 ? { statement_timeout: config.dbStatementTimeoutMs } : {},
});
