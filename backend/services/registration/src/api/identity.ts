import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { currentUserSchema, type CurrentUser } from "@connectsphere/contracts";
import { config } from "../config.js";
import { CallerRefusedError, IdentityUnavailableError, type Authenticator } from "./auth.js";

/**
 * The real Authenticator: Supabase's signing keys for browsing, and identity's
 * GET /api/v1/users/me for everything that needs the attendee. Tests pass a
 * fake instead.
 */

let jwks: JWTVerifyGetKey | null = null;

/** Built on first use, so the app can be imported (and its routes listed) without the setting. */
function keys(): JWTVerifyGetKey {
  if (!config.supabaseJwksUrl) throw new Error("SUPABASE_JWKS_URL is not set, so no token can be verified.");
  jwks ??= createRemoteJWKSet(new URL(config.supabaseJwksUrl));
  return jwks;
}

type Fetcher = (url: string, init: { headers: Record<string, string>; signal: AbortSignal }) => Promise<Response>;

export async function identifyCaller(
  token: string,
  { baseUrl = config.planningCoreUrl, fetcher = fetch as Fetcher }: { baseUrl?: string; fetcher?: Fetcher } = {},
): Promise<CurrentUser> {
  let response: Response;
  try {
    response = await fetcher(`${baseUrl}/api/v1/users/me`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(5000) });
  } catch (error) {
    throw new IdentityUnavailableError((error as Error).message);
  }
  const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
  if (response.status === 401 || response.status === 403) {
    const forbidden = response.status === 403;
    throw new CallerRefusedError(
      response.status,
      forbidden ? "NO_ROLE_ASSIGNED" : "UNAUTHENTICATED",
      body?.error?.message ?? (forbidden ? "This user has no assigned role." : "No active session for this token."),
    );
  }
  const user = currentUserSchema.safeParse(body);
  if (!response.ok || !user.success) throw new IdentityUnavailableError(`identity answered ${response.status}`);
  return user.data;
}

export const supabaseAuthenticator: Authenticator = {
  async verifyToken(token) {
    const { payload } = await jwtVerify(token, keys());
    if (typeof payload.sub !== "string") throw new Error("The token has no subject.");
  },
  identify: (token) => identifyCaller(token),
};
