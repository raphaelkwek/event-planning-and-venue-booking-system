#!/usr/bin/env node
// ADR-0016. Builds the env file the deploy gate turns into the namespace's connectsphere-secrets
// Secret (deploy/oracle/connectsphere-deploy apply-secret). The Release workflow runs it with the
// GitHub environment's secrets and variables in its environment; the kind job runs it with
// throwaway values. It writes the file with mode 0600 and never prints a value: every message
// names the variable only.
//
//   node deploy/release/secret-env.mjs --out "$RUNNER_TEMP/connectsphere.env"
//
// The in-cluster addresses (Redpanda, Temporal) and the Kafka username are the same in both
// environments, because they are short names inside the namespace, so they are fixed here
// rather than asked of each environment.
import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

/** Read from the environment, with the check each must pass. */
export const FROM_ENVIRONMENT = {
  // Supabase's transaction pooler (port 6543): what the services use, with prepare: false.
  DATABASE_URL: (v) => /^postgres(ql)?:\/\/\S+$/.test(v) || "must be a postgres:// URL",
  // Supabase's session pooler (port 5432 on the pooler host): the migrate Job only.
  MIGRATE_DATABASE_URL: (v) => /^postgres(ql)?:\/\/\S+$/.test(v) || "must be a postgres:// URL",
  SUPABASE_URL: (v) => /^https:\/\/[a-z0-9.-]+(:\d+)?$/.test(v) || "must be https://<project-ref>.supabase.co with no path",
  SUPABASE_ANON_KEY: (v) => /^\S{2,}$/.test(v) || "must be one token with no spaces",
  SUPABASE_SERVICE_ROLE_KEY: (v) => /^\S{2,}$/.test(v) || "must be one token with no spaces",
  // Becomes part of Redpanda's RP_BOOTSTRAP_USER (user:password), so no colon or symbol.
  KAFKA_SASL_PASSWORD: (v) => /^[A-Za-z0-9]{24,}$/.test(v) || "must be at least 24 letters or digits (openssl rand -hex 24)",
};

/** The same in both environments. */
export const FIXED = {
  KAFKA_BROKERS: "redpanda:9092",
  KAFKA_SASL_USERNAME: "connectsphere",
  TEMPORAL_ADDRESS: "temporal:7233",
  TEMPORAL_NAMESPACE: "default",
};

/** Every key the gate accepts; it refuses any other (deploy/oracle/connectsphere-deploy). */
export const ALLOWED_KEYS = [...Object.keys(FROM_ENVIRONMENT), "SUPABASE_JWKS_URL", ...Object.keys(FIXED)];

export class SecretEnvError extends Error {
  constructor(problems) {
    super(problems.join("; "));
    this.problems = problems;
  }
}

/** The env file's text. Throws with every problem at once, each naming a variable, never a value. */
export function buildEnvFile(env) {
  const problems = [];
  const values = {};
  for (const [name, check] of Object.entries(FROM_ENVIRONMENT)) {
    const value = env[name]?.trim();
    if (!value) {
      problems.push(`${name} is not set`);
      continue;
    }
    if (/[\r\n]/.test(value)) {
      problems.push(`${name} contains a line break`);
      continue;
    }
    const verdict = check(value);
    if (verdict !== true) problems.push(`${name} ${verdict}`);
    else values[name] = value;
  }
  if (problems.length > 0) throw new SecretEnvError(problems);
  values.SUPABASE_JWKS_URL = `${values.SUPABASE_URL}/auth/v1/.well-known/jwks.json`;
  Object.assign(values, FIXED);
  return ALLOWED_KEYS.map((key) => `${key}=${values[key]}`).join("\n") + "\n";
}

function main() {
  const at = process.argv.indexOf("--out");
  const out = at === -1 ? undefined : process.argv[at + 1];
  if (!out) {
    console.error("secret-env: --out <file> is required (this script never writes secrets to stdout)");
    process.exit(2);
  }
  try {
    writeFileSync(out, buildEnvFile(process.env), { mode: 0o600 });
    console.log(`secret-env: wrote ${ALLOWED_KEYS.length} keys: ${ALLOWED_KEYS.join(", ")}`);
  } catch (error) {
    if (!(error instanceof SecretEnvError)) throw error;
    for (const problem of error.problems) console.error(`::error::${problem}`);
    process.exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
