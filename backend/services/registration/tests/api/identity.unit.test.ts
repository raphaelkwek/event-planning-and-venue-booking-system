import { describe, expect, it, vi } from "vitest";
import { identifyCaller, supabaseAuthenticator } from "../../src/api/identity.js";
import { CallerRefusedError, IdentityUnavailableError } from "../../src/api/auth.js";

/**
 * Asking identity who a bearer token belongs to (R2 to R7): what the service
 * makes of each answer. A refusal from identity is passed on as the caller's
 * 401 or 403; anything else is "identity is unavailable", which is 503, never
 * a guess about who the caller is. Fetch is scripted; no network.
 */

const USER = { id: "00000000-0000-0000-0000-000000000005", email: "attendee@connectsphere.test", role: "ATTENDEE" };
const answer = (status: number, body: unknown) => async () => new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
const ask = (fetcher: unknown) => identifyCaller("tok", { baseUrl: "http://core.test", fetcher: fetcher as never });

describe("identifyCaller", () => {
  it("returns the user identity names, sending the caller's own bearer token to /api/v1/users/me", async () => {
    const fetcher = vi.fn(answer(200, USER));
    await expect(ask(fetcher)).resolves.toEqual(USER);
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, { headers: Record<string, string>; signal: AbortSignal }];
    expect(url).toBe("http://core.test/api/v1/users/me");
    expect(init.headers).toEqual({ Authorization: "Bearer tok" });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("passes identity's 401 on as UNAUTHENTICATED with its message", async () => {
    const error = await ask(answer(401, { error: { message: "Session expired." } })).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(CallerRefusedError);
    expect(error).toMatchObject({ status: 401, code: "UNAUTHENTICATED", message: "Session expired." });
  });

  it("passes identity's 403 on as NO_ROLE_ASSIGNED, with a default message when it gave none", async () => {
    const error = await ask(answer(403, "not json")).catch((e: unknown) => e);
    expect(error).toMatchObject({ status: 403, code: "NO_ROLE_ASSIGNED", message: "This user has no assigned role." });
    const unauth = await ask(answer(401, {})).catch((e: unknown) => e);
    expect(unauth).toMatchObject({ code: "UNAUTHENTICATED", message: "No active session for this token." });
  });

  it.each([
    ["a server error", answer(500, { error: { message: "boom" } })],
    ["an answer that is not a user", answer(200, { id: 7 })],
    ["an answer that is not JSON", answer(200, "<html>")],
  ])("treats %s as identity being unavailable", async (_why, fetcher) => {
    const error = await ask(fetcher).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(IdentityUnavailableError);
  });

  it("treats a network failure or timeout as identity being unavailable, keeping the cause", async () => {
    const error = await ask((async () => {
      throw new Error("connect ECONNREFUSED");
    })).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(IdentityUnavailableError);
    expect((error as Error).message).toContain("ECONNREFUSED");
  });
});

describe("supabaseAuthenticator", () => {
  it("cannot verify a token when the JWKS url is not configured, rather than accepting it", async () => {
    await expect(supabaseAuthenticator.verifyToken("not-a-jwt")).rejects.toThrow();
  });
});
