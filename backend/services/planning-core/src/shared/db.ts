import postgres from "postgres";
import { instrumentSql } from "@connectsphere/telemetry";
import { config } from "./config.js";

/**
 * `prepare: false` is required because DATABASE_URL points at Supabase's
 * transaction-mode pooler, which hands a different backend to each
 * transaction and so cannot keep a named prepared statement alive.
 *
 * `instrumentSql` (EN-08) adds a span to each query and transaction made inside a
 * request or a consumed message; the OpenTelemetry pg instrumentation does not
 * cover this driver.
 */
export const sql = instrumentSql(
  postgres(config.databaseUrl, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 5,
    prepare: false,
  }),
);
