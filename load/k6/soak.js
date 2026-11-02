import exec from "k6/execution";
import { sleep } from "k6";
import { read, register, summaryTo, attendeeToken, withdraw } from "./lib/common.js";

/**
 * EN-18 soak: a steady mixed load, as the architecture's load model has it (section 6): mostly browsing,
 * a steady trickle of registrations that are then withdrawn (so seats go round and round), and attendees
 * looking at their own registrations. Browsing carries a Supabase-signed token (BROWSE_TOKEN, from the
 * fake auth); the rest carry the identity stand-in's.
 */
const EVENT_IDS = (__ENV.EVENT_IDS || "").split(",").filter(Boolean);
const BROWSE_TOKEN = __ENV.BROWSE_TOKEN || "";

export const options = {
  scenarios: {
    soak: {
      executor: "constant-arrival-rate",
      rate: Number(__ENV.RATE || 100),
      timeUnit: "1s",
      duration: __ENV.DURATION || "5m",
      preAllocatedVUs: Number(__ENV.PRE_VUS || 200),
      maxVUs: Number(__ENV.MAX_VUS || 1000),
    },
  },
  thresholds: {
    register_ms: ["p(95)<800"],
    read_ms: ["p(95)<400"],
    r_5xx: ["count==0"],
    r_429: ["count==0"],
    r_other: ["count==0"],
    read_other: ["count==0"],
    w_other: ["count==0"],
  },
  summaryTrendStats: ["avg", "min", "med", "max", "p(90)", "p(95)", "p(99)"],
};

export default function () {
  const n = exec.scenario.iterationInTest;
  const eventId = EVENT_IDS[n % EVENT_IDS.length];
  const pick = n % 10;
  if (pick < 5) {
    read("/api/v1/open-events?limit=25", BROWSE_TOKEN, "browse");
  } else if (pick < 7) {
    read(`/api/v1/open-events/${eventId}`, BROWSE_TOKEN, "event-page");
  } else if (pick < 8) {
    read("/api/v1/registrations", attendeeToken(n), "my-registrations");
  } else {
    const res = register(n, eventId);
    if (res.status === 201) {
      sleep(0.2);
      withdraw(n, res.json("id"));
    }
  }
}

export function handleSummary(data) {
  return summaryTo(data, "soak");
}
