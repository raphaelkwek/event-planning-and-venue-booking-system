import type { EventTally } from "./seed.js";

/**
 * Reading a k6 summary against the database (EN-18, EN-20). Pure, so it is unit-tested: given what k6 counted and
 * what the database holds, it says which invariants held. A check that fails fails the run; the figures that
 * depend on the machine (rates, latency) are reported next to the verdict and never invented.
 */

export interface K6Metric {
  type: string;
  values: Record<string, number>;
}

export interface K6Summary {
  metrics: Record<string, K6Metric | undefined>;
  state?: { testRunDurationMs?: number };
}

export interface Check {
  name: string;
  ok: boolean;
  detail: string;
}

export const SLO_REGISTER_P95_MS = 800;
export const SLO_READ_P95_MS = 400;

export function metricValue(summary: K6Summary, metric: string, key: string): number | null {
  const value = summary.metrics[metric]?.values[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

const count = (summary: K6Summary, metric: string) => metricValue(summary, metric, "count") ?? 0;

export interface Outcomes {
  registered: number;
  full: number;
  otherConflict: number;
  outsideWindow: number;
  rateLimited: number;
  serverErrors: number;
  otherStatus: number;
  withdrawn: number;
  withdrawFailed: number;
  readsOk: number;
  readsFailed: number;
}

/** What came back, by kind: every k6 response lands in exactly one of the register counters. */
export function outcomesOf(summary: K6Summary): Outcomes {
  return {
    registered: count(summary, "r_201"),
    full: count(summary, "r_409_full"),
    otherConflict: count(summary, "r_409_other"),
    outsideWindow: count(summary, "r_422"),
    rateLimited: count(summary, "r_429"),
    serverErrors: count(summary, "r_5xx"),
    otherStatus: count(summary, "r_other"),
    withdrawn: count(summary, "w_200"),
    withdrawFailed: count(summary, "w_other"),
    readsOk: count(summary, "read_200"),
    readsFailed: count(summary, "read_other"),
  };
}

export const unexpectedRegisterResponses = (o: Outcomes) => o.otherConflict + o.outsideWindow + o.rateLimited + o.serverErrors + o.otherStatus;

const check = (name: string, ok: boolean, detail: string): Check => ({ name, ok, detail });

/** The seats-are-exact invariants, for an event that more attendees tried for than it has seats. */
export function seatChecks(tally: EventTally, seats: number): Check[] {
  return [
    check("every seat is registered", tally.registered === seats, `${tally.registered} REGISTERED registrations for ${seats} seats`),
    check("every seat is claimed", tally.claimedSeats === seats, `${tally.claimedSeats} seats CLAIMED of ${tally.seats}`),
    check("no over-admission", tally.registered <= seats, `${tally.registered} registered, ${seats} seats`),
    check("each registration has its own attendee", tally.distinctAttendees === tally.registered, `${tally.distinctAttendees} distinct attendees in ${tally.registered} registrations`),
    check("each registration has its own seat", tally.distinctSeatsHeld === tally.registered, `${tally.distinctSeatsHeld} distinct seats in ${tally.registered} registrations`),
    check("registrations and claimed seats match one to one", tally.mismatches === 0, `${tally.mismatches} registrations or seats without a match`),
    check("one confirmation message per registration is in the outbox", tally.outboxRows === tally.registered, `${tally.outboxRows} outbox rows for ${tally.registered} registrations`),
  ];
}

export interface SpikeInput {
  summary: K6Summary;
  tally: EventTally;
  seats: number;
  targetRate: number;
  /** Whether the p95 objective fails the run (the smoke run) or is only reported (the spike). */
  enforceSlo: boolean;
}

export interface SpikeFigures {
  targetRate: number;
  achievedRate: number | null;
  droppedIterations: number;
  requests: number;
  p95AllMs: number | null;
  p95RegisteredMs: number | null;
  p95RefusedMs: number | null;
  sloMs: number;
  sloMet: boolean | null;
  rateSustained: boolean;
}

export function spikeFigures(summary: K6Summary, targetRate: number): SpikeFigures {
  const achievedRate = metricValue(summary, "http_reqs", "rate");
  const dropped = count(summary, "dropped_iterations");
  const p95AllMs = metricValue(summary, "register_ms", "p(95)");
  return {
    targetRate,
    achievedRate,
    droppedIterations: dropped,
    requests: count(summary, "http_reqs"),
    p95AllMs,
    p95RegisteredMs: metricValue(summary, "register_201_ms", "p(95)"),
    p95RefusedMs: metricValue(summary, "register_refused_ms", "p(95)"),
    sloMs: SLO_REGISTER_P95_MS,
    sloMet: p95AllMs === null ? null : p95AllMs <= SLO_REGISTER_P95_MS,
    // The runner held the rate it was asked for: nothing dropped and at least 95% of the target came back.
    rateSustained: dropped === 0 && achievedRate !== null && achievedRate >= 0.95 * targetRate,
  };
}

export function evaluateSpike(input: SpikeInput): { checks: Check[]; figures: SpikeFigures; outcomes: Outcomes } {
  const { summary, tally, seats } = input;
  const outcomes = outcomesOf(summary);
  const figures = spikeFigures(summary, input.targetRate);
  const attempts = outcomes.registered + outcomes.full + unexpectedRegisterResponses(outcomes);
  const checks = [
    ...seatChecks(tally, seats),
    check("k6 saw exactly as many 201s as there are registrations", outcomes.registered === tally.registered, `${outcomes.registered} responses with status 201`),
    check("every other attempt was refused REGISTRATION_FULL", unexpectedRegisterResponses(outcomes) === 0 && outcomes.full === attempts - outcomes.registered, `${outcomes.full} refused REGISTRATION_FULL, ${unexpectedRegisterResponses(outcomes)} anything else (429: ${outcomes.rateLimited}, 5xx: ${outcomes.serverErrors}, other: ${outcomes.otherStatus})`),
    check("more attempts than seats, so the invariant was really tested", attempts > seats, `${attempts} attempts for ${seats} seats`),
  ];
  if (input.enforceSlo) {
    checks.push(check(`p95 is at most ${SLO_REGISTER_P95_MS} ms`, figures.sloMet === true, `p95 ${figures.p95AllMs?.toFixed(1) ?? "n/a"} ms`));
  }
  return { checks, figures, outcomes };
}

/** Resident memory in the last minute against the first, from the samples taken every few seconds. */
export function memoryGrowth(samples: { atSeconds: number; rssMegabytes: number }[], windowSeconds = 60): { firstMb: number; lastMb: number; growthPercent: number } | null {
  if (samples.length < 2) return null;
  const end = samples[samples.length - 1]!.atSeconds;
  const settled = samples.filter((s) => s.atSeconds >= windowSeconds && s.atSeconds <= 2 * windowSeconds);
  const last = samples.filter((s) => s.atSeconds >= end - windowSeconds);
  if (settled.length === 0 || last.length === 0) return null;
  const mean = (xs: { rssMegabytes: number }[]) => xs.reduce((sum, s) => sum + s.rssMegabytes, 0) / xs.length;
  const firstMb = mean(settled);
  const lastMb = mean(last);
  return { firstMb, lastMb, growthPercent: ((lastMb - firstMb) / firstMb) * 100 };
}

export const MAX_MEMORY_GROWTH_PERCENT = 25;

export interface SoakInput {
  summary: K6Summary;
  tallies: EventTally[];
  samples: { atSeconds: number; rssMegabytes: number }[];
}

export function evaluateSoak(input: SoakInput): { checks: Check[]; outcomes: Outcomes; memory: ReturnType<typeof memoryGrowth> } {
  const { summary, tallies } = input;
  const outcomes = outcomesOf(summary);
  const sum = (pick: (t: EventTally) => number) => tallies.reduce((total, t) => total + pick(t), 0);
  const registeredNow = sum((t) => t.registered);
  const withdrawnRows = sum((t) => t.withdrawn);
  const memory = memoryGrowth(input.samples);
  const registerP95 = metricValue(summary, "register_ms", "p(95)");
  const readP95 = metricValue(summary, "read_ms", "p(95)");
  const checks = [
    check("no 5xx, 429 or timeouts on register", outcomes.rateLimited + outcomes.serverErrors + outcomes.otherStatus === 0, `429: ${outcomes.rateLimited}, 5xx: ${outcomes.serverErrors}, other: ${outcomes.otherStatus}`),
    check("every read answered 200", outcomes.readsFailed === 0, `${outcomes.readsOk} reads ok, ${outcomes.readsFailed} failed`),
    check("every withdrawal answered 200", outcomes.withdrawFailed === 0, `${outcomes.withdrawn} withdrawn, ${outcomes.withdrawFailed} failed`),
    check("every seat claimed has an active registration, and the reverse", sum((t) => t.mismatches) === 0, `${sum((t) => t.mismatches)} without a match`),
    check("registrations in the database match the 201s k6 saw", registeredNow + withdrawnRows === outcomes.registered, `${registeredNow} registered + ${withdrawnRows} withdrawn = ${registeredNow + withdrawnRows}, k6 saw ${outcomes.registered}`),
    check("withdrawals in the database match the 200s k6 saw", withdrawnRows === outcomes.withdrawn, `${withdrawnRows} withdrawn rows, k6 saw ${outcomes.withdrawn}`),
    check(`register p95 is at most ${SLO_REGISTER_P95_MS} ms`, registerP95 !== null && registerP95 <= SLO_REGISTER_P95_MS, `p95 ${registerP95?.toFixed(1) ?? "n/a"} ms`),
    check(`read p95 is at most ${SLO_READ_P95_MS} ms`, readP95 !== null && readP95 <= SLO_READ_P95_MS, `p95 ${readP95?.toFixed(1) ?? "n/a"} ms`),
    check(
      `resident memory grew by at most ${MAX_MEMORY_GROWTH_PERCENT}% from minute 1 to the last minute`,
      memory !== null && memory.growthPercent <= MAX_MEMORY_GROWTH_PERCENT,
      memory ? `${memory.firstMb.toFixed(0)} MB to ${memory.lastMb.toFixed(0)} MB (${memory.growthPercent.toFixed(1)}%)` : "not enough samples (the run is shorter than two minutes, or /proc is missing)",
    ),
  ];
  return { checks, outcomes, memory };
}

export interface StepResult {
  step: number;
  targetRate: number;
  requests: number;
  expectedRequests: number;
  failed: number;
  p95Ms: number | null;
  held: boolean;
}

/** How many requests a step should have sent: its hold at the target rate, and the ramp from the step before. */
export function expectedRequests(steps: number[], index: number, holdSeconds: number, rampSeconds: number): number {
  const rate = steps[index]!;
  const previous = index === 0 ? rate : steps[index - 1]!;
  return holdSeconds * rate + (rampSeconds * (previous + rate)) / 2;
}

export function stepResults(summary: K6Summary, steps: number[], holdSeconds: number, rampSeconds: number): StepResult[] {
  return steps.map((targetRate, index) => {
    const tag = `{step:s${index}}`;
    const requests = count(summary, `step_requests${tag}`);
    const failed = count(summary, `step_failed${tag}`);
    const p95Ms = metricValue(summary, `step_ms${tag}`, "p(95)");
    const expected = expectedRequests(steps, index, holdSeconds, rampSeconds);
    return {
      step: index,
      targetRate,
      requests,
      expectedRequests: expected,
      failed,
      p95Ms,
      held: p95Ms !== null && p95Ms <= SLO_REGISTER_P95_MS && failed === 0 && requests >= 0.9 * expected,
    };
  });
}

const requestsSent = (summary: K6Summary) => count(summary, "http_reqs");

export function evaluateStress(input: { summary: K6Summary; tally: EventTally; steps: number[]; holdSeconds: number; rampSeconds: number }) {
  const { tally } = input;
  const results = stepResults(input.summary, input.steps, input.holdSeconds, input.rampSeconds);
  const outcomes = outcomesOf(input.summary);
  const firstBroken = results.find((r) => !r.held) ?? null;
  // The sustainable rate is the highest step before the first one that broke.
  const heldBeforeBreak = results.slice(0, firstBroken ? firstBroken.step : results.length).filter((r) => r.held);
  const sustainable = heldBeforeBreak.length > 0 ? heldBeforeBreak[heldBeforeBreak.length - 1]! : null;
  const checks = [
    check("no seat is held twice", tally.distinctSeatsHeld === tally.registered, `${tally.distinctSeatsHeld} distinct seats in ${tally.registered} registrations`),
    check("no attendee holds two seats", tally.distinctAttendees === tally.registered, `${tally.distinctAttendees} distinct attendees in ${tally.registered} registrations`),
    check("registrations equal claimed seats", tally.registered === tally.claimedSeats && tally.mismatches === 0, `${tally.registered} registered, ${tally.claimedSeats} claimed, ${tally.mismatches} unmatched`),
    check("no over-admission", tally.registered <= tally.seats, `${tally.registered} registered, ${tally.seats} seats`),
    // A request k6 gave up on (a timeout counts as "other") can still commit afterwards, so the database may hold more than k6 saw, but never fewer, and by no more than the requests k6 lost.
    check(
      "every 201 k6 saw is a registration in the database",
      tally.registered >= outcomes.registered && tally.registered - outcomes.registered <= outcomes.otherStatus,
      `k6 saw ${outcomes.registered}, the database holds ${tally.registered}, ${outcomes.otherStatus} requests were lost to timeouts`,
    ),
    check("the run measured something", requestsSent(input.summary) > 0 && tally.registered > 0, `${requestsSent(input.summary)} requests, ${tally.registered} registrations`),
  ];
  return { checks, results, outcomes, sustainable, firstBroken };
}
