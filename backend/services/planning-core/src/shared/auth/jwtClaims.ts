/**
 * The `iss` and `aud` a bearer token must carry. Supabase Auth issues access
 * tokens with `aud: "authenticated"` and `iss: "<SUPABASE_URL>/auth/v1"`, so both
 * default from configuration. They are settings rather than constants because a
 * stand-in auth server (the CI-only fake used for end-to-end runs) may name
 * itself differently: set JWT_ISSUER / JWT_AUDIENCE to match it, or to an empty
 * string to stop checking that claim.
 */
export interface ExpectedClaims {
  issuer?: string;
  audience?: string;
}

export function expectedClaims(env: Record<string, string | undefined>): ExpectedClaims {
  const supabaseUrl = env.SUPABASE_URL?.trim().replace(/\/+$/, "");
  const issuer = env.JWT_ISSUER ?? (supabaseUrl ? `${supabaseUrl}/auth/v1` : undefined);
  const audience = env.JWT_AUDIENCE ?? "authenticated";
  return {
    ...(issuer ? { issuer } : {}),
    ...(audience ? { audience } : {}),
  };
}
