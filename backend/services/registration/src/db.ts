import postgres from "postgres";
import { instrumentSql } from "@connectsphere/telemetry";
import { config } from "./config.js";

/**
 * `prepare: false`: DATABASE_URL is Supabase's transaction pooler, which cannot keep prepared statements.
 * `instrumentSql` (EN-08) gives each query made inside a request or a consumed message a span.
 */
export const sql = instrumentSql(
  postgres(config.databaseUrl, {
    max: config.dbPoolMax,
    idle_timeout: 20,
    connect_timeout: 5,
    prepare: false,
    // A statement that runs past DB_STATEMENT_TIMEOUT_MS is cancelled by Postgres (§4.7).
    connection: config.dbStatementTimeoutMs > 0 ? { statement_timeout: config.dbStatementTimeoutMs } : {},
  }),
);
