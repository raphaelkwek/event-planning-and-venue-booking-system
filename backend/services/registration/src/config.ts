import { readSigningKey, readWaitingRoomSettings } from "./domain/waitingRoom.js";

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
