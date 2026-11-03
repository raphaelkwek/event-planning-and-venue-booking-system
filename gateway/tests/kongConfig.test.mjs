import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import YAML from "yaml";

/**
 * EN-12-T14 (and the file half of T5): the committed gateway/kong.yml obeys the gateway rules.
 * No network, no Kong: it reads the file.
 */

const GATEWAY = new URL("../", import.meta.url);
const text = readFileSync(new URL("kong.yml", GATEWAY), "utf8");
const config = YAML.parse(text);
const echo = YAML.parse(readFileSync(new URL("ci/echo-services.yml", GATEWAY), "utf8"));

const staff = config.services.filter((s) => s.name.startsWith("staff-"));
const pub = config.services.filter((s) => s.name.startsWith("public-"));
const plugin = (service, name) => service.plugins?.find((p) => p.name === name);

test("EN-12-T14 keeps staff behind jwt and per-user limits, public behind per-address limits, all on Redis", () => {
  assert.equal(config._format_version, "3.0");
  assert.equal(staff.length + pub.length, config.services.length, "every service is named staff-* or public-*");
  assert.ok(staff.length >= 2 && pub.length >= 2);

  for (const service of staff) {
    const jwt = plugin(service, "jwt");
    assert.ok(jwt, `${service.name} has the jwt plugin`);
    assert.equal(jwt.config.key_claim_name, "kid", "credentials are found by the key id in the token header");
    assert.ok(jwt.config.claims_to_verify.includes("exp"), "expiry is checked");
    assert.deepEqual(jwt.config.header_names, ["authorization"]);
    assert.deepEqual(jwt.config.uri_param_names, [], "a token in the query string is not accepted");
    assert.deepEqual(jwt.config.cookie_names, []);

    const limit = plugin(service, "rate-limiting").config;
    assert.equal(limit.limit_by, "header");
    assert.equal(limit.header_name, "x-user-id");
    assert.equal(limit.minute, 300);
    assert.equal(limit.policy, "redis");
    assert.equal(limit.error_code, 429);
    assert.deepEqual(plugin(service, "response-transformer").config.add.headers, ["Cache-Control:no-store"], "staff responses are never cached");
  }

  for (const service of pub) {
    assert.equal(plugin(service, "jwt"), undefined, `${service.name} checks no token at the edge; the service does`);
    const limit = plugin(service, "rate-limiting").config;
    assert.equal(limit.limit_by, "ip");
    assert.equal(limit.minute, 600);
    assert.equal(limit.policy, "redis");
    assert.equal(limit.error_code, 429);
  }

  for (const service of config.services) {
    const limit = plugin(service, "rate-limiting").config;
    assert.equal(limit.redis.host, "redis");
    assert.equal(limit.redis.port, 6379);
    assert.equal(limit.hide_client_headers, false, "clients are told their budget and Retry-After");
  }
});

test("EN-12-T14 stamps trace headers on every route with global plugins", () => {
  const globalPlugins = Object.fromEntries(config.plugins.map((p) => [p.name, p.config]));
  assert.equal(globalPlugins["correlation-id"].header_name, "x-correlation-id");
  assert.equal(globalPlugins["correlation-id"].generator, "uuid");
  assert.equal(globalPlugins["correlation-id"].echo_downstream, true);
  const [access] = globalPlugins["pre-function"].access;
  assert.match(access, /traceparent/);
  assert.match(access, /clear_header\("x-user-id"\)/, "a client-sent x-user-id is always removed");
  assert.match(access, /cjson/, "the subject is read by decoding the payload, not by pattern matching it");
  assert.ok(config.services.every((s) => !plugin(s, "pre-function")), "a scoped copy would replace the global one");
});

test("EN-12-T14 routes only /api/v1, never a health, readiness or metrics path", () => {
  const routes = config.services.flatMap((s) => s.routes.map((r) => ({ service: s.name, ...r })));
  assert.ok(routes.length >= 6);
  for (const route of routes) {
    assert.equal(route.strip_path, true, `${route.name} strips its prefix as the dev server does`);
    for (const path of route.paths) {
      assert.match(path, /^\/(identity|event|venue|equipment|notification|registration)\/api\/v1(\/auth)?$/, `${route.name}: ${path}`);
      assert.doesNotMatch(path, /health|ready|metrics|status/);
    }
  }
  // The service paths all end in /api/v1, so nothing outside it can be reached through the strip.
  for (const service of config.services) assert.ok(service.path.startsWith("/api/v1"), `${service.name}: ${service.path}`);
});

test("EN-12-T14 gives staff and public services separate upstream pools, each defined", () => {
  const upstreams = new Map(config.upstreams.map((u) => [u.name, u]));
  const hostOf = (service) => service.host;
  for (const service of config.services) assert.ok(upstreams.has(service.host), `${service.name} -> ${service.host}`);
  const staffHosts = new Set(staff.map(hostOf));
  const publicHosts = new Set(pub.map(hostOf));
  for (const host of staffHosts) assert.ok(!publicHosts.has(host), `${host} is used by both staff and public services`);
  assert.ok([...staffHosts].every((h) => h.startsWith("staff-")) && [...publicHosts].every((h) => h.startsWith("public-")));
});

test("EN-12-T14 the sign-in route is public, POST only, and longer than the staff prefix it sits under", () => {
  const auth = pub.find((s) => s.name === "public-auth").routes[0];
  assert.deepEqual(auth.paths, ["/identity/api/v1/auth"]);
  assert.deepEqual(auth.methods, ["POST"]);
  const identity = staff.flatMap((s) => s.routes).find((r) => r.name === "staff-identity");
  assert.ok(auth.paths[0].startsWith(identity.paths[0]) && auth.paths[0].length > identity.paths[0].length);
});

test("EN-12-T14 holds no key or secret, and has the marker the rendering step fills", () => {
  assert.doesNotMatch(text, /BEGIN [A-Z ]*KEY|jwt_secrets:|rsa_public_key|"d":|apikey|password/i);
  assert.match(text, /^\s+# @@JWT_SECRETS@@\s*$/m);
  assert.equal(config.consumers.length, 1);
  assert.equal(config.consumers[0].jwt_secrets, undefined);
});

test("EN-12-T14 the CI-only echo services carry the same plugins as the real ones", () => {
  const strip = (service) => plugin(service, "rate-limiting").config;
  const withoutLimit = (plugins) => plugins.map((p) => (p.name === "rate-limiting" ? { ...p, config: { ...p.config, minute: 0 } } : p));
  const real = {
    staff: config.services.find((s) => s.name === "staff-notification"),
    public: config.services.find((s) => s.name === "public-registration"),
  };
  const ci = {
    staff: echo.find((s) => s.name === "staff-ci-echo"),
    public: echo.find((s) => s.name === "public-ci-echo"),
  };
  assert.deepEqual(withoutLimit(ci.staff.plugins), withoutLimit(real.staff.plugins));
  assert.deepEqual(withoutLimit(ci.public.plugins), withoutLimit(real.public.plugins));
  assert.ok(strip(ci.staff).minute >= 1000 && strip(ci.public).minute >= 1000);
  assert.ok(!text.includes("ci-echo"), "the echo upstream is not in the committed file");
});
