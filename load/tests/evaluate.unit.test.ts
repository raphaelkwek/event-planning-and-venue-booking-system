import { describe, expect, it } from "vitest";
import {
  evaluateSoak,
  evaluateSpike,
  evaluateStress,
  expectedRequests,
  memoryGrowth,
  metricValue,
  outcomesOf,
  seatChecks,
  stepResults,
  type K6Summary,
} from "../support/evaluate.js";
import type { EventTally } from "../support/seed.js";

/**
 * EN-18: the harness's verdicts. They decide whether a load run passed, so they are tested like the
 * domain rules: a run that over-admits, drops a response or hides a failure must fail.
 */

const counter = (count: number) => ({ type: "counter", values: { count, rate: count / 10 } });
const trend = (p95: number) => ({ type: "trend", values: { "p(95)": p95, avg: p95 / 2 } });

function summary(values: Record<string, number>, trends: Record<string, number> = {}): K6Summary {
  const metrics: K6Summary["metrics"] = {};
  for (const [name, count] of Object.entries(values)) metrics[name] = counter(count);
  for (const [name, p95] of Object.entries(trends)) metrics[name] = trend(p95);
  return { metrics };
}

const tally = (over: Partial<EventTally> = {}): EventTally => ({
  eventId: "e",
  seats: 100,
  claimedSeats: 100,
  freeSeats: 0,
  registered: 100,
  withdrawn: 0,
  distinctAttendees: 100,
  distinctSeatsHeld: 100,
  mismatches: 0,
  outboxRows: 100,
  ...over,
});

const goodSpike = () =>
  summary({ r_201: 100, r_409_full: 4900, http_reqs: 5000, dropped_iterations: 0 }, { register_ms: 120, register_201_ms: 180, register_refused_ms: 110 });

describe("metricValue and outcomesOf (EN-18-T2)", () => {
  it("reads a value, and null for a metric or key k6 did not report", () => {
    const s = goodSpike();
    expect(metricValue(s, "r_201", "count")).toBe(100);
    expect(metricValue(s, "nope", "count")).toBeNull();
    expect(metricValue(s, "r_201", "p(95)")).toBeNull();
  });

  it("tallies every kind of response, counting a missing metric as zero", () => {
    const o = outcomesOf(summary({ r_201: 3, r_409_full: 4, r_409_other: 5, r_422: 6, r_429: 7, r_5xx: 8, r_other: 9, w_200: 1, w_other: 2, read_200: 10, read_other: 11 }));
    expect(o).toEqual({ registered: 3, full: 4, otherConflict: 5, outsideWindow: 6, rateLimited: 7, serverErrors: 8, otherStatus: 9, withdrawn: 1, withdrawFailed: 2, readsOk: 10, readsFailed: 11 });
    expect(outcomesOf(summary({})).registered).toBe(0);
  });
});

describe("seatChecks (EN-18-T1, T2)", () => {
  it("holds when exactly the seats are registered, claimed and matched", () => {
    expect(seatChecks(tally(), 100).every((c) => c.ok)).toBe(true);
  });

  it.each<[string, Partial<EventTally>]>([
    ["one registration too few", { registered: 99, distinctAttendees: 99, distinctSeatsHeld: 99, outboxRows: 99 }],
    ["over-admission", { registered: 101, distinctAttendees: 101, distinctSeatsHeld: 101, outboxRows: 101 }],
    ["a seat claimed twice", { distinctSeatsHeld: 99 }],
    ["an attendee registered twice", { distinctAttendees: 99 }],
    ["a seat claimed with no registration", { mismatches: 1 }],
    ["a registration with no message in the outbox", { outboxRows: 99 }],
    ["a seat left unclaimed", { claimedSeats: 99 }],
  ])("fails on %s", (_name, over) => {
    expect(seatChecks(tally(over), 100).some((c) => !c.ok)).toBe(true);
  });
});

describe("evaluateSpike (EN-18-T1, T2, T3, T4)", () => {
  const run = (s: K6Summary, t = tally(), enforceSlo = false) => evaluateSpike({ summary: s, tally: t, seats: 100, targetRate: 500, enforceSlo });

  it("passes a clean spike: 100 registered, the rest refused full, and says whether the rate was held", () => {
    const { checks, figures } = run(summary({ r_201: 100, r_409_full: 4900, http_reqs: 5000, dropped_iterations: 0 }, { register_ms: 120, register_201_ms: 180, register_refused_ms: 110 }));
    expect(checks.every((c) => c.ok)).toBe(true);
    expect(figures.p95AllMs).toBe(120);
    expect(figures.sloMet).toBe(true);
    expect(figures.droppedIterations).toBe(0);
  });

  it("reports a rate that was not sustained, without failing the invariants", () => {
    const s = summary({ r_201: 100, r_409_full: 2900, http_reqs: 3000, dropped_iterations: 1900 }, { register_ms: 400 });
    s.metrics.http_reqs = { type: "counter", values: { count: 3000, rate: 300 } };
    const { checks, figures } = run(s);
    expect(checks.every((c) => c.ok)).toBe(true);
    expect(figures.rateSustained).toBe(false);
    expect(figures.achievedRate).toBe(300);
  });

  it("treats a rate within 95% of the target, with nothing dropped, as sustained", () => {
    const s = goodSpike();
    s.metrics.http_reqs = { type: "counter", values: { count: 5000, rate: 480 } };
    expect(run(s).figures.rateSustained).toBe(true);
  });

  it("fails when any attempt was rate-limited, errored or timed out instead of refused full", () => {
    for (const bad of ["r_429", "r_5xx", "r_other", "r_409_other", "r_422"]) {
      const { checks } = run(summary({ r_201: 100, r_409_full: 4899, [bad]: 1, http_reqs: 5000 }, { register_ms: 100 }));
      expect(checks.some((c) => !c.ok), bad).toBe(true);
    }
  });

  it("fails when k6 saw a different number of 201s from the registrations in the database", () => {
    const { checks } = run(summary({ r_201: 99, r_409_full: 4900, http_reqs: 4999 }, { register_ms: 100 }));
    expect(checks.find((c) => c.name.startsWith("k6 saw exactly"))?.ok).toBe(false);
  });

  it("fails when there were no more attempts than seats, because nothing was tested", () => {
    const { checks } = run(summary({ r_201: 100, r_409_full: 0, http_reqs: 100 }, { register_ms: 50 }));
    expect(checks.find((c) => c.name.startsWith("more attempts"))?.ok).toBe(false);
  });

  it("enforces the 800 ms objective only when asked to", () => {
    const slow = summary({ r_201: 100, r_409_full: 4900, http_reqs: 5000 }, { register_ms: 801 });
    expect(run(slow, tally(), false).checks.every((c) => c.ok)).toBe(true);
    expect(run(slow, tally(), true).checks.some((c) => !c.ok)).toBe(true);
    const fast = summary({ r_201: 100, r_409_full: 4900, http_reqs: 5000 }, { register_ms: 800 });
    expect(run(fast, tally(), true).checks.every((c) => c.ok)).toBe(true);
  });

  it("says the objective was not measured when k6 reported no register latency", () => {
    expect(run(summary({ r_201: 100, r_409_full: 4900, http_reqs: 5000 })).figures.sloMet).toBeNull();
  });
});

describe("memoryGrowth (EN-18-T5)", () => {
  const at = (atSeconds: number, rssMegabytes: number) => ({ atSeconds, rssMegabytes });

  it("compares the last minute with the second minute", () => {
    const samples = [at(0, 90), at(30, 100), at(65, 100), at(100, 100), at(150, 110), at(200, 110), at(250, 110), at(300, 110)];
    const growth = memoryGrowth(samples)!;
    expect(growth.firstMb).toBe(100);
    expect(growth.lastMb).toBe(110);
    expect(growth.growthPercent).toBeCloseTo(10);
  });

  it("gives null when there are too few samples or none in the windows", () => {
    expect(memoryGrowth([])).toBeNull();
    expect(memoryGrowth([at(0, 1)])).toBeNull();
    expect(memoryGrowth([at(0, 1), at(30, 1)])).toBeNull();
  });
});

describe("evaluateSoak (EN-18-T5)", () => {
  const samples = [at(0, 90), at(65, 100), at(100, 100), at(250, 105), at(300, 105)];
  function at(atSeconds: number, rssMegabytes: number) {
    return { atSeconds, rssMegabytes };
  }
  const good = () =>
    summary({ r_201: 50, w_200: 50, read_200: 400 }, { register_ms: 60, read_ms: 20 });
  const settled = (over: Partial<EventTally> = {}) => tally({ seats: 3000, claimedSeats: 0, freeSeats: 3000, registered: 0, withdrawn: 50, distinctAttendees: 0, distinctSeatsHeld: 0, outboxRows: 100, ...over });

  it("passes when everything registered was withdrawn, the seats match and nothing grew", () => {
    const { checks } = evaluateSoak({ summary: good(), tallies: [settled()], samples });
    expect(checks.filter((c) => !c.ok)).toEqual([]);
  });

  it("fails on a ghost seat, a missing withdrawal, slow reads, a failed read or runaway memory", () => {
    const run = (s: K6Summary, t = settled(), m = samples) => evaluateSoak({ summary: s, tallies: [t], samples: m }).checks.some((c) => !c.ok);
    expect(run(good(), settled({ mismatches: 1 }))).toBe(true);
    expect(run(good(), settled({ withdrawn: 49 }))).toBe(true);
    expect(run(summary({ r_201: 50, w_200: 50, read_200: 400 }, { register_ms: 60, read_ms: 401 }))).toBe(true);
    expect(run(summary({ r_201: 50, w_200: 50, read_200: 399, read_other: 1 }, { register_ms: 60, read_ms: 20 }))).toBe(true);
    expect(run(good(), settled(), [at(0, 90), at(65, 100), at(100, 100), at(250, 130), at(300, 130)])).toBe(true);
    expect(run(summary({ r_201: 50, w_200: 50, read_200: 400, r_5xx: 1 }, { register_ms: 60, read_ms: 20 }))).toBe(true);
  });

  it("does not pass the memory check on a run too short to judge", () => {
    const { checks } = evaluateSoak({ summary: good(), tallies: [settled()], samples: [at(0, 90), at(10, 90)] });
    expect(checks.find((c) => c.name.startsWith("resident memory"))?.ok).toBe(false);
  });
});

describe("evaluateStress (EN-18-T6)", () => {
  const STEPS = [100, 250, 500];
  const HOLD = 30;
  const RAMP = 5;

  function stressSummary(perStep: Array<{ requests: number; failed: number; p95: number }>) {
    const metrics: K6Summary["metrics"] = { r_201: counter(perStep.reduce((n, s) => n + s.requests - s.failed, 0)), http_reqs: counter(perStep.reduce((n, s) => n + s.requests, 0)) };
    perStep.forEach((s, i) => {
      metrics[`step_requests{step:s${i}}`] = counter(s.requests);
      metrics[`step_failed{step:s${i}}`] = counter(s.failed);
      metrics[`step_ms{step:s${i}}`] = trend(s.p95);
    });
    return { metrics } as K6Summary;
  }

  it("works out what a step should have sent, counting the ramp from the step before", () => {
    expect(expectedRequests(STEPS, 0, HOLD, RAMP)).toBe(3000 + 500);
    expect(expectedRequests(STEPS, 1, HOLD, RAMP)).toBe(7500 + 875);
  });

  it("names the highest step that held before the first that broke", () => {
    const s = stressSummary([
      { requests: 3500, failed: 0, p95: 40 },
      { requests: 8400, failed: 0, p95: 90 },
      { requests: 9000, failed: 0, p95: 2000 },
    ]);
    const results = stepResults(s, STEPS, HOLD, RAMP);
    expect(results.map((r) => r.held)).toEqual([true, true, false]);
    const evaluated = evaluateStress({ summary: s, tally: tally({ seats: 250_000, claimedSeats: 20900, registered: 20900, distinctAttendees: 20900, distinctSeatsHeld: 20900 }), steps: STEPS, holdSeconds: HOLD, rampSeconds: RAMP });
    expect(evaluated.sustainable?.targetRate).toBe(250);
    expect(evaluated.firstBroken?.targetRate).toBe(500);
    expect(evaluated.checks.every((c) => c.ok)).toBe(true);
  });

  it("calls a step broken when it sent too little, or any request failed, and holds none when the first breaks", () => {
    const s = stressSummary([
      { requests: 1000, failed: 0, p95: 40 },
      { requests: 8400, failed: 1, p95: 90 },
      { requests: 9000, failed: 0, p95: 90 },
    ]);
    const evaluated = evaluateStress({ summary: s, tally: tally({ seats: 250_000, claimedSeats: 18399, registered: 18399, distinctAttendees: 18399, distinctSeatsHeld: 18399 }), steps: STEPS, holdSeconds: HOLD, rampSeconds: RAMP });
    expect(evaluated.sustainable).toBeNull();
    expect(evaluated.firstBroken?.targetRate).toBe(100);
  });

  it("holds a step with no latency reading as not held, and the top step held when none broke", () => {
    const s = stressSummary([{ requests: 3500, failed: 0, p95: 40 }]);
    s.metrics["step_ms{step:s0}"] = undefined;
    expect(stepResults(s, [100], HOLD, RAMP)[0]!.held).toBe(false);
    const ok = stressSummary([{ requests: 3500, failed: 0, p95: 40 }]);
    const evaluated = evaluateStress({ summary: ok, tally: tally({ seats: 250_000, claimedSeats: 3500, registered: 3500, distinctAttendees: 3500, distinctSeatsHeld: 3500 }), steps: [100], holdSeconds: HOLD, rampSeconds: RAMP });
    expect(evaluated.firstBroken).toBeNull();
    expect(evaluated.sustainable?.targetRate).toBe(100);
  });

  it("fails when a seat is held twice or the database disagrees with k6", () => {
    const s = stressSummary([{ requests: 3500, failed: 0, p95: 40 }]);
    const bad = evaluateStress({ summary: s, tally: tally({ seats: 250_000, claimedSeats: 3500, registered: 3500, distinctAttendees: 3500, distinctSeatsHeld: 3499 }), steps: [100], holdSeconds: HOLD, rampSeconds: RAMP });
    expect(bad.checks.some((c) => !c.ok)).toBe(true);
    const mismatch = evaluateStress({ summary: s, tally: tally({ seats: 250_000, claimedSeats: 3400, registered: 3400, distinctAttendees: 3400, distinctSeatsHeld: 3400 }), steps: [100], holdSeconds: HOLD, rampSeconds: RAMP });
    expect(mismatch.checks.find((c) => c.name.startsWith("every 201"))?.ok).toBe(false);
  });

  it("allows the database to hold more than k6 saw only by the requests k6 lost to timeouts", () => {
    const s = stressSummary([{ requests: 3500, failed: 0, p95: 40 }]);
    s.metrics.r_other = counter(2);
    const run = (registered: number) =>
      evaluateStress({ summary: s, tally: tally({ seats: 250_000, claimedSeats: registered, registered, distinctAttendees: registered, distinctSeatsHeld: registered }), steps: [100], holdSeconds: HOLD, rampSeconds: RAMP }).checks.find((c) => c.name.startsWith("every 201"))!.ok;
    expect(run(3500)).toBe(true);
    expect(run(3502)).toBe(true);
    expect(run(3503)).toBe(false);
  });

  it("does not pass a run that sent nothing or registered no one", () => {
    const empty = evaluateStress({ summary: { metrics: {} }, tally: tally({ seats: 250_000, claimedSeats: 0, registered: 0, distinctAttendees: 0, distinctSeatsHeld: 0 }), steps: [100], holdSeconds: HOLD, rampSeconds: RAMP });
    expect(empty.checks.find((c) => c.name === "the run measured something")?.ok).toBe(false);
  });
});
