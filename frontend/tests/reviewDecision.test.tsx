import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { EventRecord, EventStatus } from "../src/api/types.js";

/**
 * The coordinator's review page after a decision, from the staging dry run of 4 Nov 2026.
 *
 * D6: Approve and Reject answered with the decided event, but the page threw it away and showed a
 * bare "Loading…" for about 4.5 s while it read everything again. It now shows the answer at once
 * and refreshes the rest behind it.
 *
 * D8: an event decided long ago (Planning, Safety Review, Confirmed) showed "This request is
 * Planning. Decided … A request that already carries a decision cannot be decided again." in the
 * approval banner, red for Planning. The banner is the decision's, so it shows only while the
 * decision is the event's status: Approved or Rejected.
 */

const EVENT_ID = "event-under-review";
const COORDINATOR = "coordinator-id";

function eventRecord(changes: Partial<EventRecord> = {}): EventRecord {
  return {
    id: EVENT_ID,
    reference: "EVT-000001",
    ownerId: "organiser-id",
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
    status: "UNDER_REVIEW",
    submittedAt: "2026-09-17T01:00:00.000Z",
    lastSavedAt: "2026-09-17T01:00:00.000Z",
    reviewingCoordinatorId: COORDINATOR,
    reviewStartedAt: "2026-09-17T01:05:00.000Z",
    decidedBy: null,
    decidedAt: null,
    rejectionReason: null,
    assignedCoordinatorId: COORDINATOR,
    ...changes,
  } as EventRecord;
}

const decided = (status: EventStatus, changes: Partial<EventRecord> = {}) =>
  eventRecord({ status, decidedBy: COORDINATOR, decidedAt: "2026-10-01T02:00:00.000Z", ...changes });

const openEvent = vi.fn<[], Promise<EventRecord>>();
const approveEvent = vi.fn<[], Promise<EventRecord>>();
const rejectEvent = vi.fn<[], Promise<EventRecord>>();

vi.mock("../src/api/events.js", async () => {
  const actual = await vi.importActual<typeof import("../src/api/events.js")>("../src/api/events.js");
  return {
    ...actual,
    openEvent: () => openEvent(),
    approveEvent: () => approveEvent(),
    rejectEvent: () => rejectEvent(),
    listClarifications: vi.fn(async () => ({ items: [], nextCursor: null })),
    listReassignmentProposals: vi.fn(async () => ({ items: [], nextCursor: null })),
  };
});
vi.mock("../src/api/users.js", () => ({ lookupUsers: vi.fn(async () => [{ id: COORDINATOR, displayName: "Coordinator One", email: "c1@connectsphere.test" }]) }));
vi.mock("../src/api/changeRequests.js", () => ({
  listChangeRequests: vi.fn(async () => ({ items: [] })),
  listArrangementFlags: vi.fn(async () => ({ flags: [] })),
  getChangeImpact: vi.fn(async () => ({ impact: { bookings: [], reservations: [], activeRegistrations: 0, flags: [] } })),
}));
vi.mock("../src/api/statusHistory.js", async () => {
  const actual = await vi.importActual<typeof import("../src/api/statusHistory.js")>("../src/api/statusHistory.js");
  return { ...actual, getStatusHistory: vi.fn(async () => ({ items: [], nextCursor: null })) };
});

const { App } = await import("../src/App.js");

/** A read that has not answered yet, as a slow reload hasn't. */
const never = () => new Promise<EventRecord>(() => undefined);

beforeEach(() => {
  openEvent.mockReset();
  approveEvent.mockReset();
  rejectEvent.mockReset();
  sessionStorage.setItem(
    "connectsphere.session",
    JSON.stringify({ userId: COORDINATOR, email: "coordinator@connectsphere.test", role: "EVENT_COORDINATOR", token: "token", lastLoginAt: "2026-09-17T01:00:00.000Z" }),
  );
  window.location.hash = `#/review/${EVENT_ID}`;
});

afterEach(() => {
  cleanup();
  sessionStorage.clear();
});

describe("D6: a decision shows its own answer at once", () => {
  it("shows the approval from Approve's answer and never blanks the page, while the reload is still out", async () => {
    openEvent.mockResolvedValueOnce(eventRecord()).mockImplementation(never);
    approveEvent.mockResolvedValue(decided("APPROVED"));
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Approve" }));

    expect(await screen.findByText("This request is Approved")).toBeTruthy();
    expect(screen.queryByText("Loading…")).toBeNull();
    expect(screen.getByRole("heading", { name: "Annual Research Symposium" })).toBeTruthy();
    expect((screen.getByRole("button", { name: "Approve" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows the rejection and its reason from Reject's answer, closing the dialog, while the reload is still out", async () => {
    openEvent.mockResolvedValueOnce(eventRecord()).mockImplementation(never);
    rejectEvent.mockResolvedValue(decided("REJECTED", { rejectionReason: "No suitable venue that week" }));
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Reject" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "No suitable venue that week" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Reject request" }));

    expect(await screen.findByText("This request is Rejected")).toBeTruthy();
    expect(screen.getByText(/Reason: No suitable venue that week/)).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.queryByText("Loading…")).toBeNull();
  });

  it("still reads the event once more behind the answer, so the rest of the page catches up", async () => {
    openEvent.mockResolvedValueOnce(eventRecord()).mockResolvedValue(decided("APPROVED"));
    approveEvent.mockResolvedValue(decided("APPROVED"));
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Approve" }));
    await screen.findByText("This request is Approved");
    await waitFor(() => expect(openEvent).toHaveBeenCalledTimes(2));
  });
});

describe("D8: the decision banner only where it applies", () => {
  it.each(["PLANNING", "SAFETY_REVIEW", "CONFIRMED"] as EventStatus[])("shows no decision banner on a %s event", async (status) => {
    openEvent.mockResolvedValue(decided(status));
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Annual Research Symposium" })).toBeTruthy();
    expect(screen.queryByText(/^This request is /)).toBeNull();
    expect(screen.queryByText(/cannot be decided again/)).toBeNull();
  });

  it("shows the approval on an Approved event, and that it cannot be decided again", async () => {
    openEvent.mockResolvedValue(decided("APPROVED"));
    render(<App />);
    expect(await screen.findByText("This request is Approved")).toBeTruthy();
    expect(screen.getByText(/cannot be decided again/)).toBeTruthy();
  });

  it("shows the rejection and its reason on a Rejected event", async () => {
    openEvent.mockResolvedValue(decided("REJECTED", { rejectionReason: "Clashes with exams" }));
    render(<App />);
    expect(await screen.findByText("This request is Rejected")).toBeTruthy();
    expect(screen.getByText(/Reason: Clashes with exams/)).toBeTruthy();
  });
});
