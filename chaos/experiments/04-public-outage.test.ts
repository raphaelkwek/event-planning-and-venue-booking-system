import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { startStack, signIn, REPO_ROOT, type Stack } from "../../load/support/stack.js";
import { startProcess, waitForUrl, type ManagedProcess } from "../../load/support/proc.js";
import { ANON_KEY } from "../../load/support/stack.js";
import { ACCOUNTS } from "../../load/support/accounts.js";

/**
 * EN-20 experiment 4: a public outage does not reach staff.
 *
 * Hypothesis: with the registration service down, every staff function in planning-core answers exactly
 * as it did, as fast as it did; the public registration routes are refused at the connection; and
 * when the service is started again the public routes work.
 *
 * Real processes, not mocks: the registration service and planning-core, on one throwaway Postgres,
 * with the CI-only fake Supabase Auth (EN-14). The outage is the registration process killed with SIGKILL.
 *
 * Not claimed: the other half of the design's pass condition, "browsing works from cache". There is no CDN
 * yet (EN-12), so while registration is down attendees cannot browse. That half stays open.
 */

const DATABASE_URL = process.env.DATABASE_URL!;
const OUT = join(REPO_ROOT, "chaos/out");
const PLANNING_CORE_PORT = 8090;
const PLANNING_CORE = `http://127.0.0.1:${PLANNING_CORE_PORT}`;
const CALLS_FOR_LATENCY = 20;
const READ_SLO_MS = 400;

let stack: Stack;
let core: ManagedProcess;
const tokens: Record<"organiser" | "coordinator" | "venuestaff", string> = { organiser: "", coordinator: "", venuestaff: "" };

const STAFF_CALLS: Array<{ as: keyof typeof tokens; path: string }> = [
  { as: "organiser", path: "/api/v1/users/me" },
  { as: "organiser", path: "/api/v1/events" },
  { as: "coordinator", path: "/api/v1/events" },
  { as: "venuestaff", path: "/api/v1/venues" },
];

beforeAll(async () => {
  mkdirSync(OUT, { recursive: true });
  stack = await startStack({ databaseUrl: DATABASE_URL, logDir: join(OUT, "04-public-outage"), withFakeAuth: true });
  core = startProcess({
    name: "planning-core",
    command: process.execPath,
    args: ["--import", "tsx", "src/index.ts"],
    cwd: join(REPO_ROOT, "backend/services/planning-core"),
    logDir: join(OUT, "04-public-outage"),
    env: {
      DATABASE_URL,
      SUPABASE_URL: stack.fakeAuthUrl!,
      SUPABASE_ANON_KEY: ANON_KEY,
      SUPABASE_JWKS_URL: `${stack.fakeAuthUrl}/auth/v1/.well-known/jwks.json`,
      SUPABASE_SERVICE_ROLE_KEY: "",
      PLANNING_CORE_PORT: String(PLANNING_CORE_PORT),
      KAFKA_BROKERS: "",
      LOG_LEVEL: "warn",
    },
  });
  await waitForUrl(`${PLANNING_CORE}/healthz`, 90_000);
  for (const key of Object.keys(tokens) as Array<keyof typeof tokens>) tokens[key] = await signIn(stack.fakeAuthUrl!, key);
}, 180_000);

afterAll(async () => {
  await core?.stop();
  await stack?.stop();
});

async function staff(call: (typeof STAFF_CALLS)[number]) {
  const startedAt = performance.now();
  const response = await fetch(`${PLANNING_CORE}${call.path}`, { headers: { Authorization: `Bearer ${tokens[call.as]}` } });
  const body = (await response.json().catch(() => null)) as unknown;
  return { status: response.status, body, ms: performance.now() - startedAt };
}

async function staffRound() {
  return Promise.all(STAFF_CALLS.map((call) => staff(call)));
}

async function staffLatencyP95(): Promise<number> {
  const times: number[] = [];
  for (let i = 0; i < CALLS_FOR_LATENCY; i++) for (const call of STAFF_CALLS.slice(0, 2)) times.push((await staff(call)).ms);
  times.sort((a, b) => a - b);
  return times[Math.ceil(times.length * 0.95) - 1]!;
}

/** What stopped a request: Node's fetch wraps the socket error, e.g. ECONNREFUSED, as the cause of "fetch failed". */
const whyRefused = (error: Error) => (error.cause as NodeJS.ErrnoException | undefined)?.code ?? error.message;

const publicCall = async () => {
  const browse = await fetch(`${stack.registrationUrl}/api/v1/open-events`, { headers: { Authorization: `Bearer ${stack.browseToken}` } });
  return browse.status;
};

describe("Experiment 4: a public outage does not reach staff", () => {
  it("staff functions answer exactly as before while registration is down, and the public routes return when it is back (EN-20-T4)", async () => {
    // Before: everything up.
    const before = await staffRound();
    expect(before.map((r) => r.status), "the staff calls work to begin with").toEqual([200, 200, 200, 200]);
    expect(await publicCall(), "registration answers to begin with").toBe(200);
    const p95Before = await staffLatencyP95();

    // The outage: the registration process is killed.
    await stack.registration.stop("SIGKILL");
    const refusedWhileDown = await Promise.all([
      fetch(`${stack.registrationUrl}/healthz`).then(() => "answered", whyRefused),
      publicCall().then(() => "answered", whyRefused),
      fetch(`${stack.registrationUrl}/api/v1/registrations`, { method: "POST" }).then(() => "answered", whyRefused),
    ]);

    // During: the same staff calls.
    const during = await staffRound();
    const p95During = await staffLatencyP95();

    // After: registration is started again.
    await stack.restartRegistration();
    const publicAfter = await publicCall();
    const after = await staffRound();

    const result = {
      experiment: 4,
      staffCalls: STAFF_CALLS.map((c) => `${c.as} GET ${c.path}`),
      statusesBefore: before.map((r) => r.status),
      statusesDuring: during.map((r) => r.status),
      statusesAfter: after.map((r) => r.status),
      sameBodiesDuring: JSON.stringify(before.map((r) => r.body)) === JSON.stringify(during.map((r) => r.body)),
      staffP95Ms: { before: p95Before, during: p95During },
      staffReadSloMs: READ_SLO_MS,
      publicRoutesWhileDown: refusedWhileDown,
      publicRouteAfterRestart: publicAfter,
      seededAccountsUsed: ["organiser", "coordinator", "venuestaff"].map((k) => ACCOUNTS[k as keyof typeof ACCOUNTS].email),
    };
    writeFileSync(join(OUT, "04-public-outage.json"), JSON.stringify(result, null, 2));
    console.log(`experiment 4: ${JSON.stringify(result)}`);

    expect(refusedWhileDown, "the public routes are refused at the connection").toEqual(["ECONNREFUSED", "ECONNREFUSED", "ECONNREFUSED"]);
    expect(during.map((r) => r.status)).toEqual(before.map((r) => r.status));
    expect(during.map((r) => r.body), "staff answers are byte for byte the same").toEqual(before.map((r) => r.body));
    expect(p95During, "staff reads stay inside their objective").toBeLessThanOrEqual(READ_SLO_MS);
    expect(publicAfter, "the public route works again after the restart").toBe(200);
    expect(after.map((r) => r.status)).toEqual(before.map((r) => r.status));
  }, 240_000);
});
