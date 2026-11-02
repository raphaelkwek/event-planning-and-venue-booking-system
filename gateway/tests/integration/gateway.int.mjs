import { connect } from "node:net";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import assert from "node:assert/strict";

/**
 * EN-12 integration cards (T2, T3, T5 to T11), against the stack the Gateway workflow starts: a
 * throwaway Postgres built by `npm run migrate:all`, Redis, a fake JWKS server, planning-core,
 * notification, the registration service, the CI echo upstream, and TWO Kong 3.9 containers
 * (A and B) that share the Redis. Run by `.github/workflows/gateway.yml`; documentation/gateway.md
 * lists the environment variables. Nothing here touches a shared database or Supabase project.
 *
 * The workflow renders the configuration with a staff limit of STAFF_LIMIT and a public limit of
 * PUBLIC_LIMIT a minute so a test can cross them; the committed 300 and 600 are checked in the file
 * (gateway/tests/kongConfig.test.mjs).
 */

const A = process.env.KONG_A ?? "http://127.0.0.1:8000";
const B = process.env.KONG_B ?? "http://127.0.0.1:8100";
const JWKS = process.env.JWKS_URL ?? "http://127.0.0.1:9999";
const REDIS = process.env.REDIS_ADDRESS ?? "127.0.0.1:6379";
const STAFF_LIMIT = Number(process.env.STAFF_LIMIT ?? 15);
const PUBLIC_LIMIT = Number(process.env.PUBLIC_LIMIT ?? 20);

/** The seeded accounts' Supabase user ids (backend/services/planning-core/migrations/identity/seed). */
const ORGANISER = "10000000-0000-0000-0000-000000000001";
const ATTENDEE = "10000000-0000-0000-0000-000000000005";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TRACEPARENT = /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/;

async function token(sub, options = {}) {
  const response = await fetch(`${JWKS}/ci/token`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sub, ...options }),
  });
  assert.equal(response.status, 200, "the fake JWKS server signs a token");
  return (await response.json()).access_token;
}

async function call(base, path, { method = "GET", bearer, headers = {}, body } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    redirect: "manual",
    headers: { ...(bearer ? { authorization: `Bearer ${bearer}` } : {}), ...(body ? { "content-type": "application/json" } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // Not JSON: Kong's and the services' refusals are; a bare 404 may not be.
  }
  return { status: response.status, headers: response.headers, json, text };
}

/** Kong adds this header only when an upstream answered, so its absence means Kong itself refused. */
const reachedUpstream = (res) => res.headers.has("x-kong-upstream-latency");

function flushRedis() {
  const [host, port] = REDIS.split(":");
  return new Promise((resolve, reject) => {
    const socket = connect(Number(port), host, () => socket.write("*1\r\n$8\r\nFLUSHALL\r\n"));
    socket.once("data", (data) => {
      socket.end();
      if (data.toString().startsWith("+OK")) resolve();
      else reject(new Error(`FLUSHALL answered ${data}`));
    });
    socket.once("error", reject);
  });
}

/** Rate-limit windows are whole minutes, so start a limit test early in one, with the counts empty. */
async function freshMinute() {
  const seconds = new Date().getSeconds();
  if (seconds > 35) await new Promise((resolve) => setTimeout(resolve, (61 - seconds) * 1000));
  await flushRedis();
}

test("EN-12-T2 routes each prefix to its own upstream with the prefix stripped", async () => {
  const organiser = await token(ORGANISER);
  const attendee = await token(ATTENDEE);

  const me = await call(A, "/identity/api/v1/users/me", { bearer: organiser });
  assert.equal(me.status, 200, me.text);
  assert.equal(me.json.role, "EVENT_ORGANISER", "planning-core's identity module answered");
  assert.ok(reachedUpstream(me));

  const events = await call(A, "/event/api/v1/events", { bearer: organiser });
  assert.equal(events.status, 200, events.text);
  assert.ok(typeof events.json === "object" && events.json !== null && reachedUpstream(events));

  const venues = await call(A, "/venue/api/v1/venues", { bearer: organiser });
  assert.ok(reachedUpstream(venues), `venue module answered ${venues.status}`);
  const equipment = await call(A, "/equipment/api/v1/equipment-types", { bearer: organiser });
  assert.ok(reachedUpstream(equipment), `equipment module answered ${equipment.status}`);

  const notifications = await call(A, "/notification/api/v1/notifications", { bearer: attendee });
  assert.equal(notifications.status, 200, notifications.text);
  assert.ok(reachedUpstream(notifications));

  const open = await call(A, "/registration/api/v1/open-events", { bearer: attendee });
  assert.equal(open.status, 200, open.text);
  assert.ok(Array.isArray(open.json.items) && "nextCursor" in open.json, "the registration service's page shape");
  const mine = await call(A, "/registration/api/v1/registrations", { bearer: attendee });
  assert.equal(mine.status, 200, mine.text);
  assert.ok(Array.isArray(mine.json.items));
});

test("EN-12-T3 refuses no token, a malformed token, a wrong key, an expired token and an unknown key id, and lets a valid token through", async () => {
  const path = "/event/api/v1/events";
  const refusals = {
    "no token": {},
    "malformed token": { bearer: "not-a-token" },
    "wrong signature": { bearer: await token(ORGANISER, { key: "forged" }) },
    "expired token": { bearer: await token(ORGANISER, { expiresInSeconds: -120 }) },
    "unknown key id": { bearer: await token(ORGANISER, { key: "stranger" }) },
  };
  for (const [name, request] of Object.entries(refusals)) {
    const res = await call(A, path, request);
    assert.equal(res.status, 401, `${name}: ${res.text}`);
    assert.ok(typeof res.json?.message === "string" && res.json.error === undefined, `${name}: Kong's own refusal, not planning-core's envelope`);
    assert.ok(!reachedUpstream(res), `${name}: planning-core was not reached`);
  }
  const ok = await call(A, path, { bearer: await token(ORGANISER) });
  assert.equal(ok.status, 200, ok.text);
  assert.ok(reachedUpstream(ok));
  // The second instance holds the same credentials.
  assert.equal((await call(B, path, { bearer: await token(ORGANISER, { key: "forged" }) })).status, 401);
  assert.equal((await call(B, path, { bearer: await token(ORGANISER) })).status, 200);
});

test("EN-12-T5 keeps staff and public routes apart and exposes no health endpoint", async () => {
  const attendee = await token(ATTENDEE);

  // A staff path under the public prefix is the registration service's to refuse; planning-core is not behind it.
  const stray = await call(A, "/registration/api/v1/venues", { bearer: attendee });
  assert.equal(stray.status, 404);
  assert.ok(reachedUpstream(stray), "the registration service answered");
  const staffViaPublic = await call(A, "/registration/api/v1/events", { bearer: attendee });
  assert.equal(staffViaPublic.status, 404);

  for (const path of ["/healthz", "/readyz", "/registration/healthz", "/registration/readyz", "/event/healthz", "/identity/readyz", "/notification/healthz", "/venue/metrics", "/nowhere", "/"]) {
    for (const base of [A, B]) {
      const res = await call(base, path, { bearer: attendee });
      assert.equal(res.status, 404, `${path} on ${base}`);
      assert.ok(!reachedUpstream(res), `${path}: Kong refused it, no service was asked`);
      assert.match(res.json?.message ?? "", /no Route matched/i);
    }
  }

  // Sign-in has no token yet, so it is public: it reaches planning-core, which refuses the empty body itself.
  const login = await call(A, "/identity/api/v1/auth/login", { method: "POST", body: {} });
  assert.equal(login.status, 400, login.text);
  assert.equal(login.json.error.code, "VALIDATION_FAILED");
  assert.ok(reachedUpstream(login));
  // Every other identity path is staff: no token, no entry.
  const users = await call(A, "/identity/api/v1/users/me");
  assert.equal(users.status, 401);
  assert.ok(!reachedUpstream(users));

  // The public service checks the token itself, so a missing one is refused by the registration service.
  const open = await call(A, "/registration/api/v1/open-events");
  assert.equal(open.status, 401);
  assert.equal(open.json.error.code, "UNAUTHENTICATED", "the service's envelope, so it was reached");
  assert.ok(reachedUpstream(open));
});

test("EN-12-T6 limits a public route per address and answers 429 with Retry-After", async () => {
  await freshMinute();
  for (let i = 1; i <= PUBLIC_LIMIT; i += 1) {
    const res = await call(A, "/identity/api/v1/auth/login", { method: "POST", body: {} });
    assert.equal(res.status, 400, `request ${i} of ${PUBLIC_LIMIT} is answered by planning-core`);
  }
  const refused = await call(A, "/identity/api/v1/auth/login", { method: "POST", body: {} });
  assert.equal(refused.status, 429, refused.text);
  assert.ok(!reachedUpstream(refused), "refused by Kong, before planning-core");
  const retryAfter = refused.headers.get("retry-after");
  assert.match(retryAfter ?? "", /^\d+$/, "Retry-After is a whole number of seconds");
  assert.ok(Number(retryAfter) >= 1 && Number(retryAfter) <= 60, `Retry-After ${retryAfter}`);
  assert.ok(typeof refused.json.message === "string");
});

test("EN-12-T7 shares one count between two Kong instances through Redis", async () => {
  // The registration route, so the services' own sign-in limiter (30 a minute) does not meet T6's requests.
  const path = "/registration/api/v1/open-events";
  await freshMinute();
  const served = { A: 0, B: 0 };
  for (let i = 0; i < PUBLIC_LIMIT; i += 1) {
    const name = i % 2 === 0 ? "A" : "B";
    const res = await call(name === "A" ? A : B, path);
    assert.equal(res.status, 401, `request ${i + 1} on ${name} reaches the registration service, which wants a token`);
    served[name] += 1;
  }
  assert.deepEqual(served, { A: PUBLIC_LIMIT / 2, B: PUBLIC_LIMIT / 2 }, "each instance alone was under the limit");
  const first = await call(A, path);
  const second = await call(B, path);
  assert.equal(first.status, 429, "the count includes what B served");
  assert.equal(second.status, 429, "and the count includes what A served");
  assert.ok(first.headers.get("retry-after") && second.headers.get("retry-after"));
  assert.ok(!reachedUpstream(first) && !reachedUpstream(second));
});

test("EN-12-T8 limits a staff route per user, not per address", async () => {
  await freshMinute();
  const userA = await token(randomUUID());
  const userB = await token(randomUUID());
  for (let i = 1; i <= STAFF_LIMIT; i += 1) {
    const res = await call(i % 2 === 0 ? B : A, "/identity/api/v1/users/me", { bearer: userA });
    assert.notEqual(res.status, 429, `request ${i} of user A`);
    assert.ok(reachedUpstream(res));
  }
  const refused = await call(A, "/identity/api/v1/users/me", { bearer: userA });
  assert.equal(refused.status, 429, refused.text);
  assert.match(refused.headers.get("retry-after") ?? "", /^\d+$/);
  assert.ok(!reachedUpstream(refused));
  const other = await call(A, "/identity/api/v1/users/me", { bearer: userB });
  assert.notEqual(other.status, 429, "user B, from the same address, is not slowed by user A");
  assert.ok(reachedUpstream(other));
});

test("EN-12-T9 overwrites a client-sent x-user-id with the token's subject", async () => {
  const sub = randomUUID();
  const bearer = await token(sub);
  const spoofed = await call(A, "/ci-echo-staff/probe", { bearer, headers: { "x-user-id": "someone-else", "X-User-Id": "another" } });
  assert.equal(spoofed.status, 200, spoofed.text);
  assert.equal(spoofed.json.headers["x-user-id"], sub, "the token's subject, whatever the client sent");
  assert.equal(spoofed.json.url, "/probe", "the prefix was stripped");
  assert.match(spoofed.json.headers.authorization, /^Bearer /, "the token still reaches the service, which checks it too");

  const plain = await call(A, "/ci-echo-staff/probe", { bearer });
  assert.equal(plain.json.headers["x-user-id"], sub);

  // A public route is not given a user id at all, so it cannot be made to count by one.
  const publicRoute = await call(A, "/ci-echo-public/probe", { bearer, headers: { "x-user-id": "someone-else" } });
  assert.equal(publicRoute.status, 200, publicRoute.text);
  assert.equal(publicRoute.json.headers["x-user-id"], undefined, "a public route passes none on");
});

test("EN-12-T10 generates or propagates traceparent and x-correlation-id", async () => {
  const generated = await call(A, "/ci-echo-public/trace");
  const seen = generated.json.headers;
  assert.match(seen["x-correlation-id"], UUID, "a UUID when the caller sent none");
  assert.match(seen.traceparent, TRACEPARENT);
  assert.equal(generated.headers.get("x-correlation-id"), seen["x-correlation-id"], "echoed to the caller");
  assert.equal(generated.headers.get("traceparent"), seen.traceparent);

  const incoming = "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01";
  const kept = await call(B, "/ci-echo-public/trace", { headers: { traceparent: incoming, "x-correlation-id": "caller-id-123" } });
  const [, traceId, spanId, flags] = TRACEPARENT.exec(kept.json.headers.traceparent);
  assert.equal(traceId, "0af7651916cd43dd8448eb211c80319c", "the trace id travels on");
  assert.notEqual(spanId, "b7ad6b7169203331", "with a new span id");
  assert.equal(flags, "01");
  assert.equal(kept.json.headers["x-correlation-id"], "caller-id-123", "a caller's correlation id is kept");
  assert.equal(kept.headers.get("x-correlation-id"), "caller-id-123");

  const unsampled = await call(A, "/ci-echo-public/trace", { headers: { traceparent: "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-00" } });
  assert.equal(TRACEPARENT.exec(unsampled.json.headers.traceparent)[3], "00", "the sampling flag is kept");

  for (const bad of ["garbage", "00-00000000000000000000000000000000-b7ad6b7169203331-01", "00-0AF7651916CD43DD8448EB211C80319C-b7ad6b7169203331-01", "01-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01"]) {
    const res = await call(A, "/ci-echo-public/trace", { headers: { traceparent: bad } });
    const match = TRACEPARENT.exec(res.json.headers.traceparent);
    assert.ok(match, `a valid value replaces ${bad}`);
    assert.notEqual(match[1], "00000000000000000000000000000000");
    assert.notEqual(res.json.headers.traceparent, bad);
  }

  const staff = await call(A, "/ci-echo-staff/trace", { bearer: await token(randomUUID()) });
  assert.match(staff.json.headers.traceparent, TRACEPARENT, "staff routes are stamped too");

  // A real service sees and echoes the same correlation id.
  const attendee = await token(ATTENDEE);
  const real = await call(A, "/registration/api/v1/open-events", { bearer: attendee, headers: { "x-correlation-id": "real-service-1" } });
  assert.equal(real.status, 200);
  assert.equal(real.headers.get("x-correlation-id").split(",")[0].trim(), "real-service-1");
  const fresh = await call(A, "/registration/api/v1/open-events", { bearer: attendee });
  assert.match(fresh.headers.get("x-correlation-id").split(",")[0].trim(), UUID, "Kong's generated id reached the service, which echoed it");
});

test("EN-12-T11 serves the browse API as cacheable and everything personal as no-store", async () => {
  const attendee = await token(ATTENDEE);
  const cache = (res) => res.headers.get("cache-control") ?? "";

  const list = await call(A, "/registration/api/v1/open-events", { bearer: attendee });
  assert.equal(list.status, 200);
  assert.equal(cache(list), "public, max-age=5, stale-while-revalidate=30", "the CDN may keep the browse list for 5 seconds");
  assert.deepEqual(Object.keys(list.json).sort(), ["items", "nextCursor"], "listing data only");

  const absent = await call(A, `/registration/api/v1/open-events/${randomUUID()}`, { bearer: attendee });
  assert.equal(absent.status, 404);
  assert.doesNotMatch(cache(absent), /public/, "a refusal is never cached for everyone");
  const refused = await call(A, "/registration/api/v1/open-events");
  assert.equal(refused.status, 401);
  assert.doesNotMatch(cache(refused), /public/);

  for (const path of ["/registration/api/v1/registrations", "/identity/api/v1/users/me", "/notification/api/v1/notifications"]) {
    const res = await call(A, path, { bearer: attendee });
    assert.equal(res.status, 200, `${path}: ${res.text}`);
    assert.equal(cache(res), "no-store", `${path} is personal and never cached`);
  }
});
