import http from "k6/http";
import { Counter, Trend } from "k6/metrics";

/**
 * What every k6 scenario shares (EN-18, EN-20): the base address, the attendee tokens the identity
 * stand-in understands, the register and withdraw calls, and the tally of what came back. The
 * counters are what the harness checks against the database, so every response lands in exactly one.
 */

export const BASE_URL = __ENV.BASE_URL || "http://127.0.0.1:8092";
const JSON_HEADERS = { "Content-Type": "application/json" };

export const registered201 = new Counter("r_201");
export const refusedFull = new Counter("r_409_full");
export const refusedOther409 = new Counter("r_409_other");
export const refused422 = new Counter("r_422");
export const rateLimited429 = new Counter("r_429");
export const serverError5xx = new Counter("r_5xx");
export const otherStatus = new Counter("r_other");
export const withdrawn200 = new Counter("w_200");
export const withdrawOther = new Counter("w_other");
export const readOk = new Counter("read_200");
export const readOther = new Counter("read_other");

export const registerMs = new Trend("register_ms", true);
export const register201Ms = new Trend("register_201_ms", true);
export const registerRefusedMs = new Trend("register_refused_ms", true);
export const withdrawMs = new Trend("withdraw_ms", true);
export const readMs = new Trend("read_ms", true);

export const attendeeToken = (n) => `load-attendee-${n}`;

/** Registers attendee n for the event; counts the answer; returns the response. */
export function register(n, eventId, tags = {}) {
  const res = http.post(`${BASE_URL}/api/v1/registrations`, JSON.stringify({ eventId }), {
    headers: { ...JSON_HEADERS, Authorization: `Bearer ${attendeeToken(n)}` },
    tags: { name: "register", ...tags },
    timeout: "30s",
  });
  registerMs.add(res.timings.duration, tags);
  if (res.status === 201) {
    registered201.add(1);
    register201Ms.add(res.timings.duration, tags);
    return res;
  }
  registerRefusedMs.add(res.timings.duration, tags);
  if (res.status === 409) {
    if (typeof res.body === "string" && res.body.includes("REGISTRATION_FULL")) refusedFull.add(1);
    else refusedOther409.add(1);
  } else if (res.status === 422) refused422.add(1);
  else if (res.status === 429) rateLimited429.add(1);
  else if (res.status >= 500) serverError5xx.add(1);
  else otherStatus.add(1); // 0 is a timeout or a refused connection
  return res;
}

export function withdraw(n, registrationId) {
  const res = http.post(`${BASE_URL}/api/v1/registrations/${registrationId}/withdrawal`, null, {
    headers: { Authorization: `Bearer ${attendeeToken(n)}` },
    tags: { name: "withdraw" },
    timeout: "30s",
  });
  withdrawMs.add(res.timings.duration);
  if (res.status === 200) withdrawn200.add(1);
  else withdrawOther.add(1);
  return res;
}

/** A read with a bearer token; counted as ok only when it answered 200. */
export function read(path, token, name) {
  const res = http.get(`${BASE_URL}${path}`, { headers: { Authorization: `Bearer ${token}` }, tags: { name }, timeout: "30s" });
  readMs.add(res.timings.duration);
  if (res.status === 200) readOk.add(1);
  else readOther.add(1);
  return res;
}

/** Writes the summary where the harness reads it, and says in plain text what ran. */
export function summaryTo(data, scenario) {
  const out = __ENV.SUMMARY_FILE || "/out/k6-summary.json";
  const m = (name, key) => (data.metrics[name] && data.metrics[name].values[key]) ?? "n/a";
  const text =
    `\n${scenario}: ${m("http_reqs", "count")} requests, ${Number(m("http_reqs", "rate")).toFixed(1)}/s, ` +
    `register p95 ${Number(m("register_ms", "p(95)")).toFixed(1)} ms, ` +
    `201: ${m("r_201", "count")}, full: ${m("r_409_full", "count")}\n`;
  return { [out]: JSON.stringify(data, null, 2), stdout: text };
}
