import { describe, expect, it, vi } from "vitest";
import { CallerRefusedError, IdentityUnavailableError, resolveCaller } from "../../src/api/identity.js";

/**
 * T2: the notification service may not read identity's tables (ADR-0005,
 * ADR-0008), so it asks identity who the token belongs to: planning-core's
 * GET /api/v1/users/me, with the caller's own token.
 */

const BASE = "http://identity.test";
const user = { id: "00000000-0000-0000-0000-000000000001", email: "organiser@connectsphere.test", role: "EVENT_ORGANISER" };

function answering(status: number, body: unknown) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
}

describe("resolveCaller", () => {
  it("asks /users/me with the caller's own token and returns who they are", async () => {
    const fetcher = answering(200, user);
    expect(await resolveCaller("caller-token", { baseUrl: BASE, fetcher })).toEqual(user);
    expect(fetcher).toHaveBeenCalledWith(`${BASE}/api/v1/users/me`, {
      headers: { Authorization: "Bearer caller-token" },
      signal: expect.any(AbortSignal),
    });
  });

  it.each([
    [401, "UNAUTHENTICATED", "No active session for this token."],
    [403, "NO_ROLE_ASSIGNED", "This user has no assigned role."],
  ])("passes identity's %i refusal on, with its code and message", async (status, code, message) => {
    const fetcher = answering(status, { error: { code, message } });
    await expect(resolveCaller("t", { baseUrl: BASE, fetcher })).rejects.toMatchObject({ status, code, message });
    await expect(resolveCaller("t", { baseUrl: BASE, fetcher })).rejects.toBeInstanceOf(CallerRefusedError);
  });

  it("treats a refusal without identity's envelope as not signed in", async () => {
    const fetcher = answering(401, "nope");
    await expect(resolveCaller("t", { baseUrl: BASE, fetcher })).rejects.toMatchObject({
      status: 401,
      code: "UNAUTHENTICATED",
    });
  });

  it("is unavailable when identity cannot be reached", async () => {
    const fetcher = vi.fn(async () => {
      throw new Error("connect ECONNREFUSED");
    });
    await expect(resolveCaller("t", { baseUrl: BASE, fetcher })).rejects.toBeInstanceOf(IdentityUnavailableError);
  });

  it("is unavailable when identity fails or answers something that is not a user", async () => {
    await expect(resolveCaller("t", { baseUrl: BASE, fetcher: answering(500, {}) })).rejects.toBeInstanceOf(
      IdentityUnavailableError,
    );
    await expect(resolveCaller("t", { baseUrl: BASE, fetcher: answering(200, { id: "x" }) })).rejects.toBeInstanceOf(
      IdentityUnavailableError,
    );
  });
});
