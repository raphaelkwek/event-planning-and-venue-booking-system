import { identityConfig } from "../config.js";

/** Supabase Auth is a remote dependency: a call that hangs must fail rather than hold the request open. */
const AUTH_TIMEOUT_MS = Number(process.env.SUPABASE_AUTH_TIMEOUT_MS ?? 5000);

export interface PasswordGrantResult {
  ok: true;
  supabaseUserId: string;
}
export interface PasswordGrantFailure {
  ok: false;
}

export async function signInWithPassword(
  email: string,
  password: string
): Promise<PasswordGrantResult | PasswordGrantFailure> {
  const res = await fetch(`${identityConfig.supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: identityConfig.supabaseAnonKey },
    body: JSON.stringify({ email, password }),
    signal: AbortSignal.timeout(AUTH_TIMEOUT_MS),
  });

  if (!res.ok) {
    return { ok: false };
  }

  const body = (await res.json()) as { user?: { id?: string } };
  if (!body.user?.id) {
    return { ok: false };
  }

  return { ok: true, supabaseUserId: body.user.id };
}

export async function revokeSession(accessToken: string): Promise<void> {
  await fetch(`${identityConfig.supabaseUrl}/auth/v1/logout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: identityConfig.supabaseAnonKey,
      Authorization: `Bearer ${accessToken}`,
    },
    signal: AbortSignal.timeout(AUTH_TIMEOUT_MS),
  });
}
