import { appendFileSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { connect, seedEvent, tallyEvent, type SeededEvent } from "./seed.js";
import { K6_IMAGE, runK6, type K6Run } from "./k6.js";
import { readProcUsage, sampleUsage } from "./proc.js";
import { REPO_ROOT, startStack, type Stack } from "./stack.js";
import { evaluateSoak, evaluateSpike, evaluateStress, type Check } from "./evaluate.js";
import { renderResult, runnerInfo, type CpuFigures, type RunResult } from "./report.js";

/**
 * `tsx load/support/run.ts <smoke|spike|soak|stress>` (EN-18). Boots the registration service on the
 * throwaway Postgres in DATABASE_URL, seeds events through the service's own handlers, runs the k6
 * script in the grafana/k6 image, then reads the database back and checks the invariants. Writes
 * load/out/<scenario>/ (the k6 summary, result.json, result.md, the service's log) and exits 1 if a check failed.
 */

const SCENARIOS = ["smoke", "spike", "soak", "stress"] as const;
type Scenario = (typeof SCENARIOS)[number];

/** One address is one load generator, so the interim per-address limit (ADR-0011) is lifted for the run. */
const RATE_PER_MINUTE = 100_000_000;
const STRESS_STEPS = [100, 250, 500, 750, 1000, 1500, 2000];
const STRESS_HOLD_SECONDS = 30;
const STRESS_RAMP_SECONDS = 5;

const numberFrom = (name: string, fallback: number) => {
  const value = process.env[name];
  return value ? Number(value) : fallback;
};

const NOTES = [
  "The registration service ran from source with tsx (as `npm run dev` does), not from the container image. Steady-state CPU should be close; start-up is not.",
  "Identity was a stand-in that answers from the token (`load/support/identity-stub.ts`). The real hop, planning-core's GET /api/v1/users/me, adds a network call and its own CPU to every register, withdraw and my-registrations request, and is not in these numbers.",
  "The service's interim 120-requests-a-minute-per-address limit (ADR-0011) was raised for the run: one load generator is one address. The gateway (EN-12) owns rate limiting; it was not under test.",
  "k6, the service and Postgres shared one runner, so the figures are a floor for what a dedicated machine could do, not the production cluster's.",
];

async function main(scenario: Scenario) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL must point at the runner's throwaway Postgres.");
  const outDir = join(REPO_ROOT, "load/out", scenario);
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  const poolMax = numberFrom("LOAD_POOL_MAX", 5);
  const stack = await startStack({ databaseUrl, logDir: outDir, withFakeAuth: scenario === "soak", poolMax, ratePerMinute: RATE_PER_MINUTE });
  const sql = connect(databaseUrl);
  const startedAt = new Date();
  try {
    const result = await RUNNERS[scenario]({ stack, sql, outDir, poolMax });
    result.runner = runnerInfo(K6_IMAGE);
    result.notes = [...NOTES, ...result.notes];
    result.startedAt = startedAt.toISOString();
    finish(outDir, result);
    process.exitCode = result.ok ? 0 : 1;
  } finally {
    await sql.end({ timeout: 5 });
    await stack.stop();
  }
}

type Sqlx = ReturnType<typeof connect>;
interface Context {
  stack: Stack;
  sql: Sqlx;
  outDir: string;
  poolMax: number;
}

function finish(outDir: string, result: RunResult) {
  writeFileSync(join(outDir, "result.json"), JSON.stringify(result, null, 2));
  const markdown = renderResult(result);
  writeFileSync(join(outDir, "result.md"), markdown);
  console.log(markdown);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown + "\n");
}

/** CPU the service used while k6 ran, per request k6 completed. */
function cpuFigures(before: ReturnType<typeof readProcUsage>, after: ReturnType<typeof readProcUsage>, run: K6Run): CpuFigures | null {
  if (!before || !after) return null;
  const cpuSeconds = after.cpuSeconds - before.cpuSeconds;
  const seconds = (run.finishedAt.getTime() - run.startedAt.getTime()) / 1000;
  const requests = (run.summary.metrics.http_reqs?.values.count as number | undefined) ?? 0;
  return { cpuSeconds, perRequestMs: requests > 0 ? (cpuSeconds * 1000) / requests : null, coresUsed: seconds > 0 ? cpuSeconds / seconds : null };
}

const seconds = (run: K6Run) => (run.finishedAt.getTime() - run.startedAt.getTime()) / 1000;

function addK6ExitCheck(run: K6Run, checks: Check[]) {
  checks.push({ name: "k6 ran to the end", ok: run.exitCode === 0 || run.exitCode === 99, detail: `k6 exit code ${run.exitCode}` });
}

async function spikeLike(scenario: "smoke" | "spike", { stack, sql, outDir, poolMax }: Context): Promise<RunResult> {
  const seats = scenario === "smoke" ? 20 : 100;
  const rate = numberFrom("LOAD_RATE", scenario === "smoke" ? 40 : 500);
  const duration = process.env.LOAD_DURATION ?? "10s";
  const event = await seedEvent(sql, seats);
  const before = readProcUsage(stack.registration.pid);
  const run = await runK6({
    script: "spike.js",
    outDir,
    env: { BASE_URL: stack.registrationUrl, EVENT_ID: event.eventId, RATE: String(rate), DURATION: duration, SLO_ENFORCE: scenario === "smoke" ? "1" : "0" },
  });
  const after = readProcUsage(stack.registration.pid);
  const evaluated = evaluateSpike({ summary: run.summary, tally: await tallyEvent(sql, event.eventId), seats, targetRate: rate, enforceSlo: scenario === "smoke" });
  addK6ExitCheck(run, evaluated.checks);
  const notes = [];
  if (!evaluated.figures.rateSustained) notes.push(`The ${rate} req/s target was not sustained on this runner: k6 completed ${evaluated.figures.achievedRate?.toFixed(1) ?? "n/a"} req/s and dropped ${evaluated.figures.droppedIterations} iterations. The invariants above held at the rate that was achieved.`);
  return {
    scenario,
    ok: evaluated.checks.every((c) => c.ok),
    startedAt: "",
    durationSeconds: seconds(run),
    runner: runnerInfo(K6_IMAGE),
    config: { seats, targetRate: rate, duration, dbPoolMax: poolMax, distinctAttendees: "one per attempt" },
    checks: evaluated.checks,
    outcomes: evaluated.outcomes,
    spike: evaluated.figures,
    cpu: cpuFigures(before, after, run),
    notes,
  };
}

async function soak({ stack, sql, outDir, poolMax }: Context): Promise<RunResult> {
  const minutes = numberFrom("SOAK_MINUTES", 5);
  const rate = numberFrom("LOAD_RATE", 100);
  const events: SeededEvent[] = [];
  for (let i = 0; i < 10; i++) events.push(await seedEvent(sql, 3000));
  const sampler = sampleUsage(stack.registration.pid, 10_000);
  const before = readProcUsage(stack.registration.pid);
  const run = await runK6({
    script: "soak.js",
    outDir,
    env: {
      BASE_URL: stack.registrationUrl,
      EVENT_IDS: events.map((e) => e.eventId).join(","),
      BROWSE_TOKEN: stack.browseToken ?? "",
      RATE: String(rate),
      DURATION: `${minutes}m`,
    },
  });
  const after = readProcUsage(stack.registration.pid);
  const samples = sampler.stop();
  writeFileSync(join(outDir, "usage-samples.json"), JSON.stringify(samples, null, 1));
  const tallies = await Promise.all(events.map((e) => tallyEvent(sql, e.eventId)));
  const evaluated = evaluateSoak({ summary: run.summary, tallies, samples });
  addK6ExitCheck(run, evaluated.checks);
  return {
    scenario: "soak",
    ok: evaluated.checks.every((c) => c.ok),
    startedAt: "",
    durationSeconds: seconds(run),
    runner: runnerInfo(K6_IMAGE),
    config: { events: events.length, seatsPerEvent: 3000, rate, minutes, dbPoolMax: poolMax, mix: "50% browse, 20% event page, 10% my registrations, 20% register then withdraw" },
    checks: evaluated.checks,
    outcomes: evaluated.outcomes,
    cpu: cpuFigures(before, after, run),
    memory: evaluated.memory,
    notes: minutes < 2 ? ["The run was shorter than two minutes, so the memory check had too few samples to judge."] : [],
  };
}

async function stress({ stack, sql, outDir, poolMax }: Context): Promise<RunResult> {
  const seats = 250_000;
  const event = await seedEvent(sql, seats);
  const sampler = sampleUsage(stack.registration.pid, 10_000);
  const before = readProcUsage(stack.registration.pid);
  const run = await runK6({
    script: "stress.js",
    outDir,
    env: {
      BASE_URL: stack.registrationUrl,
      EVENT_ID: event.eventId,
      STEPS: STRESS_STEPS.join(","),
      HOLD_SECONDS: String(STRESS_HOLD_SECONDS),
    },
  });
  const after = readProcUsage(stack.registration.pid);
  writeFileSync(join(outDir, "usage-samples.json"), JSON.stringify(sampler.stop(), null, 1));
  const evaluated = evaluateStress({ summary: run.summary, tally: await tallyEvent(sql, event.eventId), steps: STRESS_STEPS, holdSeconds: STRESS_HOLD_SECONDS, rampSeconds: STRESS_RAMP_SECONDS });
  addK6ExitCheck(run, evaluated.checks);
  return {
    scenario: "stress",
    ok: evaluated.checks.every((c) => c.ok),
    startedAt: "",
    durationSeconds: seconds(run),
    runner: runnerInfo(K6_IMAGE),
    config: { seats, steps: STRESS_STEPS.join(","), holdSeconds: STRESS_HOLD_SECONDS, rampSeconds: STRESS_RAMP_SECONDS, dbPoolMax: poolMax },
    checks: evaluated.checks,
    outcomes: evaluated.outcomes,
    steps: evaluated.results,
    sustainableRate: evaluated.sustainable?.targetRate ?? null,
    firstBrokenRate: evaluated.firstBroken?.targetRate ?? null,
    cpu: cpuFigures(before, after, run),
    notes: ["Reaching a break is a finding, not a failure: the run fails only if an invariant failed. A step's first five seconds are the ramp up from the step before."],
  };
}

const RUNNERS: Record<Scenario, (context: Context) => Promise<RunResult>> = {
  smoke: (c) => spikeLike("smoke", c),
  spike: (c) => spikeLike("spike", c),
  soak,
  stress,
};

const scenario = process.argv[2] as Scenario;
if (!SCENARIOS.includes(scenario)) {
  console.error(`Usage: tsx load/support/run.ts <${SCENARIOS.join("|")}>`);
  process.exit(2);
}
main(scenario).catch((error: Error) => {
  console.error(error);
  process.exit(1);
});
