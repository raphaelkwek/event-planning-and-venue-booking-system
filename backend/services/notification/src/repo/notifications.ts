import type { Sql } from "postgres";

/** SQL for the notification schema only, one function per query (T2). */

export interface NotificationItem {
  id: string;
  notificationType: string;
  eventId: string;
  eventReference: string;
  relatedReference: string | null;
  message: string;
  occurredAt: string;
  createdAt: string;
  readAt: string | null;
}

interface Row {
  id: string;
  notification_type: string;
  event_id: string;
  event_reference: string;
  related_reference: string | null;
  message: string;
  occurred_at: Date;
  created_at: Date;
  read_at: Date | null;
}

function toItem(row: Row): NotificationItem {
  return {
    id: row.id,
    notificationType: row.notification_type,
    eventId: row.event_id,
    eventReference: row.event_reference,
    relatedReference: row.related_reference,
    message: row.message,
    occurredAt: row.occurred_at.toISOString(),
    createdAt: row.created_at.toISOString(),
    readAt: row.read_at ? row.read_at.toISOString() : null,
  };
}

/** Where a page ends: the last item's creation time and id, so equal times still page cleanly. */
export interface Cursor {
  createdAt: string;
  id: string;
}

/** The recipient's notifications, newest first, one more than asked for so the caller knows if there is a next page. */
export async function listForRecipient(sql: Sql, recipientId: string, limit: number, after: Cursor | null) {
  const rows = await sql<Row[]>`
    select id, notification_type, event_id, event_reference, related_reference, message, occurred_at, created_at, read_at
    from notification.notifications
    where recipient_user_id = ${recipientId}
      ${after ? sql`and (created_at, id) < (${after.createdAt}::timestamptz, ${after.id}::uuid)` : sql``}
    order by created_at desc, id desc
    limit ${limit + 1}
  `;
  return rows.map(toItem);
}

export async function unreadCount(sql: Sql, recipientId: string): Promise<number> {
  const [row] = await sql<{ n: number }[]>`
    select count(*)::int as n from notification.notifications
    where recipient_user_id = ${recipientId} and read_at is null
  `;
  return row!.n;
}

/**
 * Marks one of the recipient's notifications read, keeping the first time it
 * was read. Null when it is not theirs, or does not exist.
 */
export async function markRead(sql: Sql, id: string, recipientId: string): Promise<NotificationItem | null> {
  const [row] = await sql<Row[]>`
    update notification.notifications
    set read_at = coalesce(read_at, now()),
        updated_at = case when read_at is null then now() else updated_at end,
        updated_by = case when read_at is null then ${recipientId}::uuid else updated_by end
    where id = ${id} and recipient_user_id = ${recipientId}
    returning id, notification_type, event_id, event_reference, related_reference, message, occurred_at, created_at, read_at
  `;
  return row ? toItem(row) : null;
}

/** Marks every unread notification of the recipient read; returns how many changed. */
export async function markAllRead(sql: Sql, recipientId: string): Promise<number> {
  const rows = await sql`
    update notification.notifications
    set read_at = now(), updated_at = now(), updated_by = ${recipientId}
    where recipient_user_id = ${recipientId} and read_at is null
    returning id
  `;
  return rows.length;
}
