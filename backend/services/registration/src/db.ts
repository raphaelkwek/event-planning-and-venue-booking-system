import postgres from "postgres";
import { config } from "./config.js";

/** `prepare: false`: DATABASE_URL is Supabase's transaction pooler, which cannot keep prepared statements. */
export const sql = postgres(config.databaseUrl, { max: 5, idle_timeout: 20, connect_timeout: 5, prepare: false });
