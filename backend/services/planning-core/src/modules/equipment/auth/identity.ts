import { ZodError } from "zod";
import type { CurrentUser } from "@connectsphere/contracts";
import { lookUpCaller } from "../../identity/index.js";
import { sql } from "../../../shared/db.js";

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

/** Resolves the equipment caller through the identity module's public boundary. */
export async function resolveCurrentUser(supabaseUserId: string): Promise<CurrentUser> {
  let lookup;
  try {
    lookup = await lookUpCaller(sql, supabaseUserId);
  } catch (error) {
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
