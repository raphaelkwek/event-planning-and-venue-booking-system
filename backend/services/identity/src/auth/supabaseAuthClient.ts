import { config } from "../config.js";

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
  const res = await fetch(`${config.supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: config.supabaseAnonKey },
    body: JSON.stringify({ email, password }),
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
  await fetch(`${config.supabaseUrl}/auth/v1/logout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: config.supabaseAnonKey,
      Authorization: `Bearer ${accessToken}`,
    },
  });
}
