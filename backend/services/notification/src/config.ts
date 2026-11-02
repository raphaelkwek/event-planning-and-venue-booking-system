function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

/**
 * The notification service's settings (implementation.md §10). Kafka's come
 * from the KAFKA_* variables through @connectsphere/kafka.
 */
export const config = {
  port: Number(process.env.NOTIFICATION_PORT ?? 8091),
  serviceName: "notification",
  databaseUrl: required("DATABASE_URL"),
  /** implementation.md §4.7: a query that runs longer than this is cancelled (0, the default, sends none: the Supabase pooler may reject a startup parameter, so 5000 is opt-in; see .env.example). Migrations use their own connection. */
  dbStatementTimeoutMs: Number(process.env.DB_STATEMENT_TIMEOUT_MS ?? 0),
  /** Appended to every consumer group on a laptop, e.g. dev-sk (§3.1); empty when deployed. */
  groupSuffix: process.env.KAFKA_GROUP_SUFFIX?.trim() ?? "",
  /** Where identity answers "who is this token?" (T2): planning-core's GET /api/v1/users/me. */
  planningCoreUrl: process.env.PLANNING_CORE_URL ?? `http://127.0.0.1:${process.env.PLANNING_CORE_PORT ?? 8090}`,
};
