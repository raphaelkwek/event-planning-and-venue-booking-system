import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ServiceUnreachableError } from "../src/api/client.js";
import type { EventListItem, EventStatus } from "../src/api/types.js";

/**
 * D11 (staging dry run, 4 Nov 2026): the coordinator's All events list had no search and no status
 * filter. It now finds an event by part of its name or its reference, ignoring case, and narrows the
 * list to one status; both stay in the address, so a filtered list can be reloaded or shared.
 * D10: a list that fails to load says so once, with a way to try again, and not "no events" beside it.
 */

const ME = "00000000-0000-0000-0000-000000000002";

const item = (id: string, reference: string | null, name: string, status: EventStatus): EventListItem => ({
  id,
  kind: "EVENT",
  status,
  name,
  reference,
  lastSavedAt: null,
  submittedAt: "2026-09-17T01:00:00.000Z",
  assignedCoordinatorId: ME,
  decidedAt: null,
});

const events = [
  item("e1", "EVT-000016", "Dry run 4 Nov Main Event", "PLANNING"),
  item("e2", "EVT-000017", "Dry run 4 Nov Cancel Test", "CANCELLED"),
  item("e3", "EVT-000020", "Waitlist Test", "CONFIRMED"),
  item("e4", "EVT-000021", "Reject Retest", "PLANNING"),
];

const listRequests = vi.fn();
vi.mock("../src/api/events.js", async () => {
  const actual = await vi.importActual<typeof import("../src/api/events.js")>("../src/api/events.js");
  return { ...actual, listRequests: (...args: unknown[]) => listRequests(...args) };
});
vi.mock("../src/api/users.js", () => ({ lookupUsers: vi.fn(async () => []) }));
vi.mock("../src/api/notifications.js", async () => {
  const actual = await vi.importActual<typeof import("../src/api/notifications.js")>("../src/api/notifications.js");
  return { ...actual, listNotifications: vi.fn(async () => ({ items: [], unreadCount: 0, nextCursor: null })) };
});

const { App } = await import("../src/App.js");

function openAllEvents(hash = "#/events") {
  sessionStorage.setItem(
    "connectsphere.session",
    JSON.stringify({ userId: ME, email: "coordinator@connectsphere.test", role: "EVENT_COORDINATOR", token: "token", lastLoginAt: "2026-09-17T01:00:00.000Z" }),
  );
  window.location.hash = hash;
  render(<App />);
}

const listed = () =>
  within(screen.getByRole("table"))
    .queryAllByRole("row")
    .slice(1)
    .map((row) => within(row).getAllByRole("cell")[1]!.textContent);

beforeEach(() => {
  listRequests.mockReset();
  listRequests.mockResolvedValue({ items: events, nextCursor: null });
});
afterEach(() => {
  cleanup();
  sessionStorage.clear();
});

describe("D11: searching and filtering All events", () => {
  it("finds events by part of the name, ignoring case", async () => {
    openAllEvents();
    await screen.findByText("Waitlist Test");
    fireEvent.change(screen.getByLabelText("Search by name or reference"), { target: { value: "dry RUN" } });

    expect(listed()).toEqual(["Dry run 4 Nov Main Event", "Dry run 4 Nov Cancel Test"]);
  });

  it("finds an event by its reference, in full or in part", async () => {
    openAllEvents();
    await screen.findByText("Waitlist Test");
    fireEvent.change(screen.getByLabelText("Search by name or reference"), { target: { value: "evt-000020" } });
    expect(listed()).toEqual(["Waitlist Test"]);
    fireEvent.change(screen.getByLabelText("Search by name or reference"), { target: { value: "0002" } });
    expect(listed()).toEqual(["Waitlist Test", "Reject Retest"]);
  });

  it("narrows the list to one status, offering every status", async () => {
    openAllEvents();
    await screen.findByText("Waitlist Test");
    const status = screen.getByLabelText("Status") as HTMLSelectElement;
    expect([...status.options].map((option) => option.textContent)).toEqual(expect.arrayContaining(["All statuses", "Planning", "Confirmed", "Cancelled"]));
    fireEvent.change(status, { target: { value: "PLANNING" } });

    expect(listed()).toEqual(["Dry run 4 Nov Main Event", "Reject Retest"]);
  });

  it("applies the search and the status together, and says when nothing matches", async () => {
    openAllEvents();
    await screen.findByText("Waitlist Test");
    fireEvent.change(screen.getByLabelText("Search by name or reference"), { target: { value: "dry run" } });
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "PLANNING" } });
    expect(listed()).toEqual(["Dry run 4 Nov Main Event"]);

    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "CONFIRMED" } });
    expect(listed()).toEqual([]);
    expect(screen.getByText("No events match the search and status filter.")).toBeTruthy();
    expect(screen.queryByText("No events are assigned to you.")).toBeNull();
  });

  it("keeps the search and the status in the address, so they survive a reload", async () => {
    openAllEvents("#/events?q=retest&status=PLANNING");
    await waitFor(() => expect(listed()).toEqual(["Reject Retest"]));
    expect((screen.getByLabelText("Search by name or reference") as HTMLInputElement).value).toBe("retest");
    expect((screen.getByLabelText("Status") as HTMLSelectElement).value).toBe("PLANNING");

    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "" } });
    await waitFor(() => expect(window.location.hash).toBe("#/events?q=retest"));
  });

  it("still says when no event is assigned at all", async () => {
    listRequests.mockResolvedValue({ items: [], nextCursor: null });
    openAllEvents();
    expect(await screen.findByText("No events are assigned to you.")).toBeTruthy();
  });
});

describe("D10: when All events cannot be loaded", () => {
  it("shows one error with a way to try again, and no empty list beside it", async () => {
    listRequests.mockRejectedValueOnce(new ServiceUnreachableError("unreachable", new TypeError("Failed to fetch")));
    openAllEvents();

    expect(await screen.findByText("Your events couldn't be loaded")).toBeTruthy();
    expect(screen.getByText("ConnectSphere couldn't be reached. Check your connection, then try again.")).toBeTruthy();
    expect(screen.queryByText("No events are assigned to you.")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Waitlist Test")).toBeTruthy();
    expect(screen.queryByText("Your events couldn't be loaded")).toBeNull();
  });
});
