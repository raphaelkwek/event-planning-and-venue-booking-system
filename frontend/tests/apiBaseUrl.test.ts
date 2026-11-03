import { afterEach, describe, expect, it, vi } from "vitest";
import { apiUrl, rawRequest } from "../src/api/client.js";

/**
 * DEPLOY-T10 (ADR-0016): built for Vercel, the app sends its API calls to the
 * API origin the build names (VITE_API_BASE_URL); built without one, as on a
 * laptop and in the nginx image, every call stays a relative path.
 */

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the API origin", () => {
  it("DEPLOY-T10 with a base URL a request goes to <base>/identity/api/v1/...", () => {
    expect(apiUrl("/identity/api/v1/users/me", "https://api.staging.203.0.113.10.sslip.io")).toBe(
      "https://api.staging.203.0.113.10.sslip.io/identity/api/v1/users/me"
    );
    expect(apiUrl("/notification/api/v1/notifications", "https://api.example.org")).toBe(
      "https://api.example.org/notification/api/v1/notifications"
    );
    // An absolute URL, such as Supabase's, is left alone.
    expect(apiUrl("https://ref.supabase.co/auth/v1/token", "https://api.example.org")).toBe("https://ref.supabase.co/auth/v1/token");
  });

  it("DEPLOY-T10 with the default empty base the path stays relative", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "x-correlation-id": "c-1" } }));
    vi.stubGlobal("fetch", fetchMock);

    expect(apiUrl("/identity/api/v1/users/me")).toBe("/identity/api/v1/users/me");
    const result = await rawRequest("/identity/api/v1/users/me", { token: "t" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/identity/api/v1/users/me", expect.objectContaining({ method: "GET" }));
    expect(result).toEqual({ status: 200, body: { ok: true }, correlationId: "c-1" });
  });
});
