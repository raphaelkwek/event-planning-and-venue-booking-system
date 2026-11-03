import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { CallerRequest } from "./auth.js";
import { refuse } from "./errors.js";

/** What every registration router shares: ids, async handlers, and cursor pages (implementation.md §5). */

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_LIMIT = 25;
export const MAX_LIMIT = 100;

/** Express 4 does not catch a rejected promise from an async handler, so every handler passes its errors on. */
export const handle =
  (fn: (req: CallerRequest, res: Response) => Promise<unknown>): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req as CallerRequest, res).catch(next);
  };

export function encodeCursor(cursor: object): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

function decodeCursor<T>(text: string, valid: (value: Record<string, unknown>) => boolean): T | null {
  try {
    const value = JSON.parse(Buffer.from(text, "base64url").toString("utf8")) as Record<string, unknown>;
    if (value && typeof value === "object" && valid(value)) return value as T;
  } catch {
    // Not a cursor this service issued.
  }
  return null;
}

export const isInstant = (value: unknown) => typeof value === "string" && !Number.isNaN(Date.parse(value));
export const isUuid = (value: unknown) => typeof value === "string" && UUID.test(value);

/** The page size and cursor, or the refusal already sent. */
export function readPage<T>(
  req: Request,
  res: Response,
  valid: (value: Record<string, unknown>) => boolean,
  defaultLimit = DEFAULT_LIMIT,
): { limit: number; after: T | null } | null {
  const limit = req.query.limit === undefined ? defaultLimit : Number(req.query.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    refuse(res, 400, "VALIDATION_FAILED", `limit must be a whole number from 1 to ${MAX_LIMIT}.`, {
      fields: [{ field: "limit", message: `Give a whole number from 1 to ${MAX_LIMIT}.` }],
    });
    return null;
  }
  if (req.query.cursor === undefined) return { limit, after: null };
  const after = typeof req.query.cursor === "string" ? decodeCursor<T>(req.query.cursor, valid) : null;
  if (!after) {
    refuse(res, 400, "VALIDATION_FAILED", "cursor is not one this service issued.", {
      fields: [{ field: "cursor", message: "Use the nextCursor from a previous page." }],
    });
    return null;
  }
  return { limit, after };
}

/** The page's items and the cursor after its last, given one more row than the limit when there is a next page. */
export function pageOf<T, C extends object>(rows: T[], limit: number, cursorOf: (last: T) => C): { items: T[]; nextCursor: string | null } {
  const items = rows.slice(0, limit);
  const last = items[items.length - 1];
  return { items, nextCursor: rows.length > limit && last ? encodeCursor(cursorOf(last)) : null };
}
