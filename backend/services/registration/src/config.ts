function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

/**
 * The registration service's settings (implementation.md §10). Kafka's come
 * from the KAFKA_* variables through @connectsphere/kafka.
 */
export const config = {
  port: Number(process.env.REGISTRATION_PORT ?? 8092),
  serviceName: "registration",
  databaseUrl: required("DATABASE_URL"),
  /** Appended to every consumer group on a laptop, e.g. dev-sk (§3.1); empty when deployed. */
  groupSuffix: process.env.KAFKA_GROUP_SUFFIX?.trim() ?? "",
};
