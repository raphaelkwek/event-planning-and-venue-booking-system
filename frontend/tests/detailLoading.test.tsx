import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

/**
 * L11 (audit, 2 Nov 2026) — the request and review pages opened an event and then asked for its
 * clarifications, reassignment proposals and change requests one after another: four round trips
 * in a row. After the event, the other three are asked for together. The test holds the first of
 * them back and expects the other two to have been asked for by then.
 */

const EVENT_ID = "e1000000-0000-4000-8000-000000000001";
const OWNER = "organiser-id";
const COORDINATOR = "coordinator-id";

const event = {
  id: EVENT_ID, reference: "EVT-000001", ownerId: OWNER, name: "Annual Research Symposium",
  purpose: "Share faculty research", description: "A one-day symposium.",
  proposedStartAt: "2026-12-02T06:00:00.000Z", proposedEndAt: "2026-12-02T10:00:00.000Z",
  expectedAttendance: 150, venueRequirements: null, accessibilityNeeds: null,
  equipmentRequired: false, equipmentRequirements: null, registrationRequired: false,
  registrationOpensAt: null, registrationClosesAt: null, status: "UNDER_REVIEW",
  submittedAt: "2026-09-17T01:00:00.000Z", lastSavedAt: "2026-09-17T01:00:00.000Z",
  reviewingCoordinatorId: COORDINATOR, reviewStartedAt: null, decidedBy: null,
  decidedAt: null, rejectionReason: null, assignedCoordinatorId: COORDINATOR,
  contactDetails: null, version: 1,
};

let releaseClarifications: () => void = () => undefined;
const openEvent = vi.fn(async () => event);
const listClarifications = vi.fn(
  () => new Promise<{ items: never[]; nextCursor: null }>((resolve) => (releaseClarifications = () => resolve({ items: [], nextCursor: null })))
);
const listReassignmentProposals = vi.fn(async () => ({ items: [], nextCursor: null }));
const listChangeRequests = vi.fn(async () => ({ items: [] }));

vi.mock("../src/api/events.js", async () => {
  const actual = await vi.importActual<typeof import("../src/api/events.js")>("../src/api/events.js");
  return {
    ...actual,
    openEvent: () => openEvent(),
    listClarifications: () => listClarifications(),
    listReassignmentProposals: () => listReassignmentProposals(),
  };
});
vi.mock("../src/api/users.js", () => ({ lookupUsers: vi.fn(async () => []) }));
vi.mock("../src/api/changeRequests.js", () => ({
  listChangeRequests: () => listChangeRequests(),
  listArrangementFlags: vi.fn(async () => ({ flags: [] })),
}));

const { App } = await import("../src/App.js");

function signIn(userId: string, role: string, hash: string) {
  sessionStorage.setItem(
    "connectsphere.session",
    JSON.stringify({ userId, email: `${role}@connectsphere.test`, role, token: "token", lastLoginAt: "2026-09-17T01:00:00.000Z" })
  );
  window.location.hash = hash;
}

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.clearAllMocks();
});

describe.each([
  ["the review page", COORDINATOR, "EVENT_COORDINATOR", `#/review/${EVENT_ID}`],
  ["the request page", OWNER, "EVENT_ORGANISER", `#/requests/${EVENT_ID}`],
])("L11: %s asks for what follows the event together", (_name, userId, role, hash) => {
  it("has asked for the proposals and the change requests while the clarifications are still outstanding", async () => {
    signIn(userId, role, hash);
    render(<App />);

    await waitFor(() => expect(listClarifications).toHaveBeenCalledTimes(1));
    // Sequentially, these two would wait for the clarifications to arrive.
    expect(listReassignmentProposals).toHaveBeenCalledTimes(1);
    expect(listChangeRequests).toHaveBeenCalledTimes(1);

    releaseClarifications();
    await screen.findByRole("heading", { name: "Annual Research Symposium" });
  });

  it("still shows the page when the change requests cannot be fetched, beside a notice", async () => {
    listChangeRequests.mockRejectedValueOnce(new Error("change service down"));
    signIn(userId, role, hash);
    render(<App />);

    await waitFor(() => expect(listClarifications).toHaveBeenCalledTimes(1));
    releaseClarifications();
    await screen.findByRole("heading", { name: "Annual Research Symposium" });
    expect(await screen.findByText("Change requests couldn't be loaded.")).toBeTruthy();
  });
});
