import postgres from "postgres";
import { config } from "./config.js";

/** `prepare: false`: DATABASE_URL is Supabase's transaction pooler, which cannot keep prepared statements. */
export const sql = postgres(config.databaseUrl, {
  max: 5,
  idle_timeout: 20,
  connect_timeout: 5,
  prepare: false,
  // A statement that runs past DB_STATEMENT_TIMEOUT_MS is cancelled by Postgres (§4.7).
  connection: config.dbStatementTimeoutMs > 0 ? { statement_timeout: config.dbStatementTimeoutMs } : {},
});
