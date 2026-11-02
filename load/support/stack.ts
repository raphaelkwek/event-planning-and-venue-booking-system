import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { FAKE_AUTH_FLAG, FAKE_AUTH_FLAG_VALUE, assertTestHarnessOnly, startFakeAuthServer, type FakeAuthServer } from "./fake-supabase-auth.js";
import { ACCOUNTS, SEED_PASSWORD } from "./accounts.js";
import { startIdentityStub, type IdentityStub } from "./identity-stub.js";
import { startProcess, waitForUrl, type ManagedProcess } from "./proc.js";

/**
 * The stack the load and chaos runs boot (EN-18, EN-20): the real registration service as a process,
 * the identity stand-in beside it, and (when asked for) the CI-only fake Supabase Auth from EN-14.
 *
 * It refuses to start unless DATABASE_URL is a Postgres on this machine, the same guard the browser
 * tests use, so nothing here can ever reach the team's shared database. Kafka is switched off unless
 * the caller gives brokers.
 */

export const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));
export const REGISTRATION_DIR = join(REPO_ROOT, "backend/services/registration");
const HOST = "127.0.0.1";
export const ANON_KEY = "connectsphere-load-anon-key";

export interface StackOptions {
  /** Where the registration service connects: the throwaway Postgres, or Toxiproxy in front of it. */
  databaseUrl: string;
  /** The Postgres the harness itself uses; the same as `databaseUrl` unless a proxy sits between. */
  harnessDatabaseUrl?: string;
  logDir: string;
  registrationPort?: number;
  identityPort?: number;
  fakeAuthPort?: number;
  withFakeAuth?: boolean;
  poolMax?: number;
  ratePerMinute?: number;
  /** KAFKA_* for the service, e.g. a broker behind Toxiproxy; omit to run without Kafka. */
  kafkaEnv?: Record<string, string>;
  extraEnv?: Record<string, string>;
}

export interface Stack {
  registrationUrl: string;
  identityUrl: string;
  fakeAuthUrl: string | null;
  registration: ManagedProcess;
  /** A Supabase-signed token for the seeded attendee, for browsing; null without the fake auth. */
  browseToken: string | null;
  restartRegistration(): Promise<void>;
  stop(): Promise<void>;
}

export async function signIn(authUrl: string, key: keyof typeof ACCOUNTS): Promise<string> {
  const response = await fetch(`${authUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY },
    body: JSON.stringify({ email: ACCOUNTS[key].email, password: SEED_PASSWORD }),
  });
  if (!response.ok) throw new Error(`the fake auth refused ${key}: ${response.status}`);
  return ((await response.json()) as { access_token: string }).access_token;
}

export async function startStack(options: StackOptions): Promise<Stack> {
  const harnessEnv = { ...process.env, [FAKE_AUTH_FLAG]: FAKE_AUTH_FLAG_VALUE, DATABASE_URL: options.harnessDatabaseUrl ?? options.databaseUrl };
  assertTestHarnessOnly(harnessEnv);
  assertTestHarnessOnly({ ...harnessEnv, DATABASE_URL: options.databaseUrl });

  const registrationPort = options.registrationPort ?? 8092;
  const identity: IdentityStub = await startIdentityStub(options.identityPort ?? 8190);
  let fakeAuth: FakeAuthServer | null = null;
  if (options.withFakeAuth) {
    fakeAuth = await startFakeAuthServer({ port: options.fakeAuthPort ?? 9999, anonKey: ANON_KEY, allowedOrigins: [] }, harnessEnv);
  }

  const env: Record<string, string> = {
    DATABASE_URL: options.databaseUrl,
    REGISTRATION_PORT: String(registrationPort),
    PLANNING_CORE_URL: identity.url,
    SUPABASE_URL: fakeAuth?.url ?? "http://127.0.0.1:1",
    SUPABASE_ANON_KEY: ANON_KEY,
    SUPABASE_JWKS_URL: `${fakeAuth?.url ?? "http://127.0.0.1:1"}/auth/v1/.well-known/jwks.json`,
    NODE_ENV: "production",
    LOG_LEVEL: "info",
    KAFKA_BROKERS: "",
    ...(options.poolMax ? { REGISTRATION_DB_POOL_MAX: String(options.poolMax) } : {}),
    ...(options.ratePerMinute ? { REGISTRATION_RATE_LIMIT_PER_MINUTE: String(options.ratePerMinute) } : {}),
    ...options.kafkaEnv,
    ...options.extraEnv,
  };

  const registrationUrl = `http://${HOST}:${registrationPort}`;
  const launch = async (suffix: string): Promise<ManagedProcess> => {
    const process_ = startProcess({
      name: `registration${suffix}`,
      command: process.execPath,
      args: ["--import", "tsx", "src/index.ts"],
      cwd: REGISTRATION_DIR,
      env,
      logDir: options.logDir,
    });
    await waitForUrl(`${registrationUrl}/healthz`, 60_000);
    return process_;
  };

  let restarts = 0;
  const stack: Stack = {
    registrationUrl,
    identityUrl: identity.url,
    fakeAuthUrl: fakeAuth?.url ?? null,
    registration: await launch(""),
    browseToken: fakeAuth ? await signIn(fakeAuth.url, "attendee") : null,
    async restartRegistration() {
      await stack.registration.stop();
      restarts += 1;
      stack.registration = await launch(`-restart${restarts}`);
    },
    async stop() {
      await stack.registration.stop();
      await identity.close();
      await fakeAuth?.close();
    },
  };
  return stack;
}
