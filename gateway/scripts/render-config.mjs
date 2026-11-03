#!/usr/bin/env node
// Renders the Kong configuration Kong actually loads, from the committed gateway/kong.yml (EN-12).
//
//   node gateway/scripts/render-config.mjs --jwks-url https://<project>.supabase.co/auth/v1/.well-known/jwks.json --out /config/kong.yml
//
// Why this exists. Kong's open-source `jwt` plugin checks a token against credentials stored in
// Kong; it cannot fetch a JWKS (that is the Enterprise `openid-connect` plugin). So the keys in the
// Supabase JWKS are copied into the configuration as credentials, one per key, keyed by the key's
// `kid` (the plugin is set to look the credential up by the `kid` in the token's header). Run this
// whenever the JWKS changes: at pod start (the init container in gateway/k8s) and again, followed
// by a rolling restart, after a key rotation. Tokens signed by a key the last run did not see are
// refused until it is run again.
//
// No dependencies: it runs in a plain node image. It edits the template as text on purpose, so the
// committed file stays the single hand-written source of policy.
import { createPublicKey } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const HERE = fileURLToPath(new URL(".", import.meta.url));
export const DEFAULT_TEMPLATE = `${HERE}../kong.yml`;
export const ECHO_TEMPLATE = `${HERE}../ci/echo-services.yml`;

export const JWT_MARKER = "# @@JWT_SECRETS@@";

/** The algorithm Kong's jwt plugin calls a JWK by, or an explanation of why it cannot be used. */
function algorithmOf(jwk) {
  if (jwk.kty === "EC" && jwk.crv === "P-256") return "ES256";
  if (jwk.kty === "EC" && jwk.crv === "P-384") return "ES384";
  if (jwk.kty === "RSA") return jwk.alg && /^RS(256|384|512)$/.test(jwk.alg) ? jwk.alg : "RS256";
  throw new Error(`Cannot use a ${jwk.kty}${jwk.crv ? ` ${jwk.crv}` : ""} key (kid ${jwk.kid ?? "missing"}): Kong's jwt plugin checks RS and ES keys.`);
}

/** One Kong jwt credential for one JWK. Throws, naming the key, if it cannot become one. */
export function jwkToCredential(jwk) {
  if (typeof jwk.kid !== "string" || jwk.kid === "") throw new Error("A key in the JWKS has no kid, so Kong cannot find it from a token. Refusing to render.");
  if (jwk.use !== undefined && jwk.use !== "sig") throw new Error(`Key ${jwk.kid} is for ${jwk.use}, not signatures.`);
  const algorithm = algorithmOf(jwk);
  const pem = createPublicKey({ key: jwk, format: "jwk" }).export({ type: "spki", format: "pem" }).toString();
  return { key: jwk.kid, algorithm, rsa_public_key: pem };
}

export function credentialsOf(jwks) {
  if (!jwks || !Array.isArray(jwks.keys) || jwks.keys.length === 0) throw new Error("The JWKS has no keys, so every staff request would be refused. Refusing to render.");
  const credentials = jwks.keys.map(jwkToCredential);
  const kids = new Set(credentials.map((c) => c.key));
  if (kids.size !== credentials.length) throw new Error("Two keys in the JWKS share a kid.");
  return credentials;
}

function yamlBlock(credentials, indent) {
  const pad = " ".repeat(indent);
  const lines = [`${pad}jwt_secrets:`];
  for (const c of credentials) {
    lines.push(`${pad}  - key: ${JSON.stringify(c.key)}`, `${pad}    algorithm: ${c.algorithm}`, `${pad}    rsa_public_key: |`);
    for (const line of c.rsa_public_key.trimEnd().split("\n")) lines.push(`${pad}      ${line}`);
  }
  return lines.join("\n");
}

function replaceOnce(text, pattern, replacement, what) {
  if (!pattern.test(text)) throw new Error(`The template has nothing to replace for ${what}; gateway/kong.yml and render-config.mjs have drifted apart.`);
  return text.replace(pattern, replacement);
}

const positive = (value, name) => {
  if (!Number.isInteger(value) || value < 1) throw new Error(`${name} must be a whole number of at least 1.`);
  return value;
};

/**
 * @param {string} template the text of gateway/kong.yml
 * @param {object} options
 * @param {object} options.jwks the parsed JWKS
 * @param {{host?: string, port?: number}} [options.redis]
 * @param {Record<string, string>} [options.targets] upstream name -> "host:port"
 * @param {number} [options.staffLimit] requests a minute per user (committed: 300)
 * @param {number} [options.publicLimit] requests a minute per address (committed: 600)
 * @param {string} [options.echoTemplate] the CI-only echo services, appended when given
 * @param {string} [options.echoTarget] "host:port" of the echo upstream
 */
export function renderConfig(template, options) {
  let text = template.replaceAll("\r\n", "\n");
  const marker = new RegExp(`^([ ]*)${JWT_MARKER}[ ]*$`, "m");
  const match = marker.exec(text);
  if (!match) throw new Error(`The template has no ${JWT_MARKER} line.`);
  text = text.replace(marker, yamlBlock(credentialsOf(options.jwks), match[1].length));

  // Appended before the Redis address is replaced, so the echo services follow it too.
  if (options.echoTemplate) {
    if (!options.echoTarget) throw new Error("An echo template needs an echo target.");
    text = `${text.trimEnd()}\n\n${options.echoTemplate.replaceAll("\r\n", "\n").replaceAll("{{ECHO_TARGET}}", options.echoTarget).trimEnd()}\n`;
  }

  if (options.redis?.host) text = replaceOnce(text, /^([ ]+)host: redis$/gm, `$1host: ${options.redis.host}`, "the Redis host");
  if (options.redis?.port) text = replaceOnce(text, /^([ ]+)port: 6379$/gm, `$1port: ${positive(options.redis.port, "The Redis port")}`, "the Redis port");

  for (const [name, target] of Object.entries(options.targets ?? {})) {
    text = replaceOnce(
      text,
      new RegExp(`(- name: ${name}\\n[ ]+targets:\\n[ ]+- target: )\\S+`),
      `$1${target}`,
      `the ${name} upstream`,
    );
  }

  if (options.staffLimit !== undefined || options.publicLimit !== undefined) {
    const staff = options.staffLimit === undefined ? undefined : positive(options.staffLimit, "The staff limit");
    const pub = options.publicLimit === undefined ? undefined : positive(options.publicLimit, "The public limit");
    text = replaceOnce(
      text,
      /^([ ]+)minute: (300|600)$/gm,
      (whole, indent, value) => {
        const replacement = value === "300" ? staff : pub;
        return replacement === undefined ? whole : `${indent}minute: ${replacement}`;
      },
      "the limits",
    );
  }

  return text;
}

async function loadJwks({ jwksUrl, jwksFile }) {
  if (jwksFile) return JSON.parse(readFileSync(jwksFile, "utf8"));
  if (!jwksUrl) throw new Error("Give --jwks-url (or SUPABASE_JWKS_URL) or --jwks-file.");
  const response = await fetch(jwksUrl, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`The JWKS at ${jwksUrl} answered ${response.status}.`);
  return response.json();
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (!flag.startsWith("--")) throw new Error(`Unexpected argument ${flag}.`);
    const name = flag.slice(2);
    if (name === "with-ci-echo") args[name] = true;
    else args[name] = argv[++i];
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const template = readFileSync(args.template ?? DEFAULT_TEMPLATE, "utf8");
  const targets = {};
  const upstreams = {
    "--planning-core": ["staff-planning-core", "public-planning-core"],
    "--notification": ["staff-notification"],
    "--registration": ["public-registration"],
  };
  for (const [flag, names] of Object.entries(upstreams)) {
    const value = args[flag.slice(2)];
    if (value) for (const name of names) targets[name] = value;
  }
  const [redisHost, redisPort] = (args.redis ?? process.env.REDIS_ADDRESS ?? "").split(":");
  const rendered = renderConfig(template, {
    jwks: await loadJwks({ jwksUrl: args["jwks-url"] ?? process.env.SUPABASE_JWKS_URL, jwksFile: args["jwks-file"] }),
    redis: redisHost ? { host: redisHost, port: redisPort ? Number(redisPort) : undefined } : undefined,
    targets,
    staffLimit: args["staff-limit"] ? Number(args["staff-limit"]) : undefined,
    publicLimit: args["public-limit"] ? Number(args["public-limit"]) : undefined,
    echoTemplate: args["with-ci-echo"] ? readFileSync(ECHO_TEMPLATE, "utf8") : undefined,
    echoTarget: args["ci-echo-target"] ?? "127.0.0.1:9100",
  });
  if (!args.out) throw new Error("Give --out <file>.");
  writeFileSync(args.out, rendered, { mode: 0o644 });
  console.log(`rendered ${args.out}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(`render-config: ${error.message}`);
    process.exit(1);
  });
}
