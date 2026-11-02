// CI ONLY. A stand-in for Supabase Auth's signing keys, for the gateway's throwaway CI stack (EN-12).
//
// Adapted from EN-14's fake Supabase Auth (tests/e2e/support/fake-supabase-auth.ts, PR #79), cut down
// to what the gateway tests need: the JWKS every service and the gateway render read, and a helper that
// signs tokens. It does not implement GoTrue's sign-in, so the services' login route cannot succeed
// against it. The gateway tests use it for a refusal path only.
//
//   GET  /auth/v1/.well-known/jwks.json   the public keys (the current one, and the retired one after /ci/rotate)
//   GET  /auth/v1/health
//   POST /ci/token   { sub, expiresInSeconds?, key?: "current" | "retired" | "stranger" | "forged" } -> { access_token }
//   POST /ci/rotate  retires the current key and makes a new one current (a key rotation)
//
// "stranger" signs with a key that is in nobody's JWKS, under its own key id (a key id Kong has no
// credential for). "forged" signs with that key under the current key id (a bad signature).
//
// It refuses to start unless the harness flag is set exactly, NODE_ENV is not production and
// DATABASE_URL is the machine's own loopback database, and it listens on the loopback address only.
import { createServer } from "node:http";
import { generateKeyPairSync, randomUUID, sign } from "node:crypto";
import { fileURLToPath } from "node:url";

export const FLAG = "GATEWAY_CI_FAKE_JWKS";
export const FLAG_VALUE = "enabled-for-the-gateway-ci-job";
const LOOPBACK = "127.0.0.1";
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

export function assertCiOnly(env) {
  if (env[FLAG] !== FLAG_VALUE) throw new Error(`The fake JWKS server is for the gateway CI job only: set ${FLAG}=${FLAG_VALUE}.`);
  if (env.NODE_ENV === "production") throw new Error("The fake JWKS server never runs with NODE_ENV=production.");
  let host;
  try {
    host = new URL(env.DATABASE_URL ?? "").hostname;
  } catch {
    throw new Error("DATABASE_URL must be a URL pointing at a throwaway Postgres on this machine.");
  }
  if (!LOOPBACK_HOSTS.has(host)) throw new Error("DATABASE_URL must point at a throwaway Postgres on this machine, never a shared database.");
}

const b64 = (input) => Buffer.from(input).toString("base64url");

function newKey() {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const kid = randomUUID();
  return { privateKey, kid, jwk: { ...publicKey.export({ format: "jwk" }), kid, alg: "ES256", use: "sig", key_ops: ["verify"] } };
}

function signToken(key, claims, kid = key.kid) {
  const header = b64(JSON.stringify({ alg: "ES256", kid, typ: "JWT" }));
  const payload = b64(JSON.stringify(claims));
  const signature = sign("sha256", Buffer.from(`${header}.${payload}`), { key: key.privateKey, dsaEncoding: "ieee-p1363" });
  return `${header}.${payload}.${b64(signature)}`;
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    return null;
  }
}

const send = (res, status, body) => res.writeHead(status, { "Content-Type": "application/json" }).end(JSON.stringify(body));

export async function startFakeJwks({ port }, env = process.env) {
  assertCiOnly(env);
  let current = newKey();
  let retired = null;
  const stranger = newKey();
  let issuer = "";

  function mint(body) {
    const key = body.key === "retired" ? retired : body.key === "stranger" || body.key === "forged" ? stranger : current;
    if (!key) return null;
    const now = Math.floor(Date.now() / 1000);
    const expiresIn = Number.isInteger(body.expiresInSeconds) ? body.expiresInSeconds : 3600;
    // "forged": the current key id on a signature made by a key nobody published.
    return signToken(
      key,
      {
      iss: issuer,
      sub: body.sub,
      aud: "authenticated",
      role: "authenticated",
      iat: now,
      exp: now + expiresIn,
      session_id: randomUUID(),
      },
      body.key === "forged" ? current.kid : undefined,
    );
  }

  const server = createServer((req, res) => {
    void (async () => {
      const route = `${req.method} ${new URL(req.url ?? "/", "http://x").pathname}`;
      if (route === "GET /auth/v1/.well-known/jwks.json") return send(res, 200, { keys: [current.jwk, ...(retired ? [retired.jwk] : [])] });
      if (route === "GET /auth/v1/health") return send(res, 200, { name: "fake-jwks", description: "ConnectSphere gateway CI only" });
      if (route === "POST /ci/rotate") {
        retired = current;
        current = newKey();
        return send(res, 200, { current: current.jwk.kid, retired: retired.jwk.kid });
      }
      if (route === "POST /ci/token") {
        const body = await readJson(req);
        if (!body || typeof body.sub !== "string" || body.sub === "") return send(res, 400, { error: "sub is required" });
        const token = mint(body);
        return token ? send(res, 200, { access_token: token }) : send(res, 409, { error: "no such key yet" });
      }
      return send(res, 404, { error: "not part of the fake" });
    })().catch(() => send(res, 500, { error: "unexpected failure" }));
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, LOOPBACK, resolve);
  });
  issuer = `http://${LOOPBACK}:${server.address().port}/auth/v1`;
  return { url: `http://${LOOPBACK}:${server.address().port}`, close: () => new Promise((resolve) => server.close(resolve)) };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = Number(process.env.GATEWAY_CI_JWKS_PORT ?? 9999);
  startFakeJwks({ port })
    .then(({ url }) => console.log(`fake JWKS listening on ${url} (gateway CI only)`))
    .catch((error) => {
      console.error(error.message);
      process.exit(1);
    });
}
