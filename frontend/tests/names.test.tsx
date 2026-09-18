import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

/**
 * B1, D1 — people are shown by name, not by user id: the submitting organiser,
 * and the coordinator who opened a request first.
 */

const ORGANISER_ID = "00000000-0000-0000-0000-000000000001";
const COORDINATOR_ID = "00000000-0000-0000-0000-000000000002";
const UNNAMED_ID = "00000000-0000-0000-0000-000000000009";

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
  status: "UNDER_REVIEW",
  submittedAt: "2026-09-17T01:00:00.000Z",
  lastSavedAt: "2026-09-17T01:00:00.000Z",
  reviewingCoordinatorId: COORDINATOR_ID,
  reviewStartedAt: "2026-09-17T01:05:00.000Z",
  decidedBy: null,
  decidedAt: null,
  rejectionReason: null,
  assignedCoordinatorId: UNNAMED_ID,
};

vi.mock("../src/api/events.js", async () => {
  const actual = await vi.importActual<typeof import("../src/api/events.js")>("../src/api/events.js");
  return {
    ...actual,
    openEvent: vi.fn(async () => event),
    listClarifications: vi.fn(async () => ({ items: [], nextCursor: null })),
    listReassignmentProposals: vi.fn(async () => ({ items: [], nextCursor: null })),
    listQueue: vi.fn(async () => ({ items: [{ ...event, status: "SUBMITTED", reviewingCoordinatorId: null }], nextCursor: null })),
  };
});

vi.mock("../src/api/users.js", () => ({
  lookupUsers: vi.fn(async () => [
    { id: ORGANISER_ID, displayName: "Organiser One", email: "organiser@connectsphere.test" },
    { id: COORDINATOR_ID, displayName: "Coordinator One", email: "coordinator@connectsphere.test" },
    { id: UNNAMED_ID, displayName: null, email: "unnamed@connectsphere.test" },
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

afterEach(() => {
  cleanup();
  sessionStorage.clear();
});

describe("people are shown by name", () => {
  it("names the submitting organiser in the review queue", async () => {
    signedInAs("EVENT_COORDINATOR", COORDINATOR_ID, "#/queue");
    render(<App />);

    expect(await screen.findByText("Organiser One")).toBeTruthy();
    expect(screen.queryByText(ORGANISER_ID)).toBeNull();
  });

  it("names the coordinator who opened the request first", async () => {
    signedInAs("EVENT_COORDINATOR", "00000000-0000-0000-0000-000000000008", "#/review/event-1");
    render(<App />);

    expect(await screen.findByText(/Coordinator One opened this request first/)).toBeTruthy();
  });

  it("shows the submitting organiser on the organiser's own request page", async () => {
    signedInAs("EVENT_ORGANISER", ORGANISER_ID, "#/requests/event-1");
    render(<App />);

    expect(await screen.findByText("Organiser")).toBeTruthy();
    expect(await screen.findByText("Organiser One")).toBeTruthy();
  });

  it("falls back to the email for a user with no display name", async () => {
    signedInAs("EVENT_ORGANISER", ORGANISER_ID, "#/requests/event-1");
    render(<App />);

    expect(await screen.findByText("unnamed@connectsphere.test")).toBeTruthy();
  });
});
