/*
 * Copied from the EN-14 browser tests' stack (pull request #79, tests/e2e/support/), which is not
 * merged yet. The load tests use it for the one thing registration verifies itself: browsing
 * (GET /api/v1/open-events) checks a Supabase token against the signing keys. Once #79 merges, import it
 * from tests/e2e/support/ and delete this copy. CI-only: assertTestHarnessOnly refuses any
 * database that is not on this machine.
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { generateKeyPairSync, randomBytes, randomUUID, sign, verify, type KeyObject } from "node:crypto";
import type { AddressInfo } from "node:net";
import { ACCOUNTS, SEED_PASSWORD } from "./accounts.js";

/**
 * A stand-in for Supabase Auth (GoTrue), for the browser tests' throwaway CI stack only (EN-14).
 *
 * The real stack signs people in through the team's hosted Supabase project, which CI must
 * never touch. This server implements just the GoTrue endpoints ConnectSphere calls:
 *
 * - `POST /auth/v1/token?grant_type=password`: the browser (frontend/src/api/session.ts) and
 *   identity's login route (modules/identity/auth/supabaseAuthClient.ts) both call it.
 * - `GET /auth/v1/user` and `POST /auth/v1/logout` (identity's logout route).
 * - `GET /auth/v1/.well-known/jwks.json`: every service verifies tokens against it
 *   (SUPABASE_JWKS_URL, shared/auth/verifyJwt.ts).
 *
 * It generates a fresh ES256 key pair each time it starts, knows only the seeded accounts and
 * their published test password, and issues access tokens with the claims Supabase puts in
 * one. It refuses to start unless `assertTestHarnessOnly` passes, and it listens on the
 * loopback address only, so nothing off the machine can reach it.
 */

export const FAKE_AUTH_FLAG = "E2E_FAKE_AUTH";
export const FAKE_AUTH_FLAG_VALUE = "enabled-for-the-browser-tests";
const LOOPBACK = "127.0.0.1";
const TOKEN_LIFETIME_SECONDS = 3600;

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

/**
 * Throws unless this is the browser-test harness: the flag is set to its exact value, the
 * process is not a production one, and the database is the machine's own throwaway one.
 * The last check is what keeps the fake from ever standing beside the shared database.
 */
export function assertTestHarnessOnly(env: Record<string, string | undefined>): void {
  if (env[FAKE_AUTH_FLAG] !== FAKE_AUTH_FLAG_VALUE) {
    throw new Error(`The fake Supabase Auth server is for the browser tests only: set ${FAKE_AUTH_FLAG}=${FAKE_AUTH_FLAG_VALUE}.`);
  }
  if (env.NODE_ENV === "production") {
    throw new Error("The fake Supabase Auth server never runs with NODE_ENV=production.");
  }
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL must point at a throwaway Postgres on this machine.");
  }
  let host: string;
  try {
    host = new URL(databaseUrl).hostname;
  } catch {
    throw new Error("DATABASE_URL is not a URL.");
  }
  if (!LOOPBACK_HOSTS.has(host)) {
    throw new Error("DATABASE_URL must point at a throwaway Postgres on this machine, never a shared database.");
  }
}

export interface FakeAuthOptions {
  port: number;
  anonKey: string;
  /** The web app's origins, the only ones the browser may call from. */
  allowedOrigins: string[];
}

export interface FakeAuthServer {
  url: string;
  server: Server;
  close(): Promise<void>;
}

interface Session {
  sessionId: string;
  authId: string;
  revoked: boolean;
}

interface Claims {
  sub: string;
  session_id: string;
  exp: number;
  [claim: string]: unknown;
}

const base64url = (input: Buffer | string) => Buffer.from(input).toString("base64url");

function signToken(privateKey: KeyObject, kid: string, claims: Record<string, unknown>): string {
  const header = base64url(JSON.stringify({ alg: "ES256", kid, typ: "JWT" }));
  const payload = base64url(JSON.stringify(claims));
  const signature = sign("sha256", Buffer.from(`${header}.${payload}`), { key: privateKey, dsaEncoding: "ieee-p1363" });
  return `${header}.${payload}.${base64url(signature)}`;
}

function readToken(publicKey: KeyObject, token: string): Claims | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts as [string, string, string];
  const valid = verify(
    "sha256",
    Buffer.from(`${header}.${payload}`),
    { key: publicKey, dsaEncoding: "ieee-p1363" },
    Buffer.from(signature, "base64url"),
  );
  if (!valid) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Claims;
    return claims.exp > Math.floor(Date.now() / 1000) ? claims : null;
  } catch {
    return null;
  }
}

function userObject(authId: string, email: string, signedInAt: string) {
  return {
    id: authId,
    aud: "authenticated",
    role: "authenticated",
    email,
    email_confirmed_at: "2026-09-01T00:00:00.000Z",
    phone: "",
    confirmed_at: "2026-09-01T00:00:00.000Z",
    last_sign_in_at: signedInAt,
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: {},
    identities: [],
    created_at: "2026-09-01T00:00:00.000Z",
    updated_at: signedInAt,
    is_anonymous: false,
  };
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown> | null> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function send(res: ServerResponse, status: number, body?: unknown) {
  if (body === undefined) {
    res.writeHead(status).end();
    return;
  }
  res.writeHead(status, { "Content-Type": "application/json" }).end(JSON.stringify(body));
}

const gotrueError = (status: number, errorCode: string, msg: string) => ({ code: status, error_code: errorCode, msg });

export async function startFakeAuthServer(options: FakeAuthOptions, env = process.env): Promise<FakeAuthServer> {
  assertTestHarnessOnly(env);
  if (!options.anonKey) throw new Error("SUPABASE_ANON_KEY must be set: the fake checks it as Supabase does.");

  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const kid = randomUUID();
  const jwk = { ...publicKey.export({ format: "jwk" }), kid, alg: "ES256", use: "sig", key_ops: ["verify"] };
  const sessions = new Map<string, Session>();
  const accountsByEmail = new Map(Object.values(ACCOUNTS).map((account) => [account.email, account]));
  let issuer = "";

  function bearerClaims(req: IncomingMessage): Claims | null {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) return null;
    return readToken(publicKey, header.slice("Bearer ".length));
  }

  async function passwordGrant(req: IncomingMessage, res: ServerResponse) {
    const body = await readJson(req);
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const account = accountsByEmail.get(email);
    if (!account || body?.password !== SEED_PASSWORD) {
      send(res, 400, gotrueError(400, "invalid_credentials", "Invalid login credentials"));
      return;
    }

    const now = Math.floor(Date.now() / 1000);
    const session: Session = { sessionId: randomUUID(), authId: account.authId, revoked: false };
    sessions.set(session.sessionId, session);
    const signedInAt = new Date(now * 1000).toISOString();
    const accessToken = signToken(privateKey, kid, {
      iss: issuer,
      sub: account.authId,
      aud: "authenticated",
      exp: now + TOKEN_LIFETIME_SECONDS,
      iat: now,
      email: account.email,
      phone: "",
      app_metadata: { provider: "email", providers: ["email"] },
      user_metadata: {},
      role: "authenticated",
      aal: "aal1",
      amr: [{ method: "password", timestamp: now }],
      session_id: session.sessionId,
      is_anonymous: false,
    });

    send(res, 200, {
      access_token: accessToken,
      token_type: "bearer",
      expires_in: TOKEN_LIFETIME_SECONDS,
      expires_at: now + TOKEN_LIFETIME_SECONDS,
      refresh_token: randomBytes(16).toString("hex"),
      user: userObject(account.authId, account.email, signedInAt),
    });
  }

  function currentUser(req: IncomingMessage, res: ServerResponse) {
    const claims = bearerClaims(req);
    if (!claims) {
      send(res, 403, gotrueError(403, "bad_jwt", "invalid JWT: unable to parse or verify signature"));
      return;
    }
    if (sessions.get(claims.session_id)?.revoked !== false) {
      send(res, 403, gotrueError(403, "session_not_found", "Session from session_id claim in JWT does not exist"));
      return;
    }
    const account = Object.values(ACCOUNTS).find((candidate) => candidate.authId === claims.sub);
    send(res, 200, userObject(claims.sub, account?.email ?? "", new Date().toISOString()));
  }

  function logout(req: IncomingMessage, res: ServerResponse) {
    const claims = bearerClaims(req);
    if (!claims) {
      send(res, 403, gotrueError(403, "bad_jwt", "invalid JWT: unable to parse or verify signature"));
      return;
    }
    const session = sessions.get(claims.session_id);
    if (session) session.revoked = true;
    send(res, 204);
  }

  async function handle(req: IncomingMessage, res: ServerResponse) {
    const origin = req.headers.origin;
    if (origin && options.allowedOrigins.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Headers", "authorization, apikey, content-type, x-client-info");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    }
    if (req.method === "OPTIONS") {
      send(res, origin && options.allowedOrigins.includes(origin) ? 204 : 403);
      return;
    }

    const url = new URL(req.url ?? "/", issuer);
    const route = `${req.method} ${url.pathname}`;

    if (route === "GET /auth/v1/.well-known/jwks.json") return send(res, 200, { keys: [jwk] });
    if (route === "GET /auth/v1/health") return send(res, 200, { name: "fake-gotrue", description: "ConnectSphere browser tests only" });

    if (req.headers.apikey !== options.anonKey) {
      send(res, 401, { message: "No API key found in request" });
      return;
    }
    if (route === "POST /auth/v1/token") {
      if (url.searchParams.get("grant_type") !== "password") {
        send(res, 400, gotrueError(400, "unsupported_grant_type", "Only the password grant is implemented"));
        return;
      }
      return passwordGrant(req, res);
    }
    if (route === "GET /auth/v1/user") return currentUser(req, res);
    if (route === "POST /auth/v1/logout") return logout(req, res);
    send(res, 404, gotrueError(404, "not_found", "This endpoint is not part of the fake"));
  }

  const server = createServer((req, res) => {
    handle(req, res).catch(() => send(res, 500, gotrueError(500, "unexpected_failure", "Unexpected failure")));
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port, LOOPBACK, () => resolve());
  });
  const { port } = server.address() as AddressInfo;
  const url = `http://${LOOPBACK}:${port}`;
  issuer = `${url}/auth/v1`;

  return {
    url,
    server,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
