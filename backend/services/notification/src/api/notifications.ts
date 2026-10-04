import { Router, type Response } from "express";
import type { Sql } from "postgres";
import { authenticate, type CallerRequest } from "./auth.js";
import { refuse } from "./errors.js";
import { listForRecipient, markAllRead, markRead, unreadCount, type Cursor } from "../repo/notifications.js";

/**
 * T2 — read and manage my notifications. Every route works on the caller's
 * own notifications only: another user's are never listed, and marking one
 * read answers 404 as if it did not exist (AC9). Read state lives on each
 * recipient's own row, so it is per user (AC6) and persists (AC7).
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const encodeCursor = (cursor: Cursor) => Buffer.from(JSON.stringify(cursor)).toString("base64url");

function decodeCursor(text: string): Cursor | null {
  try {
    const cursor = JSON.parse(Buffer.from(text, "base64url").toString("utf8")) as Cursor;
    if (UUID.test(cursor.id) && !Number.isNaN(Date.parse(cursor.createdAt))) return cursor;
  } catch {
    // Falls through: not a cursor this service issued.
  }
  return null;
}

export function notificationsRouter(sql: Sql) {
  const router = Router();

  router.get("/api/v1/notifications", authenticate, async (req: CallerRequest, res: Response) => {
    const limit = req.query.limit === undefined ? DEFAULT_LIMIT : Number(req.query.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
      refuse(res, 400, "VALIDATION_FAILED", `limit must be a whole number from 1 to ${MAX_LIMIT}.`, [
        { field: "limit", message: `Give a whole number from 1 to ${MAX_LIMIT}.` },
      ]);
      return;
    }
    const after = typeof req.query.cursor === "string" ? decodeCursor(req.query.cursor) : null;
    if (req.query.cursor !== undefined && !after) {
      refuse(res, 400, "VALIDATION_FAILED", "cursor is not one this service issued.", [
        { field: "cursor", message: "Use the nextCursor from a previous page." },
      ]);
      return;
    }

    const me = req.caller!.id;
    const rows = await listForRecipient(sql, me, limit, after);
    const items = rows.slice(0, limit);
    const last = items[items.length - 1];
    res.json({
      items,
      unreadCount: await unreadCount(sql, me),
      nextCursor: rows.length > limit && last ? encodeCursor({ createdAt: last.createdAt, id: last.id }) : null,
    });
  });

  // Registered before /:id/read so "read-all" is never taken for an id.
  router.post("/api/v1/notifications/read-all", authenticate, async (req: CallerRequest, res: Response) => {
    const updated = await markAllRead(sql, req.caller!.id);
    res.json({ updated, unreadCount: 0 });
  });

  router.post("/api/v1/notifications/:id/read", authenticate, async (req: CallerRequest, res: Response) => {
    const me = req.caller!.id;
    const marked = UUID.test(req.params.id!) ? await markRead(sql, req.params.id!, me) : null;
    if (!marked) {
      refuse(res, 404, "NOTIFICATION_NOT_FOUND", "No notification with that id is yours.");
      return;
    }
    res.json({ ...marked, unreadCount: await unreadCount(sql, me) });
  });

  return router;
}
