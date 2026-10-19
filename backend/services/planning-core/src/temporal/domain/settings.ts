/**
 * EN-11 — the TEMPORAL_* variables (implementation.md §10, ADR-0009). Like
 * KAFKA_*, an unset address means "run without it", so `npm run dev` works on a
 * laptop with no namespace. Problems name the variable, never its value, so a
 * key can't end up in a log.
 *
 * Temporal Cloud with an API key: the address is the regional endpoint (or the
 * namespace endpoint), TLS is on, and the key is sent with the namespace header
 * Temporal Cloud routes requests by.
 */

/** The worker's task queue unless TEMPORAL_TASK_QUEUE names another. */
export const DEFAULT_TASK_QUEUE = "planning-core";

export type TemporalSettings =
  | { status: "not_configured" }
  | { status: "invalid"; problems: string[] }
  | { status: "configured"; address: string; namespace: string; apiKey: string | null; taskQueue: string };

type Vars = Record<string, string | undefined>;

const HOST_AND_PORT = /^[^\s:]+:\d+$/;
const isPlaceholder = (value: string) => value.startsWith("replace-with-");

export function temporalSettingsFromEnv(vars: Vars): TemporalSettings {
  const read = (name: string) => vars[name]?.trim() || null;

  const address = read("TEMPORAL_ADDRESS");
  if (!address || isPlaceholder(address)) return { status: "not_configured" };

  const problems: string[] = [];
  if (!HOST_AND_PORT.test(address)) problems.push("TEMPORAL_ADDRESS must be host:port");
  const namespace = read("TEMPORAL_NAMESPACE");
  if (!namespace) problems.push("TEMPORAL_NAMESPACE is not set");
  else if (isPlaceholder(namespace)) problems.push("TEMPORAL_NAMESPACE still has the .env.example placeholder");
  const apiKey = read("TEMPORAL_API_KEY");
  if (apiKey && isPlaceholder(apiKey)) problems.push("TEMPORAL_API_KEY still has the .env.example placeholder");

  if (problems.length > 0) return { status: "invalid", problems };
  return { status: "configured", address, namespace: namespace!, apiKey, taskQueue: read("TEMPORAL_TASK_QUEUE") ?? DEFAULT_TASK_QUEUE };
}

export interface TemporalConnectionOptions {
  address: string;
  tls?: true;
  apiKey?: string;
  metadata?: Record<string, string>;
}

/** What Connection.connect and NativeConnection.connect take. */
export function connectionOptionsFor(settings: Extract<TemporalSettings, { status: "configured" }>): TemporalConnectionOptions {
  if (!settings.apiKey) return { address: settings.address };
  return {
    address: settings.address,
    tls: true,
    apiKey: settings.apiKey,
    metadata: { "temporal-namespace": settings.namespace },
  };
}
