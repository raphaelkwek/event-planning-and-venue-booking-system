import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRemoteJWKSet, decodeProtectedHeader, jwtVerify } from "jose";
import { ACCOUNTS, SEED_PASSWORD } from "./accounts.js";
import {
  FAKE_AUTH_FLAG,
  FAKE_AUTH_FLAG_VALUE,
  assertTestHarnessOnly,
  startFakeAuthServer,
  type FakeAuthServer,
} from "./fake-supabase-auth.js";

/**
 * EN-14's fake Supabase Auth server. These run in the unit job (npm run test:scripts): the
 * server binds to the loopback address and touches no database.
 */
const HARNESS_ENV = {
  [FAKE_AUTH_FLAG]: FAKE_AUTH_FLAG_VALUE,
  DATABASE_URL: "postgres://ci:ci@127.0.0.1:5432/connectsphere_e2e",
};
const ANON_KEY = "e2e-anon-key";
const WEB_ORIGIN = "http://127.0.0.1:4173";

describe("assertTestHarnessOnly", () => {
  it("allows the harness: the flag, and a database on this machine", () => {
    assert.doesNotThrow(() => assertTestHarnessOnly(HARNESS_ENV));
    assert.doesNotThrow(() => assertTestHarnessOnly({ ...HARNESS_ENV, DATABASE_URL: "postgres://ci:ci@localhost:5432/x" }));
  });

  it("refuses without the flag, or with any other value", () => {
    assert.throws(() => assertTestHarnessOnly({ DATABASE_URL: HARNESS_ENV.DATABASE_URL }), /browser tests only/);
    assert.throws(() => assertTestHarnessOnly({ ...HARNESS_ENV, [FAKE_AUTH_FLAG]: "1" }), /browser tests only/);
  });

  it("refuses a shared or remote database, a missing one, and a malformed one", () => {
    assert.throws(
      () => assertTestHarnessOnly({ ...HARNESS_ENV, DATABASE_URL: "postgres://u:p@db.abcdefgh.supabase.co:5432/postgres" }),
      /never a shared database/,
    );
    assert.throws(() => assertTestHarnessOnly({ ...HARNESS_ENV, DATABASE_URL: "" }), /throwaway Postgres/);
    assert.throws(() => assertTestHarnessOnly({ ...HARNESS_ENV, DATABASE_URL: "not a url" }), /not a URL/);
  });

  it("refuses a production process", () => {
    assert.throws(() => assertTestHarnessOnly({ ...HARNESS_ENV, NODE_ENV: "production" }), /production/);
  });
});

describe("the fake GoTrue endpoints", () => {
  let auth: FakeAuthServer;

  before(async () => {
    auth = await startFakeAuthServer({ port: 0, anonKey: ANON_KEY, allowedOrigins: [WEB_ORIGIN] }, HARNESS_ENV);
  });
  after(async () => {
    await auth.close();
  });

  const signIn = (email: string, password: string, apikey = ANON_KEY) =>
    fetch(`${auth.url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey },
      body: JSON.stringify({ email, password }),
    });

  it("listens on the loopback address only", () => {
    assert.match(auth.url, /^http:\/\/127\.0\.0\.1:\d+$/);
  });

  it("issues a token the services' own check accepts, with Supabase's claims", async () => {
    const response = await signIn(ACCOUNTS.coordinator.email, SEED_PASSWORD);
    assert.equal(response.status, 200);
    const body = (await response.json()) as { access_token: string; token_type: string; user: { id: string; email: string } };
    assert.equal(body.token_type, "bearer");
    assert.equal(body.user.id, ACCOUNTS.coordinator.authId);
    assert.equal(body.user.email, ACCOUNTS.coordinator.email);

    // The same verification planning-core runs (shared/auth/verifyJwt.ts).
    const jwks = createRemoteJWKSet(new URL(`${auth.url}/auth/v1/.well-known/jwks.json`));
    const { payload } = await jwtVerify(body.access_token, jwks);
    assert.equal(payload.sub, ACCOUNTS.coordinator.authId);
    assert.equal(payload.aud, "authenticated");
    assert.equal(payload.role, "authenticated");
    assert.equal(payload.email, ACCOUNTS.coordinator.email);
    assert.equal(payload.iss, `${auth.url}/auth/v1`);
    assert.equal(typeof payload.session_id, "string");
    assert.equal(decodeProtectedHeader(body.access_token).alg, "ES256");
  });

  it("refuses a wrong password and an unknown email the same way", async () => {
    const wrongPassword = await signIn(ACCOUNTS.organiser.email, "wrong");
    const unknownEmail = await signIn("nobody@connectsphere.test", SEED_PASSWORD);
    assert.equal(wrongPassword.status, 400);
    assert.equal(unknownEmail.status, 400);
    assert.deepEqual(await wrongPassword.json(), await unknownEmail.json());
  });

  it("refuses a request without the anon key", async () => {
    const response = await signIn(ACCOUNTS.organiser.email, SEED_PASSWORD, "wrong-key");
    assert.equal(response.status, 401);
  });

  it("returns the user for a live session, and refuses it after logout", async () => {
    const { access_token: token } = (await (await signIn(ACCOUNTS.venuestaff.email, SEED_PASSWORD)).json()) as {
      access_token: string;
    };
    const headers = { apikey: ANON_KEY, Authorization: `Bearer ${token}` };

    const user = await fetch(`${auth.url}/auth/v1/user`, { headers });
    assert.equal(user.status, 200);
    assert.equal(((await user.json()) as { id: string }).id, ACCOUNTS.venuestaff.authId);

    const logout = await fetch(`${auth.url}/auth/v1/logout`, { method: "POST", headers });
    assert.equal(logout.status, 204);

    const afterLogout = await fetch(`${auth.url}/auth/v1/user`, { headers });
    assert.equal(afterLogout.status, 403);
  });

  it("refuses a token it did not sign", async () => {
    const forged = "eyJhbGciOiJFUzI1NiJ9.eyJzdWIiOiJ4In0.c2lnbmF0dXJl";
    const response = await fetch(`${auth.url}/auth/v1/user`, {
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${forged}` },
    });
    assert.equal(response.status, 403);
  });

  it("answers CORS preflights from the web app's origin only", async () => {
    const preflight = (origin: string) =>
      fetch(`${auth.url}/auth/v1/token?grant_type=password`, {
        method: "OPTIONS",
        headers: { Origin: origin, "Access-Control-Request-Method": "POST" },
      });
    const allowed = await preflight(WEB_ORIGIN);
    assert.equal(allowed.status, 204);
    assert.equal(allowed.headers.get("access-control-allow-origin"), WEB_ORIGIN);

    const other = await preflight("https://example.com");
    assert.equal(other.status, 403);
    assert.equal(other.headers.get("access-control-allow-origin"), null);
  });

  it("implements only the password grant", async () => {
    const response = await fetch(`${auth.url}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: ANON_KEY },
      body: JSON.stringify({ refresh_token: "x" }),
    });
    assert.equal(response.status, 400);
  });
});
