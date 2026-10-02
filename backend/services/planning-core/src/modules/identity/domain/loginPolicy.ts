export type LoginOutcome =
  | { decision: "SUCCESS"; userId: string }
  | { decision: "INVALID_CREDENTIALS" }
  | { decision: "DEACTIVATED_ACCOUNT"; userId: string };

export interface IdentityUserRecord {
  id: string;
  isActive: boolean;
}

/**
 * Pure decision: given that Supabase Auth has already confirmed the
 * credentials are correct, and the matching identity.users row (or lack
 * of one), decide the login outcome. Credential correctness itself is
 * Supabase Auth's job (A1 AC2) — this only runs after Supabase Auth has
 * confirmed the credentials are valid for this supabaseUserId.
 */
export function decideLoginOutcome(user: IdentityUserRecord | null): LoginOutcome {
  if (!user) {
    return { decision: "INVALID_CREDENTIALS" };
  }
  if (!user.isActive) {
    return { decision: "DEACTIVATED_ACCOUNT", userId: user.id };
  }
  return { decision: "SUCCESS", userId: user.id };
}
