import exec from "k6/execution";
import { register, summaryTo } from "./shared/common.js";

/**
 * EN-18 spike (and the smoke run on every pull request, with a smaller RATE): a constant arrival rate
 * of register attempts, each from a different attendee, against one event. The harness knows how many
 * seats the event has; this script only counts what came back.
 *
 * The thresholds are only set for the smoke run (SLO_ENFORCE=1). The spike reports its p95 against
 * the 800 ms objective without failing on it, because a shared CI runner is not the production cluster.
 */
const RATE = Number(__ENV.RATE || 500);
const enforce = __ENV.SLO_ENFORCE === "1";

export const options = {
  scenarios: {
    spike: {
      executor: "constant-arrival-rate",
      rate: RATE,
      timeUnit: "1s",
      duration: __ENV.DURATION || "10s",
      preAllocatedVUs: Number(__ENV.PRE_VUS || 300),
      maxVUs: Number(__ENV.MAX_VUS || 3000),
    },
  },
  thresholds: enforce ? { register_ms: ["p(95)<800"], r_5xx: ["count==0"], r_429: ["count==0"], r_other: ["count==0"] } : {},
  summaryTrendStats: ["avg", "min", "med", "max", "p(90)", "p(95)", "p(99)"],
};

export default function () {
  register(exec.scenario.iterationInTest, __ENV.EVENT_ID);
}

export function handleSummary(data) {
  return summaryTo(data, "spike");
}
