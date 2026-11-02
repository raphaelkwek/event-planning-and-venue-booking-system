import { userSummarySchema, type UserSummary } from "@connectsphere/contracts";
import { config } from "../config.js";
import { IdentityUnavailableError } from "./auth.js";

/**
 * R5 to R7 — people by name. This service stores only user ids (ADR-0005) and
 * may not read identity's tables, so it asks planning-core's identity module
 * over HTTP, with the organiser's or coordinator's own token:
 * - GET /api/v1/users?ids=… names the attendees on a page of the list (R5, R6);
 * - GET /api/v1/attendees?email=… finds the attendee an organiser adds (R7).
 * Never inside a transaction (implementation.md §11). Names are looked up when
 * the list is read, not copied at registration, so a renamed attendee shows
 * their current name and no personal data is duplicated here.
 */

export interface Directory {
  /** The named users among `ids`, keyed by id; rejects with IdentityUnavailableError. */
  namesOf(token: string, ids: readonly string[]): Promise<Map<string, UserSummary>>;
  /** The active attendee with this email, or null; rejects with IdentityUnavailableError. */
  attendeeByEmail(token: string, email: string): Promise<UserSummary | null>;
}

type Fetcher = (url: string, init: { headers: Record<string, string>; signal: AbortSignal }) => Promise<Response>;

const itemsSchema = userSummarySchema.array();
/** identity's GET /api/v1/users takes at most 100 ids at once. */
const IDS_PER_CALL = 100;

async function ask(fetcher: Fetcher, url: string, token: string): Promise<UserSummary[]> {
  let response: Response;
  try {
    response = await fetcher(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(5000) });
  } catch (error) {
    throw new IdentityUnavailableError((error as Error).message);
  }
  const body = (await response.json().catch(() => null)) as { items?: unknown } | null;
  const items = itemsSchema.safeParse(body?.items);
  if (!response.ok || !items.success) throw new IdentityUnavailableError(`identity answered ${response.status}`);
  return items.data;
}

export function planningCoreDirectory({ baseUrl = config.planningCoreUrl, fetcher = fetch as Fetcher } = {}): Directory {
  return {
    async namesOf(token, ids) {
      const unique = [...new Set(ids)];
      const found = new Map<string, UserSummary>();
      for (let i = 0; i < unique.length; i += IDS_PER_CALL) {
        const batch = unique.slice(i, i + IDS_PER_CALL);
        for (const user of await ask(fetcher, `${baseUrl}/api/v1/users?ids=${batch.join(",")}`, token)) found.set(user.id, user);
      }
      return found;
    },
    async attendeeByEmail(token, email) {
      const [attendee] = await ask(fetcher, `${baseUrl}/api/v1/attendees?email=${encodeURIComponent(email)}`, token);
      return attendee ?? null;
    },
  };
}

/** How a person is shown: their display name, or their email when they have none. */
export function nameOf(user: UserSummary | undefined): string | null {
  return user ? (user.displayName ?? user.email) : null;
}
