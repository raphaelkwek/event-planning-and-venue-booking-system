import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { parse } from "dotenv";

// Turns the KAFKA_* block of .env into a kafkajs client config (ADR-0008).
// Only KAFKA_* is read, so no other secret is ever loaded, and nothing here
// puts a value into an error message: problems name the variable, not what it
// holds.

export const SASL_MECHANISMS = ["plain", "scram-sha-256", "scram-sha-512"] as const;
type SaslMechanism = (typeof SASL_MECHANISMS)[number];

export interface KafkaClientConfig {
  brokers: string[];
  ssl: true | { ca: string[] };
  sasl: { mechanism: SaslMechanism; username: string; password: string };
}

export class KafkaConfigError extends Error {
  constructor(readonly problems: string[]) {
    super(`Kafka settings in .env are incomplete:\n  - ${problems.join("\n  - ")}`);
  }
}

export function kafkaVarsFrom(dotenvText: string): Record<string, string> {
  return Object.fromEntries(Object.entries(parse(dotenvText)).filter(([name]) => name.startsWith("KAFKA_")));
}

const REQUIRED = ["KAFKA_BROKERS", "KAFKA_SASL_MECHANISM", "KAFKA_SASL_USERNAME", "KAFKA_SASL_PASSWORD"] as const;

export function toClientConfig(
  vars: Record<string, string | undefined>,
  readFile: (path: string) => string = (path) => readFileSync(path, "utf8"),
): KafkaClientConfig {
  const problems: string[] = [];
  for (const name of REQUIRED) {
    const value = vars[name]?.trim();
    if (!value) problems.push(`${name} is not set`);
    else if (value.startsWith("replace-with-")) problems.push(`${name} still has the .env.example placeholder`);
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

/** Replaces the credentials wherever they appear, in case a library echoes one. */
export function redact(text: string, vars: Record<string, string | undefined>): string {
  let safe = text;
  for (const name of ["KAFKA_SASL_PASSWORD", "KAFKA_SASL_USERNAME"]) {
    const value = vars[name]?.trim();
    if (value) safe = safe.split(value).join(`[${name}]`);
  }
  return safe;
}
