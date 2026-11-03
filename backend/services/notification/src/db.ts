import postgres from "postgres";
import { instrumentSql } from "@connectsphere/telemetry";
import { config } from "./config.js";

/**
 * `prepare: false`: DATABASE_URL is Supabase's transaction pooler, which cannot keep prepared statements.
 * `instrumentSql` (EN-08) gives each query made inside a request or a consumed message a span.
 */
export const sql = instrumentSql(postgres(config.databaseUrl, { max: 5, idle_timeout: 20, connect_timeout: 5, prepare: false }));
