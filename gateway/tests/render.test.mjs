import { createPublicKey, createSign, createVerify, generateKeyPairSync } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import YAML from "yaml";
import { credentialsOf, jwkToCredential, renderConfig } from "../scripts/render-config.mjs";

/** EN-12-T4: the JWKS becomes one Kong credential per key, by key id. No network, no Kong. */

const GATEWAY = new URL("../", import.meta.url);
const template = readFileSync(new URL("kong.yml", GATEWAY), "utf8");
const echoTemplate = readFileSync(new URL("ci/echo-services.yml", GATEWAY), "utf8");

function ecKey(kid) {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  return { privateKey, jwk: { ...publicKey.export({ format: "jwk" }), kid, alg: "ES256", use: "sig" } };
}

function rsaKey(kid) {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  return { privateKey, jwk: { ...publicKey.export({ format: "jwk" }), kid, alg: "RS256", use: "sig" } };
}

test("EN-12-T4 turns each JWKS key into a credential by kid and picks up a rotation", () => {
  const first = ecKey("key-one");
  const [credential] = credentialsOf({ keys: [first.jwk] });
  assert.equal(credential.key, "key-one");
  assert.equal(credential.algorithm, "ES256");
  // The PEM is a public key that verifies what the private half signed.
  const signature = createSign("sha256").update("signed input").sign({ key: first.privateKey, dsaEncoding: "ieee-p1363" });
  assert.ok(createVerify("sha256").update("signed input").verify({ key: createPublicKey(credential.rsa_public_key), dsaEncoding: "ieee-p1363" }, signature));
  assert.doesNotMatch(credential.rsa_public_key, /PRIVATE/);

  const second = rsaKey("key-two");
  const rotated = credentialsOf({ keys: [second.jwk] });
  assert.deepEqual(rotated.map((c) => [c.key, c.algorithm]), [["key-two", "RS256"]]);
  const during = credentialsOf({ keys: [second.jwk, first.jwk] });
  assert.deepEqual(during.map((c) => c.key), ["key-two", "key-one"]);
});

test("EN-12-T4 refuses a key it cannot use rather than render a config that accepts nothing", () => {
  const good = ecKey("good").jwk;
  assert.throws(() => jwkToCredential({ ...good, kid: undefined }), /no kid/);
  assert.throws(() => jwkToCredential({ ...good, kid: "" }), /no kid/);
  assert.throws(() => jwkToCredential({ kty: "oct", k: "c2VjcmV0", kid: "shared" }), /Cannot use a oct key \(kid shared\)/);
  assert.throws(() => jwkToCredential({ ...good, use: "enc" }), /not signatures/);
  assert.throws(() => credentialsOf({ keys: [] }), /no keys/);
  assert.throws(() => credentialsOf(undefined), /no keys/);
  assert.throws(() => credentialsOf({ keys: [good, good] }), /share a kid/);
  const p384 = generateKeyPairSync("ec", { namedCurve: "P-384" }).publicKey.export({ format: "jwk" });
  assert.equal(jwkToCredential({ ...p384, kid: "p384" }).algorithm, "ES384");
  assert.equal(jwkToCredential({ ...rsaKey("r").jwk, alg: "RS512" }).algorithm, "RS512");
  assert.equal(jwkToCredential({ ...rsaKey("r").jwk, alg: undefined }).algorithm, "RS256");
});

test("EN-12-T4 renders the template with the credentials under the consumer and nothing else changed", () => {
  const jwks = { keys: [ecKey("a").jwk, rsaKey("b").jwk] };
  const rendered = renderConfig(template, { jwks });
  const config = YAML.parse(rendered);
  assert.deepEqual(config.consumers[0].jwt_secrets.map((s) => [s.key, s.algorithm]), [["a", "ES256"], ["b", "RS256"]]);
  assert.match(config.consumers[0].jwt_secrets[0].rsa_public_key, /^-----BEGIN PUBLIC KEY-----\n/);
  const committed = YAML.parse(template.replace(/^\s+# @@JWT_SECRETS@@\r?$/m, ""));
  const { jwt_secrets: _secrets, ...consumer } = config.consumers[0];
  assert.deepEqual({ ...config, consumers: [consumer] }, committed, "only the credentials differ from the committed file");
  assert.throws(() => renderConfig(template.replace("# @@JWT_SECRETS@@", ""), { jwks }), /no # @@JWT_SECRETS@@ line/);
});

test("EN-12-T4 points upstreams and Redis elsewhere, lowers the limits and appends the CI echo only when asked", () => {
  const jwks = { keys: [ecKey("a").jwk] };
  const rendered = renderConfig(template, {
    jwks,
    redis: { host: "127.0.0.1", port: 6380 },
    targets: { "staff-planning-core": "127.0.0.1:18090", "public-planning-core": "127.0.0.1:18090", "public-registration": "127.0.0.1:18092" },
    staffLimit: 15,
    publicLimit: 20,
    echoTemplate,
    echoTarget: "127.0.0.1:9100",
  });
  const config = YAML.parse(rendered);
  const limits = Object.fromEntries(config.services.map((s) => [s.name, s.plugins.find((p) => p.name === "rate-limiting").config]));
  assert.equal(limits["staff-planning-core"].minute, 15);
  assert.equal(limits["staff-notification"].minute, 15);
  assert.equal(limits["public-auth"].minute, 20);
  assert.equal(limits["public-registration"].minute, 20);
  assert.equal(limits["staff-ci-echo"].minute, 1000, "the echo services keep their own high limit");
  for (const l of Object.values(limits)) assert.deepEqual([l.redis.host, l.redis.port], ["127.0.0.1", 6380]);
  const targets = Object.fromEntries(config.upstreams.map((u) => [u.name, u.targets[0].target]));
  assert.deepEqual(targets, {
    "staff-planning-core": "127.0.0.1:18090",
    "public-planning-core": "127.0.0.1:18090",
    "staff-notification": "notification:8091",
    "public-registration": "127.0.0.1:18092",
  });
  assert.equal(config.services.find((s) => s.name === "staff-ci-echo").url, "http://127.0.0.1:9100");

  const plain = YAML.parse(renderConfig(template, { jwks }));
  assert.ok(plain.services.every((s) => !s.name.includes("ci-echo")), "no echo unless asked");
  assert.equal(plain.services.find((s) => s.name === "staff-notification").plugins[1].config.minute, 300);
});

test("EN-12-T4 refuses a template that has drifted from the script and limits that make no sense", () => {
  const jwks = { keys: [ecKey("a").jwk] };
  assert.throws(() => renderConfig(template, { jwks, targets: { "no-such-upstream": "x:1" } }), /no-such-upstream upstream/);
  assert.throws(() => renderConfig(template, { jwks, staffLimit: 0 }), /staff limit must be a whole number/);
  assert.throws(() => renderConfig(template, { jwks, publicLimit: 1.5 }), /public limit must be a whole number/);
  assert.throws(() => renderConfig(template, { jwks, redis: { host: "r", port: -1 } }), /Redis port/);
  assert.throws(() => renderConfig(template, { jwks, echoTemplate }), /echo target/);
  assert.throws(() => renderConfig(template.replaceAll("host: redis", "host: cache"), { jwks, redis: { host: "r" } }), /Redis host/);
});

test("EN-12-T4 a file with Windows line endings renders the same as one with Unix endings", () => {
  const jwks = { keys: [ecKey("a").jwk] };
  const unix = template.replaceAll("\r\n", "\n");
  assert.equal(renderConfig(unix.replaceAll("\n", "\r\n"), { jwks }), renderConfig(unix, { jwks }));
});
