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
});
