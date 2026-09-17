import {
  accessScopeSchema,
  currentUserSchema,
  type AccessScope,
  type CurrentUser,
} from "@connectsphere/contracts";
import { config } from "../config.js";

/**
 * The one synchronous hop this service makes to Identity (plan.md §5): who is
 * calling, and what access-scope rule applies to them for events (A3).
 *
 * The scope rule is Identity's to own and is deliberately not reimplemented
 * here. If Identity cannot be reached the caller's scope is unknown, and under
 * CP (plan.md §2) the request is refused rather than guessed at.
 */
export class IdentityUnavailableError extends Error {
  constructor(cause: string) {
    super(`Identity service could not be reached: ${cause}`);
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

async function callIdentity(path: string, token: string, correlationId: string | null) {
  let response: Response;

  try {
    response = await fetch(`${config.identityBaseUrl}${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        ...(correlationId ? { "X-Correlation-Id": correlationId } : {}),
      },
    });
  } catch (error) {
    throw new IdentityUnavailableError((error as Error).message);
  }

  if (response.status >= 500) {
    throw new IdentityUnavailableError(`responded ${response.status}`);
  }

  const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;

  if (!response.ok) {
    const error = (body as { error?: { code?: string; message?: string } } | null)?.error;
    throw new IdentityRefusedError(
      response.status,
      error?.code ?? "UNAUTHENTICATED",
      error?.message ?? "Identity refused this token."
    );
  }

  return body;
}

export async function fetchCurrentUser(
  token: string,
  correlationId: string | null
): Promise<CurrentUser> {
  return currentUserSchema.parse(await callIdentity("/api/v1/users/me", token, correlationId));
}

export async function fetchEventsScope(
  token: string,
  correlationId: string | null
): Promise<AccessScope> {
  const body = await callIdentity("/api/v1/access-scope/events", token, correlationId);
  return accessScopeSchema.parse((body as { scope: unknown }).scope);
}
