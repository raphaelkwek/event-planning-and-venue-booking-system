import exec from "k6/execution";
import { Counter, Trend } from "k6/metrics";
import { register, summaryTo } from "./shared/common.js";

/**
 * EN-18 stress: the arrival rate steps up, holding each step for HOLD seconds, until something gives.
 * Every request carries its step as a tag, so the summary has latency and failures per step and the
 * harness can name the last step that held the objective. The event has far more seats than attempts,
 * so every attempt is a real seat claim.
 */
const STEPS = (__ENV.STEPS || "100,250,500,750,1000,1500,2000").split(",").map(Number);
const HOLD = Number(__ENV.HOLD_SECONDS || 30);
const RAMP = 5;
const stepRequests = new Counter("step_requests");
const stepFailed = new Counter("step_failed");
const stepMs = new Trend("step_ms", true);

const stages = [];
for (const rate of STEPS) {
  stages.push({ target: rate, duration: `${RAMP}s` });
  stages.push({ target: rate, duration: `${HOLD}s` });
}

const thresholds = {};
STEPS.forEach((_, i) => {
  thresholds[`step_ms{step:s${i}}`] = ["p(95)<800"];
  thresholds[`step_requests{step:s${i}}`] = ["count>=0"];
  thresholds[`step_failed{step:s${i}}`] = ["count>=0"];
});

export const options = {
  scenarios: {
    stress: {
      executor: "ramping-arrival-rate",
      startRate: STEPS[0],
      timeUnit: "1s",
      stages,
      preAllocatedVUs: Number(__ENV.PRE_VUS || 300),
      maxVUs: Number(__ENV.MAX_VUS || 4000),
    },
  },
  thresholds,
  summaryTrendStats: ["avg", "min", "med", "max", "p(90)", "p(95)", "p(99)"],
};

export default function () {
  const elapsedSeconds = exec.instance.currentTestRunDuration / 1000;
  const step = Math.min(STEPS.length - 1, Math.floor(elapsedSeconds / (RAMP + HOLD)));
  const tags = { step: `s${step}` };
  const res = register(exec.scenario.iterationInTest, __ENV.EVENT_ID, tags);
  stepRequests.add(1, tags);
  stepMs.add(res.timings.duration, tags);
  if (res.status !== 201) stepFailed.add(1, tags);
}

export function handleSummary(data) {
  return summaryTo(data, "stress");
}
