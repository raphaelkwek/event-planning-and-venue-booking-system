import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ApiError } from "../src/api/client.js";

/**
 * E3 — the Event Coordinator Lead's unassigned queue, and assigning a request
 * to an active Event Coordinator. The Lead has only its own functions (A2).
 */

const EVENT_ID = "event-1";

const QUEUE = {
  items: [
    {
      id: EVENT_ID,
      reference: "EVT-000123",
      name: "Annual Research Symposium",
      proposedStartAt: "2026-12-02T06:00:00.000Z",
      proposedEndAt: "2026-12-02T10:00:00.000Z",
      expectedAttendance: 150,
      submittedAt: "2026-10-27T01:15:00.000Z",
      status: "SUBMITTED",
    },
    {
      id: "event-2",
      reference: "EVT-000124",
      name: "Alumni Networking Night",
      proposedStartAt: "2026-12-04T10:00:00.000Z",
      proposedEndAt: "2026-12-04T13:00:00.000Z",
      expectedAttendance: 80,
      submittedAt: "2026-10-27T01:16:00.000Z",
      status: "SUBMITTED",
    },
  ],
};

const COORDINATORS = {
  items: [
    { id: "coordinator-1", displayName: "Coordinator One", email: "coordinator@connectsphere.test", activeAssignments: 3 },
    { id: "coordinator-2", displayName: "Coordinator Two", email: "coordinator2@connectsphere.test", activeAssignments: 0 },
  ],
};

const EVENT = {
  id: EVENT_ID,
  reference: "EVT-000123",
  ownerId: "organiser-id",
  name: "Annual Research Symposium",
  purpose: "Share faculty research",
  description: "A one-day symposium.",
  proposedStartAt: "2026-12-02T06:00:00.000Z",
  proposedEndAt: "2026-12-02T10:00:00.000Z",
  expectedAttendance: 150,
  status: "SUBMITTED",
  submittedAt: "2026-10-27T01:15:00.000Z",
  assignedCoordinatorId: null,
};

type Fn = (...args: unknown[]) => Promise<unknown>;
const listUnassigned = vi.fn<Parameters<Fn>, ReturnType<Fn>>(async () => QUEUE);
const listCoordinators = vi.fn<Parameters<Fn>, ReturnType<Fn>>(async () => COORDINATORS);
const assignCoordinator = vi.fn<Parameters<Fn>, ReturnType<Fn>>(async () => ({
  eventId: EVENT_ID,
  coordinatorId: "coordinator-2",
  assignedBy: "lead-id",
  assignedAt: "2026-10-27T02:00:00.000Z",
}));
const openEvent = vi.fn<Parameters<Fn>, ReturnType<Fn>>(async () => EVENT);

vi.mock("../src/api/assignments.js", () => ({
  listUnassigned: (...args: unknown[]) => listUnassigned(...args),
  listCoordinators: (...args: unknown[]) => listCoordinators(...args),
  assignCoordinator: (...args: unknown[]) => assignCoordinator(...args),
}));

vi.mock("../src/api/events.js", async () => {
  const actual = await vi.importActual<typeof import("../src/api/events.js")>("../src/api/events.js");
  return { ...actual, openEvent: (...args: unknown[]) => openEvent(...args) };
});

vi.mock("../src/api/users.js", () => ({
  lookupUsers: vi.fn(async () => [{ id: "organiser-id", displayName: "Organiser One", email: "organiser@connectsphere.test" }]),
}));

const { App } = await import("../src/App.js");

function signInAs(role: string, path = "/") {
  sessionStorage.setItem(
    "connectsphere.session",
    JSON.stringify({ userId: "lead-id", email: "lead@connectsphere.test", role, token: "token", lastLoginAt: "2026-10-27T01:00:00.000Z" }),
  );
  window.location.hash = `#${path}`;
}

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.clearAllMocks();
});

const text = (element: HTMLElement) => element.textContent!.replace(/\s+/g, " ").trim();
const navLinks = () => within(screen.getByRole("navigation")).getAllByRole("link").map((link) => link.textContent);

describe("the Event Coordinator Lead (E3-T8, A2)", () => {
  it("is named in the header, lands on the unassigned queue, and is offered none of the coordinator's functions", async () => {
    signInAs("EVENT_COORDINATOR_LEAD");
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Unassigned requests" })).toBeTruthy();
    expect(screen.getByText(/Event Coordinator Lead/)).toBeTruthy();
    const links = navLinks();
    expect(links).toContain("Unassigned");
    for (const coordinators of ["Review queue", "All events", "Find a venue", "Venues"]) expect(links).not.toContain(coordinators);
  });

  it("isn't offered to a coordinator, who cannot open the queue", async () => {
    signInAs("EVENT_COORDINATOR", "/assignments/unassigned");
    render(<App />);

    await screen.findByRole("button", { name: "Sign out" });
    expect(navLinks()).not.toContain("Unassigned");
    expect(screen.queryByRole("heading", { name: "Unassigned requests" })).toBeNull();
    expect(listUnassigned).not.toHaveBeenCalled();
  });
});

describe("the unassigned queue (E3-T2)", () => {
  it("lists each request's reference, name, proposed date and times, attendance and submission, in the server's order", async () => {
    signInAs("EVENT_COORDINATOR_LEAD", "/assignments/unassigned");
    render(<App />);

    const table = await screen.findByRole("table", { name: "Unassigned requests" });
    const rows = within(table).getAllByRole("row").slice(1).map(text);
    expect(rows[0]).toContain("EVT-000123");
    for (const part of ["Annual Research Symposium", "Wednesday 2 December 2026, 14:00–18:00", "150", "Tuesday 27 October 2026, 09:15"]) {
      expect(rows[0], part).toContain(part);
    }
    expect(rows[1]).toContain("EVT-000124");
  });

  it("says when nothing is waiting", async () => {
    listUnassigned.mockResolvedValueOnce({ items: [] });
    signInAs("EVENT_COORDINATOR_LEAD", "/assignments/unassigned");
    render(<App />);
    expect(await screen.findByText("No requests are waiting to be assigned.")).toBeTruthy();
  });
});

describe("assigning a request (E3-T3, E3-T4)", () => {
  async function openRequest() {
    signInAs("EVENT_COORDINATOR_LEAD", "/assignments/unassigned");
    render(<App />);
    fireEvent.click(await screen.findByRole("link", { name: "EVT-000123" }));
    return screen.findByRole("heading", { name: "Annual Research Symposium" });
  }

  it("shows the request's basic information and that it is unassigned", async () => {
    await openRequest();
    const page = text(document.body);
    for (const part of ["EVT-000123", "Share faculty research", "Wednesday 2 December 2026, 14:00–18:00", "150", "Organiser One", "Unassigned"]) {
      expect(page, part).toContain(part);
    }
  });

  it("offers the active coordinators with their load, and assigns the one chosen", async () => {
    await openRequest();
    const select = (await screen.findByLabelText("Coordinator")) as HTMLSelectElement;
    expect([...select.options].map((o) => o.textContent)).toEqual(["Choose a coordinator", "Coordinator One (3 active)", "Coordinator Two (0 active)"]);

    fireEvent.change(select, { target: { value: "coordinator-2" } });
    fireEvent.click(screen.getByRole("button", { name: "Assign" }));

    await waitFor(() => expect(assignCoordinator).toHaveBeenCalledWith("token", EVENT_ID, "coordinator-2"));
    expect(await screen.findByText("Assigned to Coordinator Two.")).toBeTruthy();
  });

  it("asks for a coordinator before assigning", async () => {
    await openRequest();
    fireEvent.click(await screen.findByRole("button", { name: "Assign" }));
    expect(await screen.findByText("Choose a coordinator to assign.")).toBeTruthy();
    expect(assignCoordinator).not.toHaveBeenCalled();
  });

  it("shows the server's refusal, such as a request another Lead has just assigned", async () => {
    assignCoordinator.mockRejectedValueOnce(
      new ApiError(409, {
        code: "ALREADY_ASSIGNED",
        message: "This event is already assigned to Coordinator One. Reassign it instead.",
        correlationId: null,
      }),
    );
    await openRequest();
    fireEvent.change(await screen.findByLabelText("Coordinator"), { target: { value: "coordinator-2" } });
    fireEvent.click(screen.getByRole("button", { name: "Assign" }));
    expect(await screen.findByText("This event is already assigned to Coordinator One. Reassign it instead.")).toBeTruthy();
  });
});
