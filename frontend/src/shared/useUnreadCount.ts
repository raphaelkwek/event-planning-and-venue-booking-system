import { useEffect, useState } from "react";
import { listNotifications, NOTIFICATIONS_CHANGED } from "../api/notifications.js";

/**
 * T2 AC5: the unread count shown in the navigation. It is asked for on
 * sign-in, whenever the screen changes, every 30 seconds, and after a
 * notification is marked read. If the notification service cannot be reached
 * the count is simply not shown; nothing else on the screen depends on it.
 */
export function useUnreadCount(token: string | null, screen: string): number | null {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (!token) return;
    let current = true;
    const refresh = () =>
      listNotifications(token, { limit: 1 })
        .then((page) => current && setCount(page.unreadCount))
        .catch(() => current && setCount(null));

    void refresh();
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener(NOTIFICATIONS_CHANGED, refresh);
    return () => {
      current = false;
      window.clearInterval(timer);
      window.removeEventListener(NOTIFICATIONS_CHANGED, refresh);
    };
  }, [token, screen]);

  return count;
}
