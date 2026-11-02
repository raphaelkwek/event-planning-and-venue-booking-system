import exec from "k6/execution";
import { register, summaryTo } from "./lib/common.js";

/**
 * EN-20 experiment 3: a burst of register attempts from distinct attendees, a fixed number of them in
 * flight at a time, while the database connection is slow. A closed model (VUs, not an arrival rate), so a
 * slow database makes the burst take longer instead of piling up unbounded requests.
 */
export const options = {
  scenarios: {
    burst: {
      executor: "shared-iterations",
      vus: Number(__ENV.VUS || 100),
      iterations: Number(__ENV.ITERATIONS || 600),
      maxDuration: __ENV.MAX_DURATION || "3m",
    },
  },
  summaryTrendStats: ["avg", "min", "med", "max", "p(90)", "p(95)", "p(99)"],
};

export default function () {
  register(exec.scenario.iterationInTest, __ENV.EVENT_ID);
}

export function handleSummary(data) {
  return summaryTo(data, "burst");
}
