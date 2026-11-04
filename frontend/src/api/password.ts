import { ApiError } from "./client.js";

/**
 * ADR-0016: an invited Lead (npm run lead:create) and anyone who asks for a password reset arrive
 * from a Supabase Auth email link. Supabase sends them back to the web app with a short-lived
 * session in the address bar's fragment (#access_token=…&type=invite or type=recovery), or an
 * error (#error=…&error_description=…). The Set your password screen reads it from there.
 */
export const SET_PASSWORD_PATH = "/set-password";

/** Supabase Auth's default minimum. A project can raise it; its refusal is then shown as it comes. */
export const MIN_PASSWORD_LENGTH = 6;

export type AuthLink = { kind: "session"; accessToken: string; type: string } | { kind: "error"; message: string };

/**
 * The session or error a Supabase Auth link carries. The fragment may be the whole hash
 * (#access_token=…, when Supabase returns to the site root) or follow the route
 * (#/set-password#access_token=…). Anything else is not a link from Supabase.
 */
export function parseAuthLink(hash: string): AuthLink | null {
  const segments = hash.split("#").reverse();
  for (const segment of segments) {
    const params = new URLSearchParams(segment);
    const accessToken = params.get("access_token");
    if (accessToken) return { kind: "session", accessToken, type: params.get("type") ?? "" };
    const error = params.get("error_description") ?? params.get("error");
    if (error) return { kind: "error", message: error };
  }
  return null;
}

/**
 * Where the router should be for a Supabase link that came back to the site root: the Set your
 * password screen, with the link's fragment kept after it. Null when nothing needs to move.
 */
export function setPasswordHash(hash: string): string | null {
  if (!parseAuthLink(hash) || hash.startsWith(`#${SET_PASSWORD_PATH}`)) return null;
  return `#${SET_PASSWORD_PATH}#${hash.slice(hash.lastIndexOf("#") + 1)}`;
}

/** Why a new password cannot be sent yet, or null when it can. */
export function passwordProblem(password: string, confirmation: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (password !== confirmation) return "The two passwords do not match.";
  return null;
}

/**
 * Sets the signed-in user's password with the link's session: the request
 * supabase.auth.updateUser({ password }) sends (PUT /auth/v1/user). The app talks to Supabase
 * Auth over fetch elsewhere too (api/session.ts), so no client library is added for it.
 */
export async function setPassword(accessToken: string, password: string): Promise<void> {
  const response = await fetch(`${__SUPABASE_URL__}/auth/v1/user`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", apikey: __SUPABASE_ANON_KEY__, Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ password }),
  });
  if (response.ok) return;
  const body = (await response.json().catch(() => ({}))) as { msg?: string; message?: string; error_description?: string; error_code?: string };
  throw new ApiError(response.status, {
    code: body.error_code ?? (response.status === 401 ? "UNAUTHENTICATED" : "UNKNOWN"),
    message:
      response.status === 401
        ? "This link has expired or was already used. Ask for a new invite or password reset."
        : (body.msg ?? body.message ?? body.error_description ?? "Supabase refused the new password."),
    correlationId: null,
  });
}
