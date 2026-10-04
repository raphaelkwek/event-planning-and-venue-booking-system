import { currentUserSchema, type CurrentUser } from "@connectsphere/contracts";
import { config } from "../config.js";

/**
 * Who the caller is (T2). The notification service may not read identity's
 * tables (ADR-0005, ADR-0008), so it asks identity: planning-core's
 * GET /api/v1/users/me, with the caller's own token. Identity verifies the
 * token, so an expired or revoked one is refused there. If identity cannot be
 * reached the caller is unknown, and under CP the request is refused rather
 * than guessed at.
 */

export class CallerRefusedError extends Error {
  constructor(
    readonly status: 401 | 403,
    readonly code: "UNAUTHENTICATED" | "NO_ROLE_ASSIGNED",
    message: string,
  ) {
    super(message);
    this.name = "CallerRefusedError";
  }
}

export class IdentityUnavailableError extends Error {
  constructor(cause: string) {
    super(`Identity could not be asked who this is: ${cause}`);
    this.name = "IdentityUnavailableError";
  }
}

type Fetcher = (url: string, init: { headers: Record<string, string>; signal: AbortSignal }) => Promise<Response>;

export async function resolveCaller(
  token: string,
  { baseUrl = config.planningCoreUrl, fetcher = fetch as Fetcher }: { baseUrl?: string; fetcher?: Fetcher } = {},
): Promise<CurrentUser> {
  let response: Response;
  try {
    response = await fetcher(`${baseUrl}/api/v1/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    });
  } catch (error) {
    throw new IdentityUnavailableError((error as Error).message);
  }

  const body = (await response.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
  if (response.status === 401 || response.status === 403) {
    const forbidden = response.status === 403;
    throw new CallerRefusedError(
      response.status,
      forbidden ? "NO_ROLE_ASSIGNED" : "UNAUTHENTICATED",
      body?.error?.message ?? (forbidden ? "This user has no assigned role." : "No active session for this token."),
    );
  }
  const user = currentUserSchema.safeParse(body);
  if (!response.ok || !user.success) {
    throw new IdentityUnavailableError(`identity answered ${response.status}`);
  }
  return user.data;
}
