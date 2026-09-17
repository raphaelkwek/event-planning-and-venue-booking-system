function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/**
 * EVENT_PORT takes precedence over PORT so that a single shared .env can run
 * every service at once, each on its own port.
 */
export const config = {
  port: Number(process.env.EVENT_PORT ?? process.env.PORT ?? 8082),
  serviceName: process.env.EVENT_SERVICE_NAME ?? "event-service",
  logLevel: process.env.LOG_LEVEL ?? "info",
  databaseUrl: required("DATABASE_URL"),
  databaseSchema: process.env.EVENT_DATABASE_SCHEMA ?? "event",
  supabaseJwksUrl: required("SUPABASE_JWKS_URL"),
  identityBaseUrl: process.env.IDENTITY_BASE_URL ?? "http://127.0.0.1:8081",
  /**
   * TODO(E1): replace with a live Identity query for active users holding
   * EVENT_COORDINATOR. Until that endpoint exists the eligible pool is
   * configuration: a comma-separated list of identity.users.id values.
   */
  coordinatorPool: (process.env.EVENT_COORDINATOR_POOL ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0),
};
