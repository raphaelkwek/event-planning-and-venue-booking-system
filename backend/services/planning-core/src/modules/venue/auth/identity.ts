import { ZodError } from "zod";
import type { AccessScope, CurrentUser, Role } from "@connectsphere/contracts";
import { lookUpCaller, resolveAccessScope } from "../../identity/index.js";
import { sql } from "../../../shared/db.js";

/**
 * Who is calling the venue module (A2): their internal user id and role, from
 * the identity module's public interface, in the same process (ADR-0004). If
 * identity's records cannot be read the caller's role is unknown, and under CP
 * the request is refused rather than guessed at.
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
    readonly code: "UNAUTHENTICATED" | "NO_ROLE_ASSIGNED",
    message: string,
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

/** The scope rule for events (A3), from the identity module, so K1 reads an event only as its caller may. */
export function resolveEventsScope(role: Role, userId: string): AccessScope {
  return resolveAccessScope(role, userId, "events");
}
