import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "@atlaskit/button/new";
import Lozenge from "@atlaskit/lozenge";
import SectionMessage from "@atlaskit/section-message";
import { useSignedIn } from "../auth/SessionContext.js";
import {
  announceNotificationsChanged,
  eventPathFor,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
} from "../api/notifications.js";
import { formatInstant } from "../shared/status.js";
import { Refusal } from "../components/Refusal.js";

/**
 * T2 — my notifications, newest first (AC5). Each can be marked read on its
 * own, or all at once (AC6); read state is stored by the server, so it
 * persists across sessions (AC7). "Open" marks it read and goes to the event,
 * whose page refuses with a message if the event is no longer visible (AC8).
 * The server only ever returns the signed-in user's own (AC9).
 */
export function Notifications() {
  const session = useSignedIn();
  const navigate = useNavigate();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const page = await listNotifications(session.token);
      setItems(page.items);
      setNextCursor(page.nextCursor);
    } catch (caught) {
      setError(caught);
    } finally {
      setLoading(false);
    }
  }, [session.token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function loadMore() {
    if (!nextCursor) return;
    try {
      const page = await listNotifications(session.token, { cursor: nextCursor });
      setItems((current) => [...current, ...page.items]);
      setNextCursor(page.nextCursor);
    } catch (caught) {
      setError(caught);
    }
  }

  async function markRead(id: string) {
    try {
      const marked = await markNotificationRead(session.token, id);
      setItems((current) => current.map((item) => (item.id === id ? { ...item, readAt: marked.readAt } : item)));
      announceNotificationsChanged();
    } catch (caught) {
      setError(caught);
    }
  }

  async function markAll() {
    try {
      await markAllNotificationsRead(session.token);
      setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })));
      announceNotificationsChanged();
    } catch (caught) {
      setError(caught);
    }
  }

  async function open(item: NotificationItem) {
    if (!item.readAt) await markRead(item.id);
    const path = eventPathFor(session.role, item.eventId);
    if (path) navigate(path);
    else setNotice(`Event ${item.eventReference} has no page for your role.`);
  }

  if (loading) return <p>Loading…</p>;

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
        <h2 style={{ margin: 0, flex: 1 }}>Notifications</h2>
        <Button isDisabled={!items.some((item) => !item.readAt)} onClick={() => void markAll()}>
          Mark all as read
        </Button>
      </div>

      <Refusal error={error} />
      {notice && (
        <div style={{ marginBottom: 12 }}>
          <SectionMessage appearance="information">
            <p style={{ margin: 0 }}>{notice}</p>
          </SectionMessage>
        </div>
      )}

      {items.length === 0 ? (
        <p>You have no notifications.</p>
      ) : (
        <ul aria-label="Notifications" style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {items.map((item) => (
            <li
              key={item.id}
              style={{
                display: "flex",
                gap: 12,
                alignItems: "flex-start",
                padding: "12px 0",
                borderBottom: "1px solid #DFE1E6",
                fontWeight: item.readAt ? "normal" : 600,
              }}
            >
              <div style={{ flex: 1 }}>
                <div>{item.message}</div>
                <div style={{ fontSize: 12, color: "#626F86", fontWeight: "normal", marginTop: 4 }}>
                  {formatInstant(item.createdAt)}
                  {!item.readAt && (
                    <span style={{ marginLeft: 8 }}>
                      <Lozenge appearance="new">Unread</Lozenge>
                    </span>
                  )}
                </div>
              </div>
              <Button appearance="subtle" onClick={() => void open(item)}>
                Open
              </Button>
              {!item.readAt && (
                <Button appearance="subtle" onClick={() => void markRead(item.id)}>
                  Mark as read
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {nextCursor && (
        <p>
          <Button onClick={() => void loadMore()}>Show older notifications</Button>
        </p>
      )}
    </div>
  );
}
