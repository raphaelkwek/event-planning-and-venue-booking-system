// ADR-0016: the deploy state and the Secret's env file. Run by `npm run test:scripts`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { IMAGES, renderState, parseRelease, StateError } from "./write-state.mjs";
import { ALLOWED_KEYS, buildEnvFile, SecretEnvError } from "./secret-env.mjs";

const COMMIT = "0123456789abcdef0123456789abcdef01234567";
const digest = (n) => `sha256:${String(n).repeat(64).slice(0, 64)}`;
const release = {
  commit: COMMIT,
  images: Object.fromEntries(IMAGES.map((name, i) => [name, `ghcr.io/raphaelkwek/connectsphere-${name}@${digest(i + 1)}`])),
};
const staging = { environment: "staging", release, apiHost: "api.staging.203.0.113.7.sslip.io", webOrigin: "https://connectsphere-staging.vercel.app" };
const production = { environment: "production", release, apiHost: "api.203.0.113.7.sslip.io", webOrigin: "https://connectsphere.vercel.app" };

const lines = (text) => text.split("\n");
const digestsIn = (text) => lines(text).filter((l) => l.includes("digest:"));

test("DEPLOY-T8 staging and production state pin the same commit and the same digests", () => {
  const a = renderState(staging);
  const b = renderState(production);
  assert.deepEqual(digestsIn(a), digestsIn(b));
  assert.equal(digestsIn(a).length, IMAGES.length);
  assert.ok(a.includes(`//deploy/k8s/overlays/k3s-staging?ref=${COMMIT}`));
  assert.ok(b.includes(`//deploy/k8s/overlays/k3s-production?ref=${COMMIT}`));
  // Apart from the overlay path, the host and the origin, the two files are the same.
  const norm = (text, env, host, origin) =>
    text.replaceAll(`k3s-${env}`, "k3s-ENV").replaceAll(host, "HOST").replaceAll(origin, "ORIGIN").replaceAll(`ConnectSphere ${env}:`, "ConnectSphere ENV:");
  assert.equal(norm(a, "staging", staging.apiHost, staging.webOrigin), norm(b, "production", production.apiHost, production.webOrigin));
});

test("DEPLOY-T8 the state names every image by digest and sets the host and the CORS origin", () => {
  const text = renderState(staging);
  for (const name of IMAGES) assert.ok(text.includes(`"ghcr.io/raphaelkwek/connectsphere-${name}"`), name);
  assert.equal(lines(text).filter((l) => l.includes(`"${staging.apiHost}"`)).length, 2);
  assert.ok(text.includes(`value: "${staging.webOrigin}"`));
  assert.ok(text.includes("path: /data/CORS_ALLOWED_ORIGINS"));
});

test("DEPLOY-T8 a tag instead of a digest, a short commit or a host with a scheme is refused", () => {
  const tagged = { ...release, images: { ...release.images, migrate: "ghcr.io/raphaelkwek/connectsphere-migrate:latest" } };
  assert.throws(() => renderState({ ...staging, release: tagged }), StateError);
  assert.throws(() => parseRelease(JSON.stringify({ ...release, commit: COMMIT.slice(0, 7) })), StateError);
  assert.throws(() => renderState({ ...staging, apiHost: "https://api.staging.example.org" }), StateError);
  assert.throws(() => renderState({ ...staging, webOrigin: "https://connectsphere.vercel.app/" }), StateError);
  assert.throws(() => renderState({ ...staging, environment: "dev" }), StateError);
  const missing = { ...release, images: { ...release.images } };
  delete missing.images.cerbos;
  assert.throws(() => renderState({ ...staging, release: missing }), /cerbos/);
});

test("DEPLOY-T8 only the kind job may use tags, and only when it says so", () => {
  const local = { commit: COMMIT, images: Object.fromEntries(IMAGES.map((n) => [n, `connectsphere-${n}:ci`])) };
  assert.throws(() => renderState({ ...staging, release: local }), StateError);
  const text = renderState({ ...staging, release: local, allowTags: true, source: "../../deploy/k8s/overlays/k3s-staging" });
  assert.ok(text.includes('newTag: "ci"'));
  assert.ok(text.includes('- "../../deploy/k8s/overlays/k3s-staging"'));
});

// Every fake value is built at run time, so no secret scanner mistakes a test for a leak.
const fake = (label) => `${label}-${"k".repeat(8)}`;
const pgUrl = (port) => ["postgres://", fake("user"), ":", fake("pass"), "@aws-0-ap-southeast-1.pooler.supabase.com:", port, "/postgres"].join("");
const goodEnv = {
  DATABASE_URL: pgUrl(6543),
  MIGRATE_DATABASE_URL: pgUrl(5432),
  SUPABASE_URL: "https://abcdefghijkl.supabase.co",
  SUPABASE_ANON_KEY: fake("anon"),
  SUPABASE_SERVICE_ROLE_KEY: fake("service"),
  KAFKA_SASL_PASSWORD: "x".repeat(32), // made up at run time, so no secret scanner mistakes it for one
};

test("DEPLOY-T7 the env file holds exactly the keys the gate accepts, with the fixed in-cluster addresses", () => {
  const text = buildEnvFile(goodEnv);
  const keys = lines(text).filter(Boolean).map((l) => l.split("=")[0]);
  assert.deepEqual(keys, ALLOWED_KEYS);
  assert.ok(text.includes("SUPABASE_JWKS_URL=https://abcdefghijkl.supabase.co/auth/v1/.well-known/jwks.json\n"));
  assert.ok(text.includes("KAFKA_BROKERS=redpanda:9092\n"));
  assert.ok(text.includes("KAFKA_SASL_USERNAME=connectsphere\n"));
  assert.ok(text.includes("TEMPORAL_ADDRESS=temporal:7233\n"));
});

test("DEPLOY-T7 a missing or malformed value is refused, naming the variable and never the value", () => {
  const shortPassword = ["short", "pw"].join(":");
  const bad = { ...goodEnv, KAFKA_SASL_PASSWORD: shortPassword, SUPABASE_URL: "http://abcdefghijkl.supabase.co/x" };
  delete bad.MIGRATE_DATABASE_URL;
  try {
    buildEnvFile(bad);
    assert.fail("expected a refusal");
  } catch (error) {
    assert.ok(error instanceof SecretEnvError);
    assert.equal(error.problems.length, 3);
    assert.ok(error.message.includes("MIGRATE_DATABASE_URL is not set"));
    assert.ok(error.message.includes("KAFKA_SASL_PASSWORD"));
    assert.ok(!error.message.includes(shortPassword));
    assert.ok(!error.message.includes("abcdefghijkl"));
  }
  assert.throws(() => buildEnvFile({ ...goodEnv, SUPABASE_ANON_KEY: "a\nb" }), /SUPABASE_ANON_KEY contains a line break/);
});
