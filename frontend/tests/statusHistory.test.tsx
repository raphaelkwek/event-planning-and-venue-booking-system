import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { ApiError } from "../src/api/client.js";

/**
 * F2 - the current status and the status history on the event detail screens.
 */

const ORGANISER_ID = "00000000-0000-0000-0000-000000000001";
const COORDINATOR_ID = "00000000-0000-0000-0000-000000000002";

const event = {
  id: "event-1",
  reference: "EVT-000001",
  ownerId: ORGANISER_ID,
  name: "Annual Research Symposium",
  purpose: "Share faculty research",
  description: "A one-day symposium.",
  proposedStartAt: "2026-12-02T06:00:00.000Z",
  proposedEndAt: "2026-12-02T10:00:00.000Z",
  expectedAttendance: 150,
  venueRequirements: null,
  accessibilityNeeds: null,
  equipmentRequired: false,
  equipmentRequirements: null,
  registrationRequired: false,
  registrationOpensAt: null,
  registrationClosesAt: null,
  status: "APPROVED",
  submittedAt: "2026-09-17T01:00:00.000Z",
  lastSavedAt: "2026-09-17T01:00:00.000Z",
  reviewingCoordinatorId: COORDINATOR_ID,
  reviewStartedAt: "2026-09-17T01:05:00.000Z",
  decidedBy: COORDINATOR_ID,
  decidedAt: "2026-09-17T02:00:00.000Z",
  rejectionReason: null,
  assignedCoordinatorId: COORDINATOR_ID,
};

const threeEntries = [
  {
    id: "h1",
    previousStatus: "DRAFT",
    newStatus: "SUBMITTED",
    actorUserId: ORGANISER_ID,
    actorRole: "EVENT_ORGANISER",
    triggeringAction: "SUBMIT",
    occurredAt: "2026-09-17T01:00:00.000Z",
  },
  {
    id: "h2",
    previousStatus: "SUBMITTED",
    newStatus: "UNDER_REVIEW",
    actorUserId: COORDINATOR_ID,
    actorRole: "EVENT_COORDINATOR",
    triggeringAction: "OPEN_FOR_REVIEW",
    occurredAt: "2026-09-17T01:05:00.000Z",
  },
  {
    id: "h3",
    previousStatus: "UNDER_REVIEW",
    newStatus: "APPROVED",
    actorUserId: COORDINATOR_ID,
    actorRole: "EVENT_COORDINATOR",
    triggeringAction: "APPROVE",
    occurredAt: "2026-09-17T02:00:00.000Z",
  },
];

const getStatusHistory = vi.fn();

vi.mock("../src/api/statusHistory.js", () => ({
  getStatusHistory: (...args: unknown[]) => getStatusHistory(...args),
}));

vi.mock("../src/api/events.js", async () => {
  const actual = await vi.importActual<typeof import("../src/api/events.js")>("../src/api/events.js");
  return {
    ...actual,
    openEvent: vi.fn(async () => event),
    listClarifications: vi.fn(async () => ({ items: [], nextCursor: null })),
    listReassignmentProposals: vi.fn(async () => ({ items: [], nextCursor: null })),
  };
});

vi.mock("../src/api/users.js", () => ({
  lookupUsers: vi.fn(async () => [
    { id: ORGANISER_ID, displayName: "Organiser One", email: "organiser@connectsphere.test" },
    { id: COORDINATOR_ID, displayName: "Coordinator One", email: "coordinator@connectsphere.test" },
  ]),
}));

const { App } = await import("../src/App.js");

function signedInAs(role: "EVENT_COORDINATOR" | "EVENT_ORGANISER", userId: string, hash: string) {
  sessionStorage.setItem(
    "connectsphere.session",
    JSON.stringify({ userId, email: "x@connectsphere.test", role, token: "token", lastLoginAt: "2026-09-17T01:00:00.000Z" })
  );
  window.location.hash = hash;
}

async function historyRows() {
  const section = (await screen.findByRole("heading", { name: "Status history" })).closest("section")!;
  await within(section).findAllByRole("row");
  return within(section)
    .getAllByRole("row")
    .slice(1)
    .map((row) => within(row).getAllByRole("cell").map((cell) => cell.textContent));
}

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  getStatusHistory.mockReset();
});

describe("F2 - status history on the event detail screens", () => {
  it("shows the organiser every change on their request, oldest first, with both statuses, the role and the time", async () => {
    getStatusHistory.mockResolvedValue({ eventId: "event-1", status: "APPROVED", items: threeEntries });
    signedInAs("EVENT_ORGANISER", ORGANISER_ID, "#/requests/event-1");
    render(<App />);

    const rows = await historyRows();

    expect(rows).toHaveLength(3);
    expect(rows.map((cells) => [cells[0], cells[1]])).toEqual([
      ["Draft", "Submitted"],
      ["Submitted", "Under Review"],
      ["Under Review", "Approved"],
    ]);
    expect(rows[0]![2]).toContain("Event Organiser");
    expect(rows[2]![2]).toContain("Event Coordinator");
    expect(rows.every((cells) => (cells[3] ?? "").length > 0 && cells[3] !== "—")).toBe(true);
    expect(getStatusHistory).toHaveBeenCalledWith("token", "event-1");
  });

  it("shows the coordinator the same history on the review screen", async () => {
    getStatusHistory.mockResolvedValue({ eventId: "event-1", status: "APPROVED", items: threeEntries });
    signedInAs("EVENT_COORDINATOR", COORDINATOR_ID, "#/review/event-1");
    render(<App />);

    expect(await historyRows()).toHaveLength(3);
  });

  it("shows a single entry on its own, with no empty-state message", async () => {
    getStatusHistory.mockResolvedValue({ eventId: "event-1", status: "SUBMITTED", items: [threeEntries[0]] });
    signedInAs("EVENT_ORGANISER", ORGANISER_ID, "#/requests/event-1");
    render(<App />);

    const rows = await historyRows();

    expect(rows).toHaveLength(1);
    expect(rows[0]!.slice(0, 2)).toEqual(["Draft", "Submitted"]);
    expect(screen.queryByText("No status changes recorded.")).toBeNull();
  });

  it("offers no control that edits or deletes an entry", async () => {
    getStatusHistory.mockResolvedValue({ eventId: "event-1", status: "APPROVED", items: threeEntries });
    signedInAs("EVENT_ORGANISER", ORGANISER_ID, "#/requests/event-1");
    render(<App />);
    await historyRows();

    const section = screen.getByRole("heading", { name: "Status history" }).closest("section")!;

    expect(within(section).queryAllByRole("button")).toHaveLength(0);
    expect(within(section).queryAllByRole("textbox")).toHaveLength(0);
    expect(within(section).queryAllByRole("link")).toHaveLength(0);
  });

  it("says so when no status change is recorded", async () => {
    getStatusHistory.mockResolvedValue({ eventId: "event-1", status: "DRAFT", items: [] });
    signedInAs("EVENT_ORGANISER", ORGANISER_ID, "#/requests/event-1");
    render(<App />);

    expect(await screen.findByText("No status changes recorded.")).toBeTruthy();
  });

  it("shows the server's refusal in place of the history", async () => {
    getStatusHistory.mockRejectedValue(
      new ApiError(403, {
        code: "ROLE_NOT_AUTHORISED",
        message: "Your role is not authorised to use this function.",
        correlationId: null,
      })
    );
    signedInAs("EVENT_ORGANISER", ORGANISER_ID, "#/requests/event-1");
    render(<App />);

    expect(await screen.findByText("Your role is not authorised to use this function.")).toBeTruthy();
    expect(screen.queryAllByRole("row")).toHaveLength(0);
  });
});
