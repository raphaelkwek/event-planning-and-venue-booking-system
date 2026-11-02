/**
 * L7 — the list of requests is paged, as implementation.md §5 asks of every list:
 * `?limit=` (default 25, at most 100) and `&cursor=`, answered with
 * `{ items, nextCursor }`. A cursor is the sort time and id of the last row sent
 * (keyset paging), so a row added while someone pages is never shown twice and
 * none is skipped. It is opaque to callers: they hand back what they were given.
 */

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

export interface PageCursor {
  /** The row's sort time as Postgres wrote it, to the microsecond, in UTC. */
  sortAt: string;
  id: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SORT_AT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/;
const WHOLE_NUMBER = /^\d+$/;

export type LimitReading = { ok: true; limit: number } | { ok: false };

/** The page size asked for: absent gives the default; anything but a whole number from 1 to the maximum is refused. */
export function readLimit(raw: unknown): LimitReading {
  if (raw === undefined) return { ok: true, limit: DEFAULT_PAGE_SIZE };
  if (typeof raw !== "string" || !WHOLE_NUMBER.test(raw)) return { ok: false };
  const limit = Number(raw);
  return limit >= 1 && limit <= MAX_PAGE_SIZE ? { ok: true, limit } : { ok: false };
}

export function encodeCursor(cursor: PageCursor): string {
  return Buffer.from(JSON.stringify({ sortAt: cursor.sortAt, id: cursor.id })).toString("base64url");
}

/** The cursor a text stands for; null when it is not one this service issued. */
export function decodeCursor(text: string): PageCursor | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(text, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const { sortAt, id } = parsed as Record<string, unknown>;
  if (typeof sortAt !== "string" || !SORT_AT.test(sortAt)) return null;
  if (typeof id !== "string" || !UUID.test(id)) return null;
  return { sortAt, id };
}
