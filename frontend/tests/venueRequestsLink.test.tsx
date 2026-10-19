import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

/** L1 — the review page links to the event's venue requests for the assigned coordinator only (L1-T11). */

const EVENT_ID = "event-1";
const ASSIGNED = "assigned-coordinator";

const event = {
  id: EVENT_ID,
  reference: "EVT-000123",
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
  status: "APPROVED",
  submittedAt: "2026-09-17T01:00:00.000Z",
  lastSavedAt: "2026-09-17T01:00:00.000Z",
  reviewingCoordinatorId: ASSIGNED,
  reviewStartedAt: "2026-09-17T01:05:00.000Z",
  decidedBy: ASSIGNED,
  decidedAt: "2026-09-18T01:00:00.000Z",
  rejectionReason: null,
  assignedCoordinatorId: ASSIGNED,
  contactDetails: null,
  version: 3,
};

vi.mock("../src/api/events.js", async () => {
  const actual = await vi.importActual<typeof import("../src/api/events.js")>("../src/api/events.js");
  return {
    ...actual,
    openEvent: vi.fn(async () => event),
    listClarifications: vi.fn(async () => ({ items: [], nextCursor: null })),
    listReassignmentProposals: vi.fn(async () => ({ items: [], nextCursor: null })),
  };
});

vi.mock("../src/api/users.js", () => ({ lookupUsers: vi.fn(async () => []) }));

const { App } = await import("../src/App.js");

function openReviewAs(userId: string) {
  sessionStorage.setItem(
    "connectsphere.session",
    JSON.stringify({ userId, email: "user@connectsphere.test", role: "EVENT_COORDINATOR", token: "token", lastLoginAt: "2026-10-17T01:00:00.000Z" }),
  );
  window.location.hash = `#/review/${EVENT_ID}`;
  render(<App />);
}

afterEach(() => {
  cleanup();
  sessionStorage.clear();
});

describe("\"Venue requests\" on the review page", () => {
  it("is offered to the assigned coordinator, and opens the event's requests", async () => {
    openReviewAs(ASSIGNED);
    const link = await screen.findByRole("link", { name: "Venue requests" });
    expect(link.getAttribute("href")).toBe(`#/events/${EVENT_ID}/venue-requests`);
  });

  it("is not offered to a coordinator who isn't assigned", async () => {
    openReviewAs("another-coordinator");
    await screen.findByRole("heading", { name: "Annual Research Symposium" });
    expect(screen.queryByRole("link", { name: "Venue requests" })).toBeNull();
  });
});
