import { readSigningKey, readWaitingRoomSettings } from "./domain/waitingRoom.js";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

/**
 * A whole number setting from the environment, or `fallback` when it is unset.
 * A value that is not a positive whole number stops the service at start-up
 * rather than being guessed at.
 */
export function positiveIntFromEnv(env: Record<string, string | undefined>, name: string, fallback: number): number {
  const text = env[name]?.trim();
  if (!text) return fallback;
  const value = Number(text);
  if (!Number.isInteger(value) || value < 1) throw new Error(`${name} must be a positive whole number, not "${text}".`);
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
  /**
   * Connections this process may open to the database. Pods x this stays within 80% of the pooler's
   * limit (deploy/k8s/components/autoscaling), which is where the HPA's maximum comes from (EN-18).
   */
  dbPoolMax: positiveIntFromEnv(process.env, "REGISTRATION_DB_POOL_MAX", 5),
  /**
   * Requests per minute per client address, until the gateway limits requests (ADR-0011). The load
   * tests (EN-18) raise it, because one load generator is one address; a deployment leaves it alone.
   */
  rateLimitPerMinute: positiveIntFromEnv(process.env, "REGISTRATION_RATE_LIMIT_PER_MINUTE", 120),
  /** implementation.md §4.7: a query that runs longer than this is cancelled (0, the default, sends none: the Supabase pooler may reject a startup parameter, so 5000 is opt-in; see .env.example). Migrations use their own connection. */
  dbStatementTimeoutMs: Number(process.env.DB_STATEMENT_TIMEOUT_MS ?? 0),
  /** Appended to every consumer group on a laptop, e.g. dev-sk (§3.1); empty when deployed. */
  groupSuffix: process.env.KAFKA_GROUP_SUFFIX?.trim() ?? "",
  /** Supabase's signing keys: browsing verifies the token here, without asking identity (R1, ADR-0005). */
  supabaseJwksUrl: process.env.SUPABASE_JWKS_URL?.trim() ?? "",
  /** Where identity answers "who is this token?" for registering, withdrawing and my registrations: planning-core's GET /api/v1/users/me. */
  /**
   * How many proxies (the gateway, a load balancer) sit in front of this service. Behind them every request
   * arrives from the proxy's address, so the per-address limits would count all attendees together; with
   * this set, Express reads the client's address from X-Forwarded-For, skipping that many hops. 0 (the
   * default) trusts no header, so a client cannot choose its own key.
   */
  trustProxyHops: Number.parseInt(process.env.TRUST_PROXY_HOPS ?? "0", 10) || 0,
  planningCoreUrl: process.env.PLANNING_CORE_URL ?? `http://127.0.0.1:${process.env.PLANNING_CORE_PORT ?? 8090}`,
  /**
   * EN-19, the waiting room: how many attendees a flagged event admits a second, how long an admission token
   * lasts, and the key it is signed with. An invalid value stops the service starting. With no key set,
   * flagged events cannot take registrations (WAITING_ROOM_UNAVAILABLE) rather than take them unchecked.
   */
  waitingRoom: {
    ...readWaitingRoomSettings(process.env),
    signingKey: readSigningKey(process.env),
  },
};
