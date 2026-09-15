import { ApiError, request } from "./client.js";
import type { Role } from "./types.js";

/**
 * A1 — logging in.
 *
 * Two calls, because of the shape of the API. Identity's login endpoint owns
 * A1's rules — the same message for a wrong email as for a wrong password, a
 * deactivated account distinguishable from bad credentials, the login audit
 * row and the last-login timestamp — but it returns the user and role rather
 * than a token. So Identity is asked first and a refusal stops there, which is
 * what keeps a deactivated account from ever reaching Supabase for a token.
 */
export interface Session {
  userId: string;
  email: string;
  role: Role;
  token: string;
  lastLoginAt: string;
}

interface IdentityLoginResponse {
  user: { id: string; email: string; role: Role };
  lastLoginAt: string;
}

async function supabaseToken(email: string, password: string): Promise<string> {
  const response = await fetch(`${__SUPABASE_URL__}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: __SUPABASE_ANON_KEY__ },
    body: JSON.stringify({ email, password }),
  });

  const body = (await response.json()) as { access_token?: string };
  if (!body.access_token) {
    throw new ApiError(401, {
      code: "INVALID_CREDENTIALS",
      message: "email or password is incorrect",
      correlationId: null,
    });
  }
  return body.access_token;
}

export async function logIn(email: string, password: string): Promise<Session> {
  const identity = await request<IdentityLoginResponse>("/identity/api/v1/auth/login", {
    method: "POST",
    body: { email, password },
  });

  return {
    userId: identity.user.id,
    email: identity.user.email,
    role: identity.user.role,
    lastLoginAt: identity.lastLoginAt,
    token: await supabaseToken(email, password),
  };
}

export async function logOut(token: string): Promise<void> {
  await request("/identity/api/v1/auth/logout", { method: "POST", token });
}

const STORAGE_KEY = "connectsphere.session";

export function rememberSession(session: Session | null) {
  try {
    if (session) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // A session that cannot be remembered is not a reason to fail the login.
  }
}

export function recallSession(): Session | null {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    return stored ? (JSON.parse(stored) as Session) : null;
  } catch {
    return null;
  }
}
