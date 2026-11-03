import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { activeItem, contextTrail, environmentLabel, groupNav, matchPattern, sectionOf } from "../src/shell/navigation.js";
import { classifyCell, enhanceTables } from "../src/shell/tables.js";
import { filterItems } from "../src/shell/CommandPalette.js";
import { shortcutHint } from "../src/shell/AppShell.js";
import { readStoredTheme, THEME_STORAGE_KEY } from "../src/theme/ThemeProvider.js";

/**
 * The operations-console shell: the rail's groups, the context line, the theme switch, Ctrl+K and
 * the table markup it adds. The screens' own behaviour is covered by their tests, which run inside
 * this shell unchanged.
 */

vi.mock("../src/api/events.js", async () => {
  const actual = await vi.importActual<typeof import("../src/api/events.js")>("../src/api/events.js");
  const empty = async () => ({ items: [], nextCursor: null });
  return { ...actual, listQueue: vi.fn(empty), listRequests: vi.fn(empty) };
});

vi.mock("../src/api/notifications.js", async () => {
  const actual = await vi.importActual<typeof import("../src/api/notifications.js")>("../src/api/notifications.js");
  return { ...actual, listNotifications: vi.fn(async () => ({ items: [], unreadCount: 3, nextCursor: null })) };
});

const { App } = await import("../src/App.js");

const NAV = [
  { label: "Review queue", to: "/queue" },
  { label: "All events", to: "/events" },
  { label: "Venues", to: "/venues" },
  { label: "Find a venue", to: "/venues/search" },
  { label: "Notifications", to: "/notifications" },
  { label: "API console", to: "/console" },
];

function signedInAsCoordinator(hash = "#/queue") {
  sessionStorage.setItem(
    "connectsphere.session",
    JSON.stringify({
      userId: "coordinator-id",
      email: "coordinator@connectsphere.test",
      role: "EVENT_COORDINATOR",
      token: "token",
      lastLoginAt: "2026-11-03T01:00:00.000Z",
    })
  );
  window.location.hash = hash;
}

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  window.location.hash = "";
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("the rail and the context line", () => {
  it("groups the role's screens by section, in a fixed order, keeping each group's order", () => {
    const groups = groupNav([NAV[4]!, NAV[0]!, NAV[2]!, NAV[1]!, NAV[3]!, NAV[5]!]);
    expect(groups.map((group) => group.label)).toEqual(["events", "venues", "system"]);
    expect(groups[0]!.items.map((item) => item.label)).toEqual(["Review queue", "All events"]);
    expect(groups[2]!.items.map((item) => item.label)).toEqual(["Notifications", "API console"]);
  });

  it("puts a path no section claims under other", () => {
    expect(sectionOf("/somewhere/else")).toEqual({ key: "other", label: "other" });
    expect(groupNav([{ label: "Elsewhere", to: "/elsewhere" }])[0]!.label).toBe("other");
  });

  it("names the section and the fixed words of the route, never an id", () => {
    expect(contextTrail("/venues/:id/availability")).toEqual(["venues", "availability"]);
    expect(contextTrail("/review/:id")).toEqual(["events", "review"]);
    expect(contextTrail("/events/:id/venue-requests/new")).toEqual(["events", "venue requests", "new"]);
    expect(contextTrail("/assignments/unassigned")).toEqual(["oversight", "assignments", "unassigned"]);
    expect(contextTrail("/equipment")).toEqual(["equipment"]);
    expect(contextTrail(null)).toEqual([]);
  });

  it("matches a path to its route the way the router does, a fixed word before an id", () => {
    const patterns = ["/venues", "/venues/:id", "/venues/search", "/venues/:id/availability"];
    expect(matchPattern(patterns, "/venues/search")).toBe("/venues/search");
    expect(matchPattern(patterns, "/venues/abc")).toBe("/venues/:id");
    expect(matchPattern(patterns, "/nowhere")).toBeNull();
  });

  it("marks the exact screen, or else the closest screen above it", () => {
    expect(activeItem(NAV, "/venues/search")).toEqual({ item: NAV[3], exact: true });
    expect(activeItem(NAV, "/venues/abc/availability")).toEqual({ item: NAV[2], exact: false });
    expect(activeItem(NAV, "/review/abc")).toBeNull();
  });

  it("labels the environment from the build, or else from where it runs", () => {
    expect(environmentLabel(" Staging ", false, "cs.example.com")).toBe("staging");
    expect(environmentLabel(undefined, true, "localhost")).toBe("dev");
    expect(environmentLabel("", false, "127.0.0.1")).toBe("local");
    expect(environmentLabel(undefined, false, "cs.example.com")).toBe("hosted");
  });

  it("shows the Mac shortcut on a Mac and Ctrl elsewhere", () => {
    expect(shortcutHint("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)")).toBe("⌘K");
    expect(shortcutHint("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe("Ctrl K");
  });
});

describe("the mounted shell", () => {
  it("keeps one banner and one navigation, with the signed-in line and the unread count", async () => {
    signedInAsCoordinator();
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Review queue" })).toBeTruthy();
    expect(screen.getAllByRole("banner")).toHaveLength(1);
    expect(screen.getAllByRole("navigation")).toHaveLength(1);
    expect(screen.getByRole("banner").textContent).toContain("coordinator@connectsphere.test · Event Coordinator");
    expect(await screen.findByRole("link", { name: "Notifications (3)" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "3 unread" }).getAttribute("href")).toBe("#/notifications");
    expect(within(screen.getByRole("navigation")).getByRole("link", { name: "Review queue" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("banner").querySelector(".cs-context")?.textContent).toBe("eventsqueue");
  });

  it("switches between the dark and light themes and remembers the choice", async () => {
    signedInAsCoordinator();
    render(<App />);
    const theme = await screen.findByRole("switch", { name: "Dark theme" });

    expect(theme.getAttribute("aria-checked")).toBe("true");
    await waitFor(() => expect(document.documentElement.dataset.csTheme).toBe("dark"));

    fireEvent.click(theme);
    expect(screen.getByRole("switch", { name: "Dark theme" }).getAttribute("aria-checked")).toBe("false");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
    await waitFor(() => expect(document.documentElement.dataset.csTheme).toBe("light"));

    cleanup();
    render(<App />);
    expect((await screen.findByRole("switch", { name: "Dark theme" })).getAttribute("aria-checked")).toBe("false");
  });

  it("offers the theme switch on the sign-in screen too, without a banner or navigation", async () => {
    render(<App />);
    expect(await screen.findByRole("button", { name: "Sign in" })).toBeTruthy();
    expect(screen.getByRole("switch", { name: "Dark theme" })).toBeTruthy();
    expect(screen.queryByRole("banner")).toBeNull();
    expect(screen.queryByRole("navigation")).toBeNull();
  });

  it("opens the palette with Ctrl+K, filters it, and goes to the chosen screen", async () => {
    signedInAsCoordinator();
    render(<App />);
    await screen.findByRole("heading", { name: "Review queue" });

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    const dialog = screen.getByRole("dialog", { name: "Jump to a screen" });
    const input = within(dialog).getByRole("combobox", { name: "Screen" });
    expect(within(dialog).getAllByRole("option").map((option) => option.firstChild?.textContent)).toContain("API console");

    fireEvent.change(input, { target: { value: "all ev" } });
    expect(within(dialog).getAllByRole("option")).toHaveLength(1);
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => expect(window.location.hash).toBe("#/events"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("moves through the palette with the arrow keys, says when nothing matches, and closes on Escape", async () => {
    signedInAsCoordinator();
    render(<App />);
    await screen.findByRole("heading", { name: "Review queue" });

    fireEvent.keyDown(window, { key: "K", metaKey: true });
    const input = screen.getByRole("combobox", { name: "Screen" });
    const selected = () => screen.getAllByRole("option").findIndex((option) => option.getAttribute("aria-selected") === "true");
    expect(selected()).toBe(0);
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(selected()).toBe(1);
    fireEvent.keyDown(input, { key: "ArrowUp" });
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(selected()).toBe(screen.getAllByRole("option").length - 1);
    fireEvent.keyDown(input, { key: "Tab" });
    expect(document.activeElement).toBe(input);

    fireEvent.change(input, { target: { value: "zzz" } });
    expect(screen.getByRole("status").textContent).toBe("No screen matches.");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });

    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(window.location.hash).toBe("#/queue");
  });

  it("opens the palette from the command bar's hint and goes where a click points", async () => {
    signedInAsCoordinator();
    render(<App />);
    await screen.findByRole("heading", { name: "Review queue" });

    fireEvent.click(screen.getByText("Jump to a screen"));
    fireEvent.mouseDown(within(screen.getByRole("dialog")).getByText("Venues"));
    await waitFor(() => expect(window.location.hash).toBe("#/venues"));
  });

  it("filters on every word, against the label and the section", () => {
    expect(filterItems(NAV, "").map((item) => item.label)).toHaveLength(NAV.length);
    expect(filterItems(NAV, "venue find").map((item) => item.label)).toEqual(["Find a venue"]);
    expect(filterItems(NAV, "system").map((item) => item.label)).toEqual(["Notifications", "API console"]);
  });
});

describe("the remembered theme", () => {
  it("is dark unless light was chosen, and dark when storage holds anything else", () => {
    expect(readStoredTheme()).toBe("dark");
    localStorage.setItem(THEME_STORAGE_KEY, "light");
    expect(readStoredTheme()).toBe("light");
    localStorage.setItem(THEME_STORAGE_KEY, "sepia");
    expect(readStoredTheme()).toBe("dark");
  });

  it("is dark when storage can't be read", () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(readStoredTheme()).toBe("dark");
    getItem.mockRestore();
  });
});

describe("dense tables", () => {
  it("recognises references, numbers, dates and times, and empty cells", () => {
    expect(classifyCell("EVT-000124")).toBe("ref");
    expect(classifyCell(" 1,200 ")).toBe("num");
    expect(classifyCell("4 × 3")).toBe("num");
    expect(classifyCell("06/12/2026, 10:12:00 am")).toBe("time");
    expect(classifyCell("09:00")).toBe("time");
    expect(classifyCell("—")).toBe("empty");
    expect(classifyCell("Annual Research Symposium")).toBeNull();
    expect(classifyCell("")).toBeNull();
    expect(classifyCell("x".repeat(60))).toBeNull();
  });

  it("labels each cell with its column's header and names the table's parts, leaving the text alone", () => {
    const host = document.createElement("div");
    host.innerHTML = `
      <table>
        <thead><tr><th>Reference</th><th colspan="2">When</th><th>Status</th></tr></thead>
        <tbody><tr><td>EVT-000124</td><td>09:00</td><td>12:00</td><td>Draft</td></tr><tr><th>Total</th><td>—</td></tr></tbody>
      </table>
      <dl><dt>Attendance</dt><dd>150</dd></dl>`;
    const before = host.textContent;
    enhanceTables(host);

    const cells = [...host.querySelectorAll("tbody tr:first-child td")];
    expect(cells.map((cell) => cell.getAttribute("data-label"))).toEqual(["Reference", "When", "When", "Status"]);
    expect(cells.map((cell) => cell.getAttribute("data-cs-cell"))).toEqual(["ref", "time", "time", null]);
    expect(host.querySelector("table")!.getAttribute("role")).toBe("table");
    expect(host.querySelector("thead th")!.getAttribute("role")).toBe("columnheader");
    expect(host.querySelector("tbody th")!.hasAttribute("role")).toBe(false);
    expect(host.querySelector("dd")!.getAttribute("data-cs-cell")).toBe("num");
    expect(host.textContent).toBe(before);

    host.querySelector("tbody td")!.textContent = "Renamed";
    enhanceTables(host);
    expect(host.querySelector("tbody td")!.hasAttribute("data-cs-cell")).toBe(false);
  });
});
