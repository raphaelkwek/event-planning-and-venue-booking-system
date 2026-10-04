import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// Turns the KAFKA_* variables into a kafkajs client config (implementation.md
// §3, §10). Only KAFKA_* is read, and nothing here puts a value into an error
// message: problems name the variable, not what it holds. `npm run kafka:check`
// uses the same reader, so a laptop that passes it runs the relay too.

export const SASL_MECHANISMS = ["plain", "scram-sha-256", "scram-sha-512"] as const;
type SaslMechanism = (typeof SASL_MECHANISMS)[number];

export interface KafkaClientConfig {
  brokers: string[];
  ssl: true | { ca: string[] };
  sasl: { mechanism: SaslMechanism; username: string; password: string };
}

type Vars = Record<string, string | undefined>;

export class KafkaConfigError extends Error {
  constructor(readonly problems: string[]) {
    super(`Kafka settings are incomplete:\n  - ${problems.join("\n  - ")}`);
  }
}

const REQUIRED = ["KAFKA_BROKERS", "KAFKA_SASL_MECHANISM", "KAFKA_SASL_USERNAME", "KAFKA_SASL_PASSWORD"] as const;
const isPlaceholder = (value: string) => value.startsWith("replace-with-");

export function toClientConfig(
  vars: Vars,
  readFile: (path: string) => string = (path) => readFileSync(path, "utf8"),
): KafkaClientConfig {
  const problems: string[] = [];
  for (const name of REQUIRED) {
    const value = vars[name]?.trim();
    if (!value) problems.push(`${name} is not set`);
    else if (isPlaceholder(value)) problems.push(`${name} still has the .env.example placeholder`);
  }

  const mechanism = vars.KAFKA_SASL_MECHANISM?.trim().toLowerCase();
  if (mechanism && !(SASL_MECHANISMS as readonly string[]).includes(mechanism)) {
    problems.push(`KAFKA_SASL_MECHANISM must be one of ${SASL_MECHANISMS.join(", ")}`);
  }

  let ssl: KafkaClientConfig["ssl"] = true;
  const caPath = vars.KAFKA_SSL_CA_PATH?.trim();
  if (caPath) {
    const resolved = caPath.startsWith("~/") ? join(homedir(), caPath.slice(2)) : caPath;
    try {
      ssl = { ca: [readFile(resolved)] };
    } catch {
      problems.push(`KAFKA_SSL_CA_PATH: cannot read ${caPath}`);
    }
  }

  if (problems.length > 0) throw new KafkaConfigError(problems);

  return {
    brokers: vars.KAFKA_BROKERS!.split(",").map((broker) => broker.trim()).filter(Boolean),
    ssl,
    sasl: {
      mechanism: mechanism as SaslMechanism,
      username: vars.KAFKA_SASL_USERNAME!.trim(),
      password: vars.KAFKA_SASL_PASSWORD!.trim(),
    },
  };
}

export type KafkaSettings =
  | { status: "not_configured" }
  | { status: "invalid"; problems: string[] }
  | { status: "configured"; config: KafkaClientConfig };

/**
 * Whether this process talks to Kafka. A laptop with no KAFKA_BROKERS (or the
 * .env.example placeholder) runs without the relay rather than failing to
 * start; the outbox keeps every message until a relay somewhere publishes it.
 */
export function kafkaSettingsFromEnv(vars: Vars, readFile?: (path: string) => string): KafkaSettings {
  const brokers = vars.KAFKA_BROKERS?.trim();
  if (!brokers || isPlaceholder(brokers)) return { status: "not_configured" };
  try {
    return { status: "configured", config: toClientConfig(vars, readFile) };
  } catch (error) {
    return { status: "invalid", problems: (error as KafkaConfigError).problems };
  }
}

/** Replaces the credentials wherever they appear, in case a library echoes one. */
export function redact(text: string, vars: Vars): string {
  let safe = text;
  for (const name of ["KAFKA_SASL_PASSWORD", "KAFKA_SASL_USERNAME"]) {
    const value = vars[name]?.trim();
    if (value) safe = safe.split(value).join(`[${name}]`);
  }
  return safe;
}
