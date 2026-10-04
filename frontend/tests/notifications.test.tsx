import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { eventPathFor } from "../src/api/notifications.js";

/** T2 — reading and managing my notifications in the web app. */

const EVENT_ID = "event-1";
const unread = (id: string, message: string, createdAt: string) => ({
  id,
  notificationType: "event.approved",
  eventId: EVENT_ID,
  eventReference: "EVT-000001",
  relatedReference: null,
  message,
  occurredAt: createdAt,
  createdAt,
  readAt: null as string | null,
});

let store = [
  unread("n-2", "Your event request EVT-000001 “Symposium” has been approved.", "2026-10-04T02:00:00.000Z"),
  unread("n-1", "Clarification is required on your event request EVT-000001 “Symposium”.", "2026-10-04T01:00:00.000Z"),
];
const unreadCount = () => store.filter((n) => !n.readAt).length;

vi.mock("../src/api/notifications.js", async () => {
  const actual = await vi.importActual<typeof import("../src/api/notifications.js")>("../src/api/notifications.js");
  return {
    ...actual,
    listNotifications: vi.fn(async () => ({ items: store.map((n) => ({ ...n })), unreadCount: unreadCount(), nextCursor: null })),
    markNotificationRead: vi.fn(async (_token: string, id: string) => {
      store = store.map((n) => (n.id === id ? { ...n, readAt: n.readAt ?? "2026-10-04T03:00:00.000Z" } : n));
      return { ...store.find((n) => n.id === id)!, unreadCount: unreadCount() };
    }),
    markAllNotificationsRead: vi.fn(async () => {
      const updated = unreadCount();
      store = store.map((n) => ({ ...n, readAt: n.readAt ?? "2026-10-04T03:00:00.000Z" }));
      return { updated, unreadCount: 0 };
    }),
  };
});

vi.mock("../src/api/events.js", async () => {
  const actual = await vi.importActual<typeof import("../src/api/events.js")>("../src/api/events.js");
  const pending = () => new Promise(() => undefined);
  return { ...actual, openEvent: vi.fn(pending), listClarifications: vi.fn(pending), listReassignmentProposals: vi.fn(pending) };
});

vi.mock("../src/api/users.js", () => ({ lookupUsers: vi.fn(async () => []) }));

const { App } = await import("../src/App.js");

function signInAs(role: string) {
  sessionStorage.setItem(
    "connectsphere.session",
    JSON.stringify({ userId: "user-id", email: "user@connectsphere.test", role, token: "token", lastLoginAt: "2026-10-04T01:00:00.000Z" }),
  );
}

beforeEach(() => {
  store = store.map((n) => ({ ...n, readAt: null }));
  signInAs("EVENT_ORGANISER");
  window.location.hash = "#/notifications";
});
afterEach(() => {
  cleanup();
  sessionStorage.clear();
});

const items = () => within(screen.getByRole("list", { name: "Notifications" })).getAllByRole("listitem");

describe("eventPathFor", () => {
  it("opens an organiser's own request and a coordinator's review screen; no other role has an event page yet", () => {
    expect(eventPathFor("EVENT_ORGANISER", "e")).toBe("/requests/e");
    expect(eventPathFor("EVENT_COORDINATOR", "e")).toBe("/review/e");
    for (const role of ["VENUE_STAFF", "TECH_SUPPORT_STAFF", "ATTENDEE"] as const) expect(eventPathFor(role, "e")).toBeNull();
  });
});

describe("the Notifications screen", () => {
  it("lists my notifications newest first, with the unread count in the navigation", async () => {
    render(<App />);
    await screen.findByRole("list", { name: "Notifications" });
    expect(items().map((li) => li.textContent)).toEqual([
      expect.stringContaining("has been approved"),
      expect.stringContaining("Clarification is required"),
    ]);
    expect(items().every((li) => li.textContent!.includes("Unread"))).toBe(true);
    await waitFor(() => expect(screen.getByRole("link", { name: "Notifications (2)" })).toBeTruthy());
  });

  it("marks one read, and the count drops", async () => {
    render(<App />);
    await screen.findByRole("list", { name: "Notifications" });
    fireEvent.click(within(items()[0]!).getByRole("button", { name: "Mark as read" }));
    await waitFor(() => expect(items()[0]!.textContent).not.toContain("Unread"));
    expect(items()[1]!.textContent).toContain("Unread");
    await waitFor(() => expect(screen.getByRole("link", { name: "Notifications (1)" })).toBeTruthy());
  });

  it("marks all read in one action, and the count goes", async () => {
    render(<App />);
    await screen.findByRole("list", { name: "Notifications" });
    fireEvent.click(screen.getByRole("button", { name: "Mark all as read" }));
    await waitFor(() => expect(items().some((li) => li.textContent!.includes("Unread"))).toBe(false));
    await waitFor(() => expect(screen.getByRole("link", { name: "Notifications" })).toBeTruthy());
  });

  it("opens the related event, marking the notification read", async () => {
    render(<App />);
    await screen.findByRole("list", { name: "Notifications" });
    fireEvent.click(within(items()[0]!).getByRole("button", { name: "Open" }));
    await waitFor(() => expect(window.location.hash).toBe(`#/requests/${EVENT_ID}`));
    expect(store[0]!.readAt).not.toBeNull();
  });

  it("says when there is nothing to show", async () => {
    store = [];
    render(<App />);
    expect(await screen.findByText("You have no notifications.")).toBeTruthy();
  });
});
