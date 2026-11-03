import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

/** F3 — "Cancel event" on the organiser's and the coordinator's event pages. Only the HTTP boundary is stubbed. */
const EVENT_ID = "e1000000-0000-4000-8000-000000000003";
const OWNER = "organiser-id";
const COORDINATOR = "coordinator-id";

function event(overrides: Record<string, unknown> = {}) {
  return {
    id: EVENT_ID, reference: "EVT-000003", ownerId: OWNER, name: "Annual Research Symposium",
    purpose: "Share faculty research", description: "A one-day symposium.",
    proposedStartAt: "2026-12-02T06:00:00.000Z", proposedEndAt: "2026-12-02T10:00:00.000Z",
    expectedAttendance: 150, venueRequirements: null, accessibilityNeeds: null,
    equipmentRequired: true, equipmentRequirements: null, registrationRequired: false,
    registrationOpensAt: null, registrationClosesAt: null, status: "PLANNING",
    submittedAt: "2026-09-17T01:00:00.000Z", lastSavedAt: "2026-09-17T01:00:00.000Z",
    reviewingCoordinatorId: COORDINATOR, reviewStartedAt: null, decidedBy: COORDINATOR,
    decidedAt: "2026-09-18T01:00:00.000Z", rejectionReason: null,
    cancellationReason: null, cancelledBy: null, cancelledAt: null, assignedCoordinatorId: COORDINATOR,
    contactDetails: null, version: 1, ...overrides,
  };
}

let current: ReturnType<typeof event>;
vi.mock("../src/api/events.js", async () => {
  const actual = await vi.importActual<typeof import("../src/api/events.js")>("../src/api/events.js");
  return {
    ...actual,
    openEvent: async () => current,
    getEvent: async () => current,
    listClarifications: async () => ({ items: [], nextCursor: null }),
    listReassignmentProposals: async () => ({ items: [], nextCursor: null }),
  };
});
vi.mock("../src/api/users.js", () => ({ lookupUsers: vi.fn(async () => []) }));
const { App } = await import("../src/App.js");

const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
let onCancel: (body: Record<string, unknown>) => Response;
const fetchMock = vi.fn(async (path: string, init?: RequestInit) => {
  const url = new URL(path, "http://app.test");
  if (url.pathname === `/event/api/v1/events/${EVENT_ID}/cancellation`) return onCancel(JSON.parse(init!.body as string));
  if (url.pathname.includes("/notifications")) return reply({ items: [], unreadCount: 0, nextCursor: null });
  return reply({ items: [] });
});
const cancellations = () => fetchMock.mock.calls.filter(([path]) => String(path).endsWith("/cancellation"));

function signIn(userId: string, role: "EVENT_COORDINATOR" | "EVENT_ORGANISER") {
  sessionStorage.setItem(
    "connectsphere.session",
    JSON.stringify({ userId, email: "u@connectsphere.test", role, token: "t", lastLoginAt: "2026-10-20T00:00:00.000Z" }),
  );
  window.location.hash = role === "EVENT_COORDINATOR" ? `#/review/${EVENT_ID}` : `#/requests/${EVENT_ID}`;
  render(<App />);
}
const cancelButton = () => screen.queryByRole("button", { name: "Cancel event" });

beforeEach(() => {
  current = event();
  onCancel = (body) => {
    current = event({ status: "CANCELLED", cancellationReason: body.reason, cancelledBy: OWNER, cancelledAt: "2026-10-29T02:00:00.000Z" });
    return reply({
      event: { id: EVENT_ID, reference: "EVT-000003", status: "CANCELLED", previousStatus: "PLANNING", cancellationReason: body.reason, cancelledBy: OWNER, cancelledAt: "2026-10-29T02:00:00.000Z" },
      closedChangeRequest: null,
    });
  };
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  sessionStorage.clear();
  fetchMock.mockClear();
  vi.unstubAllGlobals();
});

describe("who sees Cancel event (F3 AC1)", () => {
  it("the owner, on their request page", async () => {
    signIn(OWNER, "EVENT_ORGANISER");
    expect(await screen.findByRole("button", { name: "Cancel event" })).toBeTruthy();
  });

  it("the assigned coordinator, on the review page", async () => {
    signIn(COORDINATOR, "EVENT_COORDINATOR");
    expect(await screen.findByRole("button", { name: "Cancel event" })).toBeTruthy();
  });

  it("not another coordinator", async () => {
    signIn("someone-else", "EVENT_COORDINATOR");
    await screen.findByText("Annual Research Symposium");
    expect(cancelButton()).toBeNull();
  });

  it("not on a Completed, Rejected or Cancelled event", async () => {
    for (const status of ["COMPLETED", "REJECTED", "CANCELLED"]) {
      current = event({ status });
      signIn(OWNER, "EVENT_ORGANISER");
      await screen.findByText("Annual Research Symposium");
      expect(cancelButton(), status).toBeNull();
      cleanup();
    }
  });
});

describe("cancelling", () => {
  it("restates what happens and asks for a reason before anything is sent (F3 AC2)", async () => {
    signIn(OWNER, "EVENT_ORGANISER");
    fireEvent.click(await screen.findByRole("button", { name: "Cancel event" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/can't be undone/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel event" }));
    expect(await within(dialog).findByText("Give a reason for cancelling the event.")).toBeTruthy();
    expect(cancellations()).toHaveLength(0);
    fireEvent.click(within(dialog).getByRole("button", { name: "Keep the event" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(cancellations()).toHaveLength(0);
  });

  it("sends the reason, closes the dialog and shows the event Cancelled with its reason (F3 AC3, AC4)", async () => {
    signIn(OWNER, "EVENT_ORGANISER");
    fireEvent.click(await screen.findByRole("button", { name: "Cancel event" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Reason"), { target: { value: "The speaker withdrew." } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel event" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(cancellations()).toHaveLength(1);
    expect(JSON.parse(cancellations()[0]![1]!.body as string)).toEqual({ reason: "The speaker withdrew." });
    expect(await screen.findByText("This event was cancelled")).toBeTruthy();
    expect(screen.getByText("The speaker withdrew.")).toBeTruthy();
    expect(cancelButton()).toBeNull();
  });

  it("keeps a refusal in the dialog", async () => {
    onCancel = () =>
      reply(
        { error: { code: "STATUS_TRANSITION_NOT_PERMITTED", message: "This event is Completed and cannot move to Cancelled.", correlationId: "c" } },
        409,
      );
    signIn(OWNER, "EVENT_ORGANISER");
    fireEvent.click(await screen.findByRole("button", { name: "Cancel event" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Reason"), { target: { value: "x" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel event" }));
    expect(await within(dialog).findByText(/cannot move to Cancelled/)).toBeTruthy();
  });
});

describe("a cancelled event (F3 AC4)", () => {
  it("shows the reason and the date to the coordinator", async () => {
    current = event({ status: "CANCELLED", cancellationReason: "Venue flooded.", cancelledBy: OWNER, cancelledAt: "2026-10-29T02:00:00.000Z" });
    signIn(COORDINATOR, "EVENT_COORDINATOR");
    expect(await screen.findByText("This event was cancelled")).toBeTruthy();
    expect(screen.getByText("Venue flooded.")).toBeTruthy();
    expect(screen.getByText(/^Cancelled /)).toBeTruthy();
  });
});
