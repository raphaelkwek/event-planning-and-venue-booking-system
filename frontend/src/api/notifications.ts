import { request } from "./client.js";
import type { Role } from "./types.js";

/** T2: my notifications, served by the notification service. */

const NOTIFICATION = "/notification/api/v1";

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

export interface NotificationPage {
  items: NotificationItem[];
  unreadCount: number;
  nextCursor: string | null;
}

/** Tells the navigation's unread count to refresh after a notification is read. */
export const NOTIFICATIONS_CHANGED = "connectsphere:notifications-changed";
export const announceNotificationsChanged = () => window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));

export function listNotifications(token: string, options: { limit?: number; cursor?: string } = {}) {
  const query = new URLSearchParams();
  if (options.limit) query.set("limit", String(options.limit));
  if (options.cursor) query.set("cursor", options.cursor);
  const suffix = query.size > 0 ? `?${query}` : "";
  return request<NotificationPage>(`${NOTIFICATION}/notifications${suffix}`, { token });
}

export function markNotificationRead(token: string, id: string) {
  return request<NotificationItem & { unreadCount: number }>(`${NOTIFICATION}/notifications/${id}/read`, {
    method: "POST",
    token,
  });
}

export function markAllNotificationsRead(token: string) {
  return request<{ updated: number; unreadCount: number }>(`${NOTIFICATION}/notifications/read-all`, {
    method: "POST",
    token,
  });
}

/**
 * Where "Open" goes (T2 AC8): the role's own page for an event. That page asks
 * the server again, so if the user can no longer see the event it shows the
 * refusal and no event data. Other roles have no event page yet.
 */
export function eventPathFor(role: Role, eventId: string): string | null {
  if (role === "EVENT_ORGANISER") return `/requests/${eventId}`;
  if (role === "EVENT_COORDINATOR") return `/review/${eventId}`;
  return null;
}
