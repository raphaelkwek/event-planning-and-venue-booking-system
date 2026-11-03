export function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/**
 * Configuration every module shares. A module's own settings live in its
 * module's config.ts, so this file never grows a field only one module reads.
 *
 * PLANNING_CORE_PORT is its own name rather than PORT, because older .env files
 * still set PORT for the Identity service that planning-core replaced (ADR-0004).
 */
export const config = {
  port: Number(process.env.PLANNING_CORE_PORT ?? 8090),
  serviceName: process.env.PLANNING_CORE_SERVICE_NAME ?? "planning-core",
  logLevel: process.env.LOG_LEVEL ?? "info",
  databaseUrl: required("DATABASE_URL"),
  /** implementation.md §4.7: a query that runs longer than this is cancelled (0, the default, sends none: the Supabase pooler may reject a startup parameter, so 5000 is opt-in; see .env.example). Migrations use their own connection. */
  dbStatementTimeoutMs: Number(process.env.DB_STATEMENT_TIMEOUT_MS ?? 0),
  supabaseJwksUrl: required("SUPABASE_JWKS_URL"),
};
