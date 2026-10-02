import { ZodError } from "zod";
import type { AccessScope, CurrentUser } from "@connectsphere/contracts";
import { lookUpCaller, resolveAccessScope } from "../../identity/index.js";
import { sql } from "../../../shared/db.js";

/**
 * Who is calling, and what access-scope rule applies to them for events (A2, A3).
 *
 * The scope rule is the identity module's to own and is deliberately not
 * reimplemented here. Until ADR-0004 this was an HTTP call to a separate
 * Identity service; it is now a function call through the identity module's
 * public interface, in the same process, so no request crosses a network
 * inside the core. If identity's records cannot be read the caller's scope is
 * unknown, and under CP (plan.md §2) the request is refused rather than
 * guessed at.
 */
export class IdentityUnavailableError extends Error {
  constructor(cause: string) {
    super(`Identity records could not be read: ${cause}`);
    this.name = "IdentityUnavailableError";
  }
}

export class IdentityRefusedError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "IdentityRefusedError";
  }
}

export async function resolveCurrentUser(supabaseUserId: string): Promise<CurrentUser> {
  let lookup;
  try {
    lookup = await lookUpCaller(sql, supabaseUserId);
  } catch (error) {
    // A malformed identity record is a defect to surface, not an outage.
    if (error instanceof ZodError) throw error;
    throw new IdentityUnavailableError((error as Error).message);
  }

  if (lookup.outcome === "NO_ACTIVE_USER") {
    throw new IdentityRefusedError(401, "UNAUTHENTICATED", "No active session for this token.");
  }
  if (lookup.outcome === "NO_ROLE") {
    throw new IdentityRefusedError(403, "NO_ROLE_ASSIGNED", "This user has no assigned role.");
  }
  return lookup.user;
}

export async function resolveEventsScope(user: CurrentUser): Promise<AccessScope> {
  return resolveAccessScope(user.role, user.id, "events");
}
