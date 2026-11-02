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
  /** Appended to every consumer group on a laptop, e.g. dev-sk (§3.1); empty when deployed. */
  groupSuffix: process.env.KAFKA_GROUP_SUFFIX?.trim() ?? "",
  /** Supabase's signing keys: browsing verifies the token here, without asking identity (R1, ADR-0005). */
  supabaseJwksUrl: process.env.SUPABASE_JWKS_URL?.trim() ?? "",
  /** Where identity answers "who is this token?" for registering, withdrawing and my registrations: planning-core's GET /api/v1/users/me. */
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
